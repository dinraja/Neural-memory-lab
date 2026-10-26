"""
Neural Network Memory Efficiency Lab
Experiment: FP32 vs dynamic INT8 quantization + batch-size scaling.

Dataset: sklearn's built-in digits dataset (8x8 grayscale images; no download needed).
This script records real measurements on the machine where it is run.
It does not contain pre-filled or fabricated benchmark results.
"""
from __future__ import annotations

import json
import os
import platform
import threading
import time
from pathlib import Path

import numpy as np
import pandas as pd
import psutil
import sklearn
import torch
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "results"
MODELS = OUT / "models"
OUT.mkdir(exist_ok=True)
MODELS.mkdir(exist_ok=True)

SEED = 42
BATCH_SIZES = [1, 8, 16, 32, 64]
WARMUP_BATCHES = 5
REPEATS = 15
TRAIN_EPOCHS = 35
TRAIN_BATCH_SIZE = 64


class SmallMLP(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(64, 128),
            nn.ReLU(),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, 10),
        )

    def forward(self, x):
        return self.net(x)


class PeakRSSSampler:
    """Samples this process's RSS during a measurement window.
    This is an approximate observed peak, not an OS-level exact peak.
    """
    def __init__(self, interval=0.005):
        self.interval = interval
        self.process = psutil.Process(os.getpid())
        self.peak = 0
        self.stop_event = threading.Event()
        self.thread = None

    def _sample(self):
        while not self.stop_event.is_set():
            try:
                self.peak = max(self.peak, self.process.memory_info().rss)
            except psutil.Error:
                pass
            self.stop_event.wait(self.interval)

    def __enter__(self):
        self.baseline = self.process.memory_info().rss
        self.peak = self.baseline
        self.thread = threading.Thread(target=self._sample, daemon=True)
        self.thread.start()
        return self

    def __exit__(self, exc_type, exc, tb):
        self.stop_event.set()
        self.thread.join(timeout=1)

    @property
    def peak_delta_mb(self):
        return max(0, self.peak - self.baseline) / (1024 ** 2)


def load_data():
    digits = load_digits()
    x = digits.data.astype(np.float32) / 16.0
    y = digits.target.astype(np.int64)

    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.25, random_state=SEED, stratify=y
    )
    # The same fixed split is used for every model variant.
    return (
        torch.from_numpy(x_train),
        torch.from_numpy(y_train),
        torch.from_numpy(x_test),
        torch.from_numpy(y_test),
    )


def accuracy(model, x, y, batch_size=128):
    model.eval()
    correct = 0
    with torch.inference_mode():
        for start in range(0, len(x), batch_size):
            logits = model(x[start:start + batch_size])
            correct += (logits.argmax(dim=1) == y[start:start + batch_size]).sum().item()
    return correct / len(y)


def train_baseline(x_train, y_train):
    torch.manual_seed(SEED)
    model = SmallMLP().cpu()
    loader = DataLoader(
        TensorDataset(x_train, y_train),
        batch_size=TRAIN_BATCH_SIZE,
        shuffle=True,
        generator=torch.Generator().manual_seed(SEED),
    )
    optimizer = torch.optim.Adam(model.parameters(), lr=0.003)
    loss_fn = nn.CrossEntropyLoss()

    model.train()
    for _ in range(TRAIN_EPOCHS):
        for xb, yb in loader:
            optimizer.zero_grad(set_to_none=True)
            loss = loss_fn(model(xb), yb)
            loss.backward()
            optimizer.step()
    return model.eval()


def save_state_dict(model, path):
    # State-dict files make the model-weight storage comparison more meaningful
    # than saving entire Python model objects.
    torch.save(model.state_dict(), path)
    return path.stat().st_size / (1024 ** 2)


