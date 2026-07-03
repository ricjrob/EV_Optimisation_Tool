# AGENTS

## Purpose
This repository is an MVP for an EV charging bay demand model. It provides a FastAPI backend with a static frontend, and core calculation logic in `src/` for estimating required EV charging bays based on daily session counts, hourly demand distribution, service time, utilisation, and buffer.

## Key workflows
- Install dependencies: `pip install -r requirements.txt`
- Run backend locally: `python app.py`
- Alternative dev server: `uvicorn app:app --reload`
- Frontend is served from `static/` and the FastAPI app exposes API endpoints under `/api/`

## Important files
- `app.py` - FastAPI entrypoint, static file mounting, request models, and API endpoints
- `requirements.txt` - Python dependency list
- `src/apiModel.py` - glue layer that wires `DayProfile` to `BayCalculator`
- `src/DayProfile.py` - hourly distribution profile logic and built-in presets
- `src/BayCalculator.py` - bay sizing calculations and utilisation logic
- `src/BayResult.py` - calculation result container
- `static/index.html`, `static/script.js`, `static/style.css` - frontend UI
- `README.md` and `WEB_FRONTEND_README.md` - primary documentation for repo usage and frontend behavior

## Notes for AI agents
- Prefer using the documented `README.md` and `WEB_FRONTEND_README.md` for higher-level project context.
- The backend currently uses Pydantic models for API validation and returns a JSON response shaped by `app.py`.
- The model expects 24 hourly distribution values that sum close to 1.0.
- There is no existing `pyproject.toml` or explicit test command in repo docs.

## Suggested next customization
- Add a `.github/copilot-instructions.md` or custom agent if the repository later adds distinct backend/frontend development workflows or testing conventions.
