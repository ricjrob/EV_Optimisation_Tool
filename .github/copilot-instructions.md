# Copilot Instructions

This repository is a lightweight EV charging bay demand model with a FastAPI backend and static frontend.

## Primary goals
- Help maintain and extend the bay-sizing logic in `src/`
- Preserve the main API flow in `app.py`
- Keep frontend UI and validation behavior in `static/` aligned with the model

## Recommended entrypoints
- `pip install -r requirements.txt`
- `python app.py`
- `uvicorn app:app --reload`

## Key files
- `app.py` — FastAPI app, REST endpoints, static file serving
- `src/apiModel.py` — profile/calculator wiring and execution
- `src/DayProfile.py` — hourly distribution validation and presets
- `src/BayCalculator.py` — bay calculation and utilisation logic
- `static/index.html`, `static/script.js`, `static/style.css` — frontend interface

## Behavior notes
- `DayProfile` expects 24 hourly values that sum close to 1.0
- `BayCalculator` converts service time to bay-hours and applies utilisation + safety buffer
- `app.py` returns `peak_bays`, `peak_hour`, and a summary object

## When modifying
- Keep frontend and backend model expectations consistent
- Validate hourly distribution length and sum before calculation
- Preserve the simple MVP design; avoid over-engineering unless adding explicit features

## Documentation links
- `README.md` — overall project description
- `WEB_FRONTEND_README.md` — frontend usage and API contract