def make_int8_model(fp32_model):
    """Dynamic INT8 quantization of Linear layers, run on CPU.
    Backend availability differs across PyTorch builds / Apple Silicon.
    """
    available = list(torch.backends.quantized.supported_engines)
    machine = platform.machine().lower()
    preferred = "qnnpack" if ("arm" in machine or "aarch" in machine) else "x86"
    if preferred not in available:
        preferred = "fbgemm" if "fbgemm" in available else (
            "qnnpack" if "qnnpack" in available else None
        )
    if preferred is None:
        raise RuntimeError(f"No supported quantization engine found. Available: {available}")

    torch.backends.quantized.engine = preferred
    quantized = torch.ao.quantization.quantize_dynamic(
        fp32_model, {nn.Linear}, dtype=torch.qint8
    ).eval()
    return quantized, preferred


def benchmark_model(model, x_test, y_test, model_name, model_size_mb):
    rows = []
    model.eval()

    for batch_size in BATCH_SIZES:
        batches = [x_test[i:i + batch_size] for i in range(0, len(x_test), batch_size)]

        # Warm-up is excluded from timing.
        with torch.inference_mode():
            for xb in batches[:WARMUP_BATCHES]:
                _ = model(xb)

        elapsed_runs = []
        observed_peak_delta = 0.0
        with PeakRSSSampler() as sampler:
            with torch.inference_mode():
                for _ in range(REPEATS):
                    start = time.perf_counter()
                    for xb in batches:
                        _ = model(xb)
                    elapsed_runs.append(time.perf_counter() - start)
            observed_peak_delta = sampler.peak_delta_mb

        elapsed = float(np.median(elapsed_runs))
        n_images = len(x_test) * REPEATS
        throughput = n_images / elapsed if elapsed > 0 else float("nan")
        latency_per_image_ms = elapsed * 1000 / n_images

        rows.append({
            "model": model_name,
            "batch_size": batch_size,
            "model_file_mb": model_size_mb,
            "accuracy": accuracy(model, x_test, y_test),
            "median_total_inference_seconds": elapsed,
            "latency_ms_per_image": latency_per_image_ms,
            "throughput_images_per_second": throughput,
            "observed_peak_rss_delta_mb": observed_peak_delta,
            "repeats": REPEATS,
            "test_images_per_repeat": len(x_test),
        })
    return rows


def main():
    torch.set_num_threads(max(1, min(4, os.cpu_count() or 1)))
    torch.manual_seed(SEED)
    np.random.seed(SEED)

    x_train, y_train, x_test, y_test = load_data()
    print(f"Training on CPU. Train={len(x_train)}, test={len(x_test)}")
    print(f"PyTorch={torch.__version__}; Python platform={platform.platform()}")

    fp32 = train_baseline(x_train, y_train)
    fp32_path = MODELS / "mlp_fp32_state_dict.pt"
    fp32_size = save_state_dict(fp32, fp32_path)
    fp32_accuracy = accuracy(fp32, x_test, y_test)
    print(f"FP32 test accuracy: {fp32_accuracy:.4f}")
    print(f"FP32 state-dict size: {fp32_size:.4f} MiB")

    all_rows = benchmark_model(fp32, x_test, y_test, "FP32", fp32_size)
    quantization_status = {"available": False, "reason": None, "engine": None}

    try:
        int8, engine = make_int8_model(fp32)
        int8_path = MODELS / "mlp_dynamic_int8_state_dict.pt"
        int8_size = save_state_dict(int8, int8_path)
        int8_accuracy = accuracy(int8, x_test, y_test)
        quantization_status = {
            "available": True,
            "reason": None,
            "engine": engine,
            "test_accuracy": int8_accuracy,
            "state_dict_size_mb": int8_size,
        }
        print(f"Dynamic INT8 test accuracy: {int8_accuracy:.4f}")
        print(f"Dynamic INT8 state-dict size: {int8_size:.4f} MiB")
        all_rows.extend(benchmark_model(int8, x_test, y_test, "Dynamic INT8", int8_size))
    except Exception as exc:
        quantization_status = {
            "available": False,
            "reason": f"{type(exc).__name__}: {exc}",
            "engine": None,
        }
        print("\nINT8 quantization could not run in this PyTorch environment.")
        print("The script will still save valid FP32 and batch-size results.")
        print("Reason:", quantization_status["reason"])

    results = pd.DataFrame(all_rows)
    csv_path = OUT / "benchmark_results.csv"
    results.to_csv(csv_path, index=False)

    metadata = {
        "experiment": "FP32 vs dynamic INT8 quantization and batch-size scaling",
        "dataset": "scikit-learn built-in digits (8x8 grayscale, 10 classes)",
        "seed": SEED,
        "train_examples": len(x_train),
        "test_examples": len(x_test),
        "epochs": TRAIN_EPOCHS,
        "batch_sizes": BATCH_SIZES,
        "timing_repeats": REPEATS,
        "device": "CPU",
        "platform": platform.platform(),
        "machine": platform.machine(),
        "python_version": platform.python_version(),
        "torch_version": torch.__version__,
        "numpy_version": np.__version__,
        "sklearn_version": sklearn.__version__,
        "quantization": quantization_status,
        "notes": [
            "Model file size is the serialized state_dict size, not total process RAM.",
            "RSS delta is an approximate sampled process-memory increase during inference.",
            "Results depend on the hardware, OS, software versions and background activity.",
            "This experiment measures inference, not training activation/gradient/optimizer memory."
        ],
    }
    (OUT / "run_metadata.json").write_text(json.dumps(metadata, indent=2))
    make_plots(results)

    print(f"\nSaved results: {csv_path}")
    print(f"Saved metadata: {OUT / 'run_metadata.json'}")
    print(f"Saved plots in: {OUT}")
    print("\nLaunch the dashboard with: streamlit run dashboard.py")


