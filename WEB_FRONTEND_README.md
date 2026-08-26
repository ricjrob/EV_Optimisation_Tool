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

Calculator behavior is fixed to the backend model:

- Total daily sessions
- Charge curve strategy is handled internally by the app
- Mixed-session split inputs (DC fast % and AC L2 %) when mixed strategy is selected

## API Overview

### POST /api/calculate

Calculates bay demand from profile config.

The endpoint accepts either legacy hourly_dist or the new hourly_editor payload.

Legacy request format:

```json
{
  "profile": {
    "total_sessions": 100,
    "charge_curve_id": "legacy",
    "session_mix": null,
    "hourly_dist": [0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.08]
  }
}
```

Note: the calculator samples a per-session buffer from a normal distribution with mean 4 minutes and standard deviation 1 minute, clamped at 0.

New editor-aware request format:

```json
{
  "profile": {
    "total_sessions": 100,
    "charge_curve_id": "mixed",
    "session_mix": {
      "dc_fast": 0.4,
      "ac_l2": 0.6
    },
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
  }
}
```

Notes:

- When mode is sessions, total_sessions is inferred from the selected active_day values.
- When mode is proportion, total_sessions comes from profile.total_sessions.
- All hourly arrays must contain 24 non-negative values.
- Supported charge_curve_id values: legacy, ac_l2, dc_fast, mixed.
- session_mix is used only for mixed and is normalized by the backend to sum to 1.0.
- The calculator always uses the backend's fixed DC-only buffer model.

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
  "active_day": "Mon",
  "day_order": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  "day_results": {
    "Mon": {
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
      },
      "total_sessions": 100,
      "charge_curve_id": "mixed",
      "session_mix": {
        "dc_fast": 0.4,
        "ac_l2": 0.6
      }
    }
  },
  "overall_peak_bays": 6,
  "peak_day": "Tue",
  "charge_curve_id": "mixed",
  "session_mix": {
    "dc_fast": 0.4,
    "ac_l2": 0.6
  },
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

### GET /api/charge-curves

Returns curve selector options for the frontend. Each option includes:

- id
- label
- description

### GET /api/example

Returns an example profile payload that the UI can load, including charge_curve_id and session_mix fields.

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
