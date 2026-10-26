# Project handoff — Neural Memory Efficiency Lab

## Status
Working demonstration website with client-side experiment simulation. Original UI, colors, animations, and layout preserved.

## Stack
- Static frontend: HTML + CSS + vanilla JS (no build tools)
- Optional Python: PyTorch / scikit-learn experiment (`experiment.py`) and Streamlit dashboard (`dashboard.py`)

## What was implemented
- Working navigation (landing ↔ lab, sidebar views)
- Functional experiment controls: Run, Stop, Reset
- Form inputs: batch focus, variant selection, seed
- Client-side simulation of FP32 vs INT8 MLP on digits-style workload
- Progress states, results table, canvas bar charts
- Overview metrics, Compare model cards, History list
- Persistence via localStorage
- All demo results labeled as simulated
- Responsive styles for new controls
- Python experiment foundation left intact

## How to run
```bash
python3 -m http.server 8000 --directory frontend
```
Open http://localhost:8000

## Limitations
- Simulation numbers are deterministic approximations (seeded PRNG), not live training or hardware RSS.
- No server-side API; browser only for the demo path.
- Real scientific measurements still require running `experiment.py` locally.
- Charts are simple canvas bar charts (latency by batch), not a charting library.

## Next optional steps
- Wire Streamlit or a thin Flask API to stream real `experiment.py` results into the same panels.
- Export CSV / JSON from the History view.
- Add accessibility pass on focus order for new form controls.