def make_plots(df):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    if df.empty:
        return
    OUT.mkdir(exist_ok=True)

    # 1. State-dict size by model variant.
    sizes = df.groupby("model", as_index=False)["model_file_mb"].first()
    fig, ax = plt.subplots()
    ax.bar(sizes["model"], sizes["model_file_mb"])
    ax.set_title("Serialized Model State Size")
    ax.set_ylabel("MiB")
    ax.set_xlabel("Model variant")
    fig.tight_layout()
    fig.savefig(OUT / "model_size.png", dpi=160)
    plt.close(fig)

    # 2. Batch size vs throughput, one curve per model.
    fig, ax = plt.subplots()
    for name, group in df.groupby("model"):
        group = group.sort_values("batch_size")
        ax.plot(group["batch_size"], group["throughput_images_per_second"], marker="o", label=name)
    ax.set_title("Batch Size vs Inference Throughput")
    ax.set_xlabel("Batch size")
    ax.set_ylabel("Images per second")
    ax.legend()
    fig.tight_layout()
    fig.savefig(OUT / "throughput.png", dpi=160)
    plt.close(fig)

    # 3. Batch size vs observed RSS delta.
    fig, ax = plt.subplots()
    for name, group in df.groupby("model"):
        group = group.sort_values("batch_size")
        ax.plot(group["batch_size"], group["observed_peak_rss_delta_mb"], marker="o", label=name)
    ax.set_title("Batch Size vs Observed Peak RSS Increase")
    ax.set_xlabel("Batch size")
    ax.set_ylabel("Observed RSS increase (MiB)")
    ax.legend()
    fig.tight_layout()
    fig.savefig(OUT / "rss_delta.png", dpi=160)
    plt.close(fig)

    # 4. Accuracy vs file size (one point per variant).
    summary = df.groupby("model", as_index=False).agg(
        model_file_mb=("model_file_mb", "first"),
        accuracy=("accuracy", "first"),
    )
    fig, ax = plt.subplots()
    for _, row in summary.iterrows():
        ax.scatter(row["model_file_mb"], row["accuracy"], s=70)
        ax.annotate(row["model"], (row["model_file_mb"], row["accuracy"]), xytext=(5, 5),
                    textcoords="offset points")
    ax.set_title("Model Size vs Test Accuracy")
    ax.set_xlabel("State-dict size (MiB)")
    ax.set_ylabel("Test accuracy")
    fig.tight_layout()
    fig.savefig(OUT / "size_vs_accuracy.png", dpi=160)
    plt.close(fig)


if __name__ == "__main__":
    main()
