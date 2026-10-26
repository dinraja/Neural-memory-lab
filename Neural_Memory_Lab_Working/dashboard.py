from pathlib import Path
import json

import pandas as pd
import streamlit as st

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "results"
CSV = OUT / "benchmark_results.csv"
META = OUT / "run_metadata.json"

st.set_page_config(page_title="Neural Memory Efficiency Lab", page_icon="🧠", layout="wide")
st.title("🧠 Neural Network Memory Efficiency Lab")
st.caption("Measured comparison: FP32 vs dynamic INT8 + batch-size scaling")

if not CSV.exists():
    st.warning("No experiment results found yet. Run the experiment first.")
    st.code("python experiment.py\nstreamlit run dashboard.py", language="bash")
    st.info("The dashboard intentionally does not display sample or fabricated benchmark values.")
    st.stop()

df = pd.read_csv(CSV)
if df.empty:
    st.warning("The results CSV is empty. Run `python experiment.py` again.")
    st.stop()

meta = {}
if META.exists():
    meta = json.loads(META.read_text())

st.markdown("### Run information")
c1, c2, c3, c4 = st.columns(4)
c1.metric("Dataset", "Digits (8×8)")
c2.metric("Test examples", str(meta.get("test_examples", "—")))
c3.metric("Hardware", str(meta.get("machine", "—")))
c4.metric("Device", str(meta.get("device", "CPU")))

if meta.get("quantization", {}).get("available") is False:
    st.warning("Dynamic INT8 quantization did not run in this environment. See the recorded reason below.")
    st.code(meta.get("quantization", {}).get("reason", "No reason recorded."))

st.markdown("### Filter and compare")
models = list(df["model"].dropna().unique())
selected = st.multiselect("Model variants", models, default=models)
view = df[df["model"].isin(selected)].copy()
if view.empty:
    st.info("Choose at least one model variant.")
    st.stop()

batch_options = sorted(view["batch_size"].unique().tolist())
chosen_batches = st.multiselect("Batch sizes", batch_options, default=batch_options)
view = view[view["batch_size"].isin(chosen_batches)]

summary = view.groupby("model", as_index=False).agg(
    state_dict_size_mib=("model_file_mb", "first"),
    test_accuracy=("accuracy", "first"),
    best_throughput_images_s=("throughput_images_per_second", "max"),
    max_observed_rss_delta_mib=("observed_peak_rss_delta_mb", "max"),
)
st.dataframe(summary, use_container_width=True, hide_index=True)

left, right = st.columns(2)
with left:
    st.markdown("#### Throughput vs batch size")
    st.line_chart(view, x="batch_size", y="throughput_images_per_second", color="model")
with right:
    st.markdown("#### Observed RSS increase vs batch size")
    st.line_chart(view, x="batch_size", y="observed_peak_rss_delta_mb", color="model")

left, right = st.columns(2)
with left:
    st.markdown("#### Model size vs accuracy")
    chart = view.groupby("model", as_index=False).agg(
        state_dict_size_mib=("model_file_mb", "first"),
        test_accuracy=("accuracy", "first"),
    )
    st.scatter_chart(chart, x="state_dict_size_mib", y="test_accuracy", color="model")
with right:
    st.markdown("#### Detailed measurements")
    st.dataframe(
        view[[
            "model", "batch_size", "model_file_mb", "accuracy",
            "latency_ms_per_image", "throughput_images_per_second",
            "observed_peak_rss_delta_mb"
        ]].sort_values(["model", "batch_size"]),
        use_container_width=True, hide_index=True
    )

st.markdown("### Memory-budget decision helper")
budget = st.slider("Maximum state-dict size (MiB)", 0.01, max(1.0, float(df["model_file_mb"].max()) * 1.5),
                   min(max(0.01, float(df["model_file_mb"].max())), max(1.0, float(df["model_file_mb"].max()) * 1.5)))
min_acc = st.slider("Minimum test accuracy", 0.0, 1.0, 0.80, 0.01)
all_models = df.groupby("model", as_index=False).agg(
    state_dict_size_mib=("model_file_mb", "first"),
    test_accuracy=("accuracy", "first"),
    throughput_images_s=("throughput_images_per_second", "max"),
)
eligible = all_models[
    (all_models["state_dict_size_mib"] <= budget) &
    (all_models["test_accuracy"] >= min_acc)
].sort_values("throughput_images_s", ascending=False)
if eligible.empty:
    st.info("No measured model satisfies both constraints. Adjust the budget or accuracy threshold.")
else:
    winner = eligible.iloc[0]
    st.success(
        f"Best measured fit: **{winner['model']}** — "
        f"{winner['state_dict_size_mib']:.4f} MiB state dict, "
        f"{winner['test_accuracy']:.1%} test accuracy, "
        f"{winner['throughput_images_s']:.1f} images/s (maximum measured throughput)."
    )

with st.expander("Measurement definitions and limitations"):
    st.markdown("""
- **State-dict size:** serialized model parameter/state file size; not the same as total RAM.
- **Observed RSS increase:** approximate peak increase in this Python process during inference, sampled periodically. Very brief allocations may be missed.
- **Latency per image:** median total inference time divided by the number of images processed across repeats.
- **Throughput:** images processed per second across the timed run.
- **Accuracy:** fraction of the fixed held-out test split classified correctly.
- **Fairness:** variants use the same trained weights, fixed train/test split, CPU execution, and benchmark loop. Quantization support depends on the installed PyTorch build.
- **Scope:** this measures inference. It does not measure training activations, gradients, Adam optimizer states, or large language-model KV cache.
""")

if META:
    with st.expander("Full run metadata"):
        st.json(meta)

st.download_button(
    "Download measured results CSV",
    data=CSV.read_bytes(),
    file_name="benchmark_results.csv",
    mime="text/csv",
)
