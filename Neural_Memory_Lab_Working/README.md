# Neural Memory Efficiency Lab

Premium black / graphite / silver / steel-blue interface for comparing neural-network memory footprint, accuracy, and inference performance.

## What works now

- Full landing page with animated canvas neural network
- Laboratory workspace: Overview, Compare, Experiments, Memory, History
- **Client-side experiment simulation** (browser only)
  - Choose batch-size focus, FP32 / INT8 variants, and seed
  - Run / Stop / Reset controls with progress feedback
  - Dynamic results table and latency bar charts
  - Overview metrics, model comparison cards, and history list update automatically
  - Results persist in `localStorage` and are clearly labeled **SIMULATED**
- Original design system, typography, and animations preserved
- Optional real measurements via the existing Python experiment script

## Run the website (no build step)

```bash
cd Neural_Memory_Lab_Stage1
python3 -m http.server 8000 --directory frontend
```

Open **http://localhost:8000**

You can also open `frontend/index.html` directly in a modern browser.

## Demonstrate the experiment

1. Click **Enter the laboratory** (or **Open lab**).
2. Go to **Experiments** in the sidebar.
3. Optionally change batch size, variants, or seed.
4. Click **Run simulation**.
5. Watch progress, then review the results table and chart.
6. Open **Overview**, **Compare**, and **History** to see updated panels.
7. Click **Reset** to clear local simulation data.

All demo numbers are browser-generated approximations for teaching and presentations. They are **not** real hardware or live training measurements.

## Optional: real Python experiment

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python experiment.py
```

Fallback Streamlit dashboard:

```bash
streamlit run dashboard.py
```

## Project layout

```
Neural_Memory_Lab_Stage1/
  frontend/
    index.html
    styles.css
    app.js
  experiment.py
  dashboard.py
  requirements.txt
  report_template.md
  README.md
  PROJECT_HANDOFF.md
```

## Notes

- No API keys, paid services, or backend server required for the demo.
- Simulation data never leaves the browser (localStorage only).
- For scientific claims, run `experiment.py` on your machine and use those measured values.
