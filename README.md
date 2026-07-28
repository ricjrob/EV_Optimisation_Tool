# EV Charging Demand Model (MVP)

Lightweight EV charging bay sizing model with a FastAPI backend and static frontend.

## Documentation

- README.md: project overview and architecture
- WEB_FRONTEND_README.md: frontend usage and detailed API contract

## Purpose

This MVP estimates how many charging bays are required from:

- Expected charging sessions per day
- Hourly demand shape
- Average service time
- Per-session buffer sampled from a normal distribution with mean 4 minutes and standard deviation 1 minute
- Optional charge-curve strategy (legacy, AC L2 taper, DC fast taper, or mixed AC/DC)

It is intended as a transparent baseline that can be extended with richer forecasting inputs later.

## Current Capabilities

- FastAPI API for running bay calculations
- Static browser UI served by the backend
- Interactive hourly distribution editor with sessions and proportion modes
- Day tabs (Mon-Sun), linked or customized-by-day behavior
- Copy-day and compare-day tools
- Presets (9-to-5, Retail, Overnight)
- Drag-to-edit bars plus numeric hour-by-hour inputs

## Repository Structure

Important files and folders:

- app.py: API entrypoint, request models, static serving
- src/apiModel.py: glue layer between profile and calculator
- src/DayProfile.py: distribution validation and presets
- src/BayCalculator.py: bay calculations and utilisation logic
- src/BayResult.py: result container and summary helpers
- static/index.html: frontend structure
- static/script.js: frontend state, validation, API calls
- static/style.css: frontend styling
- WEB_FRONTEND_README.md: frontend and API contract details

## Quick Start

1. Install dependencies

```bash
pip install -r requirements.txt
```

2. Run the app

```bash
python app.py
```

Alternative dev server:

```bash
uvicorn app:app --reload
```

3. Open in browser

http://localhost:8000

## API Overview

### POST /api/calculate

Calculates hourly and peak bay demand.

Accepted profile formats:

- Legacy: profile.hourly_dist as 24-value distribution
- New: profile.hourly_editor with day-based editor data
- Optional charge-curve fields:
	- profile.charge_curve_id
	- profile.session_mix (used when charge_curve_id is mixed)

Returns:

- results: 24 hourly rows with sessions, utilisation, bays_needed
- peak_bays
- peak_hour
- summary object
- active_day, day_order, day_results
- overall_peak_bays, peak_day
- charge_curve_id, session_mix (normalized mix when using mixed mode)

### GET /api/presets

Returns built-in profile presets, including:

- flat
- morning_peak
- commuter_double_peak
- office (sessions and proportion)
- retail (sessions and proportion)
- overnight (sessions and proportion)

### GET /api/charge-curves

Returns available charge-curve options for frontend selector binding:

- legacy
- ac_l2
- dc_fast
- mixed

### GET /api/example

Returns an example profile and calculator payload.

For complete request and response examples, see WEB_FRONTEND_README.md.

## Notes

- Hourly arrays must contain exactly 24 non-negative values.
- Any input hourly values are normalized before calculation.
- In sessions editor mode, total sessions are inferred from the selected active day.
- The calculator samples one buffer value per session from a truncated normal distribution with mean 4 minutes and standard deviation 1 minute.
- charge_curve_id is validated server-side; unsupported values return HTTP 400.
- mixed session_mix values are normalized to sum to 1.0 and must include at least one positive weight.
- The legacy safety_buffer request field is still accepted for compatibility, but it no longer controls the bay calculation.

## Next Steps

- Add automated tests for API request variants
- Add scenario save/compare in UI
- Add CSV export for hourly results

## Contributing

Contributions and suggestions are welcome.


