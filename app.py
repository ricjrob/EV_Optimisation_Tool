from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from src.apiModel import apiModel
from src.DayProfile import DayProfile
import uvicorn

app = FastAPI(title="EV Charging Bay Calculator", version="1.0.0")

# Serve static files (HTML, CSS, JS)
app.mount("/static", StaticFiles(directory="static"), name="static")


class HourlyEditorConfig(BaseModel):
    mode: str
    linked: bool = True
    active_day: str = "Mon"
    days: dict[str, list[float]]


class ProfileConfig(BaseModel):
    total_sessions: int
    hourly_dist: list[float] | None = None
    hourly_editor: HourlyEditorConfig | None = None
    charge_curve_id: str = "dc_fast"


class CalculationRequest(BaseModel):
    profile: ProfileConfig


class BayResultResponse(BaseModel):
    hour: int
    sessions: int
    total_time: float
    throughput: float
    bays_needed: int


# Global model instance
model = apiModel()


EDITOR_DAYS = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}
CHARGE_CURVES = {"dc_fast"}


def _validate_hour_values(values: list[float]) -> None:
    if len(values) != 24:
        raise HTTPException(
            status_code=400, detail="Hourly distribution must have 24 values"
        )
    if any((not isinstance(v, (int, float))) or v < 0 for v in values):
        raise HTTPException(
            status_code=400,
            detail="Hourly distribution values must be non-negative numbers",
        )


def _normalize(values: list[float]) -> list[float]:
    total = sum(values)
    if total <= 0:
        raise HTTPException(status_code=400, detail="Distribution cannot be all zeros")
    return [v / total for v in values]


def _resolve_profile_distribution(profile: ProfileConfig) -> tuple[int, list[float]]:
    total_sessions = profile.total_sessions

    if profile.hourly_editor is not None:
        editor = profile.hourly_editor
        if editor.active_day not in EDITOR_DAYS:
            raise HTTPException(
                status_code=400, detail="Invalid active_day in hourly editor"
            )
        if editor.active_day not in editor.days:
            raise HTTPException(
                status_code=400,
                detail=f"Missing day values for active_day '{editor.active_day}'",
            )

        for day, values in editor.days.items():
            if day not in EDITOR_DAYS:
                raise HTTPException(
                    status_code=400, detail=f"Invalid day key '{day}' in hourly editor"
                )
            _validate_hour_values(values)

        selected = editor.days[editor.active_day]
        hourly_dist = _normalize(selected)

        mode = editor.mode.lower()
        if mode not in {"sessions", "proportion"}:
            raise HTTPException(
                status_code=400,
                detail="hourly_editor.mode must be either 'sessions' or 'proportion'",
            )

        if mode == "sessions":
            inferred_total = int(round(sum(selected)))
            if inferred_total <= 0:
                raise HTTPException(
                    status_code=400,
                    detail="Total sessions inferred from hourly editor must be positive",
                )
            total_sessions = inferred_total

        if total_sessions < 1:
            raise HTTPException(
                status_code=400, detail="Total sessions must be positive"
            )

        return total_sessions, hourly_dist

    if profile.hourly_dist is None:
        raise HTTPException(
            status_code=400,
            detail="Provide either profile.hourly_dist or profile.hourly_editor",
        )

    _validate_hour_values(profile.hourly_dist)
    hourly_dist = _normalize(profile.hourly_dist)
    if total_sessions < 1:
        raise HTTPException(status_code=400, detail="Total sessions must be positive")

    return total_sessions, hourly_dist


def _resolve_profile_distributions(
    profile: ProfileConfig,
) -> tuple[str, dict[str, tuple[int, list[float]]], list[str]]:
    if profile.hourly_editor is not None:
        editor = profile.hourly_editor
        active_day = editor.active_day

        if active_day not in EDITOR_DAYS:
            raise HTTPException(
                status_code=400, detail="Invalid active_day in hourly editor"
            )
        if active_day not in editor.days:
            raise HTTPException(
                status_code=400,
                detail=f"Missing day values for active_day '{active_day}'",
            )

        mode = editor.mode.lower()
        if mode not in {"sessions", "proportion"}:
            raise HTTPException(
                status_code=400,
                detail="hourly_editor.mode must be either 'sessions' or 'proportion'",
            )

        resolved_days: dict[str, tuple[int, list[float]]] = {}
        day_order = [
            day
            for day in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            if day in editor.days
        ]

        for day, values in editor.days.items():
            if day not in EDITOR_DAYS:
                raise HTTPException(
                    status_code=400, detail=f"Invalid day key '{day}' in hourly editor"
                )

            _validate_hour_values(values)
            hourly_dist = _normalize(values)

            if mode == "sessions":
                total_sessions = int(round(sum(values)))
                if total_sessions <= 0:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Total sessions inferred from '{day}' must be positive",
                    )
            else:
                total_sessions = profile.total_sessions
                if total_sessions < 1:
                    raise HTTPException(
                        status_code=400, detail="Total sessions must be positive"
                    )

            resolved_days[day] = (total_sessions, hourly_dist)

        return active_day, resolved_days, day_order

    total_sessions, hourly_dist = _resolve_profile_distribution(profile)
    return "Mon", {"Mon": (total_sessions, hourly_dist)}, ["Mon"]


