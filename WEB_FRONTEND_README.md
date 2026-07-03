# Web Frontend Setup Guide

This project includes a FastAPI backend plus a static web UI for configuring demand patterns and calculating required EV charging bays.

For the high-level project overview and architecture notes, see README.md.

## Files

- app.py: FastAPI backend server and API routes
- static/index.html: frontend markup
- static/style.css: frontend styles
- static/script.js: editor logic, validation, and API calls

## Quick Start

1. Install dependencies.

```bash
pip install -r requirements.txt
```

2. Start the app.

```bash
python app.py
```

Or:

```bash
uvicorn app:app --reload
```

3. Open http://localhost:8000

## Frontend Features

The hourly distribution editor now supports:

- Sessions and Proportion (%) modes
- Day tabs (Mon-Sun)
- Linked profile mode (same curve every day)
- Unlinked mode (customized by day)
- Copy day to day
- Compare overlay between days
- Presets: 9-to-5, Retail, Overnight
- Drag bars and numeric hour-by-hour editing
- Normalize to 100% in proportion mode

Calculator controls remain:

- Total daily sessions
- Average service time (minutes)
- Safety buffer

## API Overview

### POST /api/calculate

Calculates bay demand from profile + calculator config.

The endpoint accepts either legacy hourly_dist or the new hourly_editor payload.

Legacy request format:

```json
{
  "profile": {
    "total_sessions": 100,
    "hourly_dist": [0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.08]
  },
  "calculator": {
    "avg_service_time": 35.0,
    "safety_buffer": 0.15
  }
}
```

New editor-aware request format:

```json
{
  "profile": {
    "total_sessions": 100,
    "hourly_editor": {
      "mode": "sessions",
      "linked": false,
      "active_day": "Mon",
      "days": {
        "Mon": [0, 0, 0, 0, 0, 1, 3, 8, 13, 10, 11, 9, 7, 7, 8, 10, 7, 9, 5, 2, 1, 0, 0, 0],
        "Tue": [0, 0, 0, 0, 0, 1, 3, 8, 13, 10, 11, 9, 7, 7, 8, 10, 7, 9, 5, 2, 1, 0, 0, 0],
        "Wed": [0, 0, 0, 0, 0, 1, 3, 8, 13, 10, 11, 9, 7, 7, 8, 10, 7, 9, 5, 2, 1, 0, 0, 0],
        "Thu": [0, 0, 0, 0, 0, 1, 3, 8, 13, 10, 11, 9, 7, 7, 8, 10, 7, 9, 5, 2, 1, 0, 0, 0],
        "Fri": [0, 0, 0, 0, 0, 1, 3, 8, 13, 10, 11, 9, 7, 7, 8, 10, 7, 9, 5, 2, 1, 0, 0, 0],
        "Sat": [0, 0, 0, 0, 0, 1, 3, 8, 13, 10, 11, 9, 7, 7, 8, 10, 7, 9, 5, 2, 1, 0, 0, 0],
        "Sun": [0, 0, 0, 0, 0, 1, 3, 8, 13, 10, 11, 9, 7, 7, 8, 10, 7, 9, 5, 2, 1, 0, 0, 0]
      }
    }
  },
  "calculator": {
    "avg_service_time": 35.0,
    "safety_buffer": 0.15
  }
}
```

Notes:

- When mode is sessions, total_sessions is inferred from the selected active_day values.
- When mode is proportion, total_sessions comes from profile.total_sessions.
- All hourly arrays must contain 24 non-negative values.

Successful response format:

```json
{
  "results": [
    {
      "hour": 0,
      "sessions": 4,
      "utilisation": 0.63,
      "bays_needed": 2
    }
  ],
  "peak_bays": 5,
  "peak_hour": 8,
  "summary": {
    "peak_bays": 5,
    "peak_hour": 8,
    "avg_utilisation": 0.44,
    "max_utilisation": 0.78
  }
}
```

Error response format (FastAPI):

```json
{
  "detail": "Hourly distribution must have 24 values"
}
```

### GET /api/presets

Returns preset distributions.

- Existing proportional presets: flat, morning_peak, commuter_double_peak
- New editor presets: office, retail, overnight (each includes sessions and proportion)

### GET /api/example

Returns an example legacy profile and calculator payload that the UI can load.

## Troubleshooting

Port 8000 already in use:

```bash
uvicorn app:app --port 8001
```

Module import issues:

```bash
cd <repo-root>
python app.py
```

Validation failures:

- Hourly arrays must be length 24
- Hourly values must be non-negative
- Distribution must not be all zeros
