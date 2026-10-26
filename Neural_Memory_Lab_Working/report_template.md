# Experimental Study: Memory Footprint in Neural Networks

**Student:** [Your name]  
**Course / department:** [Fill in]  
**Date of experiment:** [Fill in]  
**Machine:** Apple Mac M1, 8 GB RAM  
**Operating system:** [Record exact macOS version]

## 1. Aim

To measure the effect of model representation and inference batch size on the storage size, accuracy, inference speed and observed process-memory use of a small neural network.

## 2. Research questions

1. Does dynamic INT8 quantization reduce serialized model-state size compared with FP32?
2. What accuracy difference, if any, is observed after quantization?
3. How does batch size affect inference throughput and observed RSS increase?
4. Which tested variant meets a chosen state-size budget and accuracy threshold?

## 3. Hypotheses (not results)

- H1: Dynamic INT8 quantization will reduce the serialized state size because linear-layer weights use a lower-bit representation.
- H2: Quantization may change accuracy and latency; the direction and magnitude must be measured.
- H3: Increasing batch size may improve throughput but can increase working-memory requirements.
- H4: A larger batch will not necessarily improve performance indefinitely.

These are predictions only. Do not describe them as findings unless supported by your measurements.

## 4. Materials and software

- Apple Mac M1 with 8 GB RAM
- Python [version]
- PyTorch [version]
- scikit-learn [version]
- NumPy, pandas, psutil, matplotlib and Streamlit
- Built-in scikit-learn digits dataset (8×8 grayscale images, 10 classes)

## 5. Methodology

### Dataset and split
The experiment uses the built-in digits dataset. Pixel values are scaled by dividing by 16. A stratified train/test split is created with a fixed random seed of 42. The same test split is used for all variants.

### Model
A feed-forward MLP has layers 64 → 128 → 64 → 10, with ReLU activations between the linear layers. It is trained on CPU using Adam and cross-entropy loss.

### Conditions
- FP32 baseline.
- Dynamic INT8 quantization of linear layers, if the installed PyTorch backend supports it.
- Batch sizes 1, 8, 16, 32 and 64.

### Measurements
- Serialized state-dict file size in MiB.
- Held-out test accuracy.
- Median latency per image.
- Inference throughput in images per second.
- Approximate sampled peak process RSS increase during inference.

### Controls
Fixed seed, fixed data split, identical baseline weights, same test examples, CPU inference, warm-up before timing and repeated measurements.

## 6. Results

Run `python experiment.py`, then paste measured results from `results/benchmark_results.csv` here. Do not insert estimated or illustrative values.

### Table 1. Main comparison

| Variant | State-dict size (MiB) | Test accuracy | Best measured throughput (images/s) | Maximum observed RSS increase (MiB) |
|---|---:|---:|---:|---:|
| FP32 | [measured] | [measured] | [measured] | [measured] |
| Dynamic INT8, if available | [measured] | [measured] | [measured] | [measured] |

### Table 2. Batch-size experiment

| Variant | Batch size | Throughput (images/s) | Latency (ms/image) | Observed RSS increase (MiB) |
|---|---:|---:|---:|---:|
| [from CSV] | [from CSV] | [from CSV] | [from CSV] | [from CSV] |

### Figures
Insert the generated `model_size.png`, `throughput.png`, `rss_delta.png`, and `size_vs_accuracy.png`.

## 7. Calculations

### Percentage reduction in serialized model size

\[
\text{Reduction (\%)} =
\frac{S_{\mathrm{FP32}}-S_{\mathrm{variant}}}{S_{\mathrm{FP32}}}\times100
\]

Use measured file sizes. If the quantized model is unavailable, state that this calculation could not be made.

### Accuracy change in percentage points

\[
\Delta A_{\mathrm{pp}} = 100(A_{\mathrm{variant}}-A_{\mathrm{FP32}})
\]

Accuracy values in this equation are fractions from 0 to 1.

### Throughput comparison

\[
\text{Throughput} = \frac{\text{number of images processed}}{\text{elapsed seconds}}
\]

## 8. Discussion

Answer using your actual measurements:

1. Did INT8 reduce the saved state-dict size? By what percentage?
2. What was the measured accuracy change?
3. Which batch size achieved the highest throughput?
4. Did observed RSS increase consistently with batch size? If not, discuss measurement noise and the small model size.
5. Did the smallest file also give the best latency? Explain why file size and runtime speed are different properties.
6. What measurement limitations affect your conclusions?

## 9. Connection to the PPT

The experiment supports discussion of parameter representation and batch-size effects. The measured model is a small MLP, so it cannot establish the exact memory needs of a 7B-parameter language model. Training gradients, optimizer states, activation checkpointing, multi-GPU sharding and KV cache are not measured in this experiment.

## 10. Limitations

- The digits dataset and MLP are small and do not represent all modern neural networks.
- Dynamic quantization may not be available in every PyTorch build.
- Sampled process RSS is approximate and includes Python/runtime memory, not only model tensors.
- Serialized state-dict size is not equal to peak RAM.
- Benchmark results are specific to the tested machine and software versions.
- This is an inference benchmark; it does not measure training memory.

## 11. Conclusion

Write 4–6 sentences based only on measured results. Include the observed file-size change, accuracy difference, batch-size/throughput pattern, and at least one limitation. If quantization failed, say so explicitly rather than claiming an INT8 comparison.

## Appendix: Reproducibility

Attach `run_metadata.json` and `benchmark_results.csv`. Record any changes to the code, package versions or experiment settings.