def _resolve_charge_curve_config(
    profile: ProfileConfig,
) -> str:
    curve_id = (profile.charge_curve_id or "dc_fast").strip().lower()
    if curve_id not in CHARGE_CURVES:
        raise HTTPException(
            status_code=400,
            detail="Only 'dc_fast' is supported in the DC-only model",
        )
    return curve_id


# not used in app
@app.get("/")
async def serve_root():
    """Serve the main HTML page"""
    return FileResponse("static/index.html")


# not used in app
@app.post("/api/calculate")
async def calculate(request: CalculationRequest):
    """Calculate required bays based on profile and calculator settings"""
    try:
        active_day, day_inputs, day_order = _resolve_profile_distributions(
            request.profile
        )
        charge_curve_id = _resolve_charge_curve_config(request.profile)

        day_results = {}
        overall_peak_bays = -1
        peak_day = active_day

        for day in day_order:
            total_sessions, hourly_dist = day_inputs[day]

            model.set_profile(total_sessions, hourly_dist)
            model.profile.set_total_sessions(total_sessions)
            model.set_calculator(charge_curve_id)

            result = model.run()
            payload = {
                "results": [
                    {
                        "hour": hour,
                        "bays_needed": result.bays_per_hour[hour],
                        "utilisation": result.util_by_hour[hour],
                        "sessions": int(hourly_dist[hour] * total_sessions),
                    }
                    for hour in range(24)
                ],
                "peak_bays": result.peak_bays,
                "peak_hour": result.peak_hour,
                "summary": result.get_summary(),
                "total_sessions": total_sessions,
                "charge_curve_id": charge_curve_id,
                "soc_samples": result.soc_samples,
                "duration_samples": result.duration_samples,
            }
            day_results[day] = payload

            if payload["peak_bays"] > overall_peak_bays:
                overall_peak_bays = payload["peak_bays"]
                peak_day = day

        selected_result = day_results[active_day]

        response_data = {
            "results": selected_result["results"],
            "peak_bays": selected_result["peak_bays"],
            "peak_hour": selected_result["peak_hour"],
            "summary": selected_result["summary"],
            "active_day": active_day,
            "day_order": day_order,
            "day_results": day_results,
            "overall_peak_bays": overall_peak_bays,
            "peak_day": peak_day,
            "charge_curve_id": charge_curve_id,
        }

        return response_data

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation failed: {str(e)}")


# not used in app
@app.get("/api/presets")
async def get_presets(total_sessions: int = 100):
    """Return available preset distributions from DayProfile class methods"""
    try:
        # Call the DayProfile class methods to get actual distributions
        flat_profile = DayProfile.flat(total_sessions)
        flat_profile.set_hourly_distribution_proportional()

        morning_profile = DayProfile.morning_peak(total_sessions)
        morning_profile.set_hourly_distribution_proportional()

        commuter_profile = DayProfile.commuter_double_peak(total_sessions)
        commuter_profile.set_hourly_distribution_proportional()

        office_sessions = [
            0,
            0,
            0,
            0,
            0,
            1,
            3,
            8,
            13,
            10,
            11,
            9,
            7,
            7,
            8,
            10,
            7,
            9,
            5,
            2,
            1,
            0,
            0,
            0,
        ]
        retail_sessions = [
            0,
            0,
            0,
            0,
            0,
            0,
            1,
            2,
            4,
            7,
            9,
            11,
            12,
            12,
            11,
            12,
            13,
            12,
            10,
            7,
            4,
            2,
            1,
            0,
        ]
        overnight_sessions = [
            10,
            9,
            8,
            7,
            6,
            4,
            3,
            2,
            2,
            3,
            4,
            5,
            5,
            5,
            5,
            5,
            5,
            6,
            7,
            8,
            9,
            10,
            11,
            11,
        ]

        return {
            "flat": flat_profile.hourly_distribution,
            "morning_peak": morning_profile.hourly_distribution,
            "commuter_double_peak": commuter_profile.hourly_distribution,
            "office": {
                "sessions": office_sessions,
                "proportion": _normalize(office_sessions),
            },
            "retail": {
                "sessions": retail_sessions,
                "proportion": _normalize(retail_sessions),
            },
            "overnight": {
                "sessions": overnight_sessions,
                "proportion": _normalize(overnight_sessions),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load presets: {str(e)}")


@app.get("/api/charge-curves")
async def get_charge_curves():
    """Return available DC charging model options for session duration modeling."""
    return {
        "curves": [
            {
                "id": "dc_fast",
                "label": "DC fast charging curve",
                "description": "DC-only stochastic charging model with non-linear SOC taper and battery-size-correlated peak power.",
            },
        ]
    }


# not used in app
@app.get("/api/example")
async def get_example():
    """Return example configuration for testing"""
    return {
        "profile": {
            "total_sessions": 100,
            "charge_curve_id": "dc_fast",
            "hourly_dist": [
                0.02,
                0.02,
                0.02,
                0.02,
                0.03,  # Hours 0-4 (night/early morning)
                0.05,
                0.06,
                0.07,
                0.08,
                0.08,  # Hours 5-9 (morning rush)
                0.08,
                0.08,
                0.07,
                0.06,
                0.05,  # Hours 10-14 (midday)
                0.06,
                0.07,
                0.08,
                0.08,
                0.07,  # Hours 15-19 (afternoon/evening)
                0.06,
                0.04,
                0.03,
                0.02,  # Hours 20-23 (night)
            ],
        },
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
