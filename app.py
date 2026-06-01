from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from src.apiModel import apiModel
import uvicorn

app = FastAPI(title="EV Charging Bay Calculator", version="1.0.0")

# Serve static files (HTML, CSS, JS)
app.mount("/static", StaticFiles(directory="static"), name="static")


# Pydantic models for request/response
class ProfileConfig(BaseModel):
    total_sessions: int
    hourly_dist: list[float]


class CalculatorConfig(BaseModel):
    avg_service_time: float
    util_target: float
    safety_buffer: float


class CalculationRequest(BaseModel):
    profile: ProfileConfig
    calculator: CalculatorConfig


class BayResultResponse(BaseModel):
    hour: int
    sessions: int
    total_time: float
    throughput: float
    bays_needed: int


# Global model instance
model = apiModel()


@app.get("/")
async def serve_root():
    """Serve the main HTML page"""
    return FileResponse("static/index.html")


@app.post("/api/calculate")
async def calculate(request: CalculationRequest):
    """Calculate required bays based on profile and calculator settings"""
    try:
        # Set up the model
        model.set_profile(request.profile.total_sessions, request.profile.hourly_dist)
        model.set_calculator(
            request.calculator.avg_service_time,
            request.calculator.util_target,
            request.calculator.safety_buffer,
        )

        # Run calculation
        result = model.run()

        # Convert result to dictionary format
        # BayResult has: bays_per_hour, peak_bays, peak_hour, util_by_hour
        response_data = {
            "results": [
                {
                    "hour": hour,
                    "bays_needed": result.bays_per_hour[hour],
                    "utilisation": result.util_by_hour[hour],
                    "sessions": int(
                        request.profile.hourly_dist[hour]
                        * request.profile.total_sessions
                    ),
                }
                for hour in range(24)
            ],
            "peak_bays": result.peak_bays,
            "peak_hour": result.peak_hour,
            "summary": result.get_summary(),
        }

        return response_data

    except ValueError as e:
        return {"error": str(e)}, 400
    except Exception as e:
        return {"error": f"Calculation failed: {str(e)}"}, 500


@app.get("/api/example")
async def get_example():
    """Return example configuration for testing"""
    return {
        "profile": {
            "total_sessions": 100,
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
        "calculator": {
            "avg_service_time": 35.0,
            "util_target": 0.8,
            "safety_buffer": 0.15,
        },
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
