import math
import random
from typing import ClassVar
from .BayResult import BayResult
from .DayProfile import DayProfile


class BayCalculator:
    CURVE_PRESETS: ClassVar[dict[str, dict]] = {
        "dc_fast": {
            "description": "DC fast profile with battery-size-correlated peak and taper",
            "battery_kwh_mean": 72.0,
            "battery_kwh_std": 16.0,
            "battery_kwh_min": 35.0,
            "battery_kwh_max": 130.0,
            "peak_kw_intercept": -8.0,
            "peak_kw_slope": 2.75,
            "peak_kw_std": 24.0,
            "peak_kw_min": 45.0,
            "peak_kw_max": 360.0,
            "low_soc_floor": 0.70,
            "low_soc_tau": 0.040,
            "taper_mid_soc": 0.64,
            "taper_width": 0.11,
            "min_power_fraction": 0.14,
            "efficiency": 0.94,
            "duration_scale": 1.00,
            "duration_jitter": 0.12,
        },
    }

    def __init__(
        self,
        avg_service_time: float = 0.5,
        safety_buffer: float = 0.05,
        buffer_mean_minutes: float = 4.0,
        buffer_stddev_minutes: float = 1.0,
        charge_curve_id: str | None = None,
    ):
        self.avg_service_time = avg_service_time
        self.safety_buffer = safety_buffer
        self.buffer_mean_minutes = buffer_mean_minutes
        self.buffer_stddev_minutes = buffer_stddev_minutes
        # Model is now DC-only. Keep incoming parameter for backward compatibility.
        self.charge_curve_id = "dc_fast"

    def _draw_buffer_minutes(self) -> float:
        buffer_minutes = random.gauss(
            self.buffer_mean_minutes, self.buffer_stddev_minutes
        )
        return max(0.0, buffer_minutes)

    def _draw_soc_pair_for_curve(self, curve_id: str) -> tuple[float, float]:
        initial_soc = min(0.78, random.betavariate(2.0, 4.6))
        target_soc = random.uniform(0.62, 0.88)

        if target_soc <= initial_soc:
            target_soc = min(0.98, initial_soc + random.uniform(0.08, 0.24))
        return initial_soc, target_soc

    @staticmethod
    def _clip(value: float, low: float, high: float) -> float:
        return max(low, min(high, value))

    def _sample_battery_kwh(self, curve: dict) -> float:
        battery_kwh = random.gauss(curve["battery_kwh_mean"], curve["battery_kwh_std"])
        return self._clip(
            battery_kwh,
            curve["battery_kwh_min"],
            curve["battery_kwh_max"],
        )

    def _sample_peak_kw(self, curve: dict, battery_kwh: float) -> float:
        peak_kw = random.gauss(
            curve["peak_kw_intercept"] + curve["peak_kw_slope"] * battery_kwh,
            curve["peak_kw_std"],
        )
        return self._clip(peak_kw, curve["peak_kw_min"], curve["peak_kw_max"])

    def _power_fraction_at_soc(self, curve: dict, soc: float) -> float:
        # Low SOC behavior ramps quickly to a plateau rather than linearly.
        low_soc_floor = curve["low_soc_floor"]
        low_soc_tau = max(1e-4, curve["low_soc_tau"])
        low_soc_factor = low_soc_floor + (1.0 - low_soc_floor) * (
            1.0 - math.exp(-soc / low_soc_tau)
        )

        taper_mid = curve["taper_mid_soc"]
        taper_width = max(1e-4, curve["taper_width"])
        taper_factor = 1.0 / (1.0 + math.exp((soc - taper_mid) / taper_width))

        min_fraction = curve["min_power_fraction"]
        fraction = low_soc_factor * taper_factor
        return self._clip(fraction, min_fraction, 1.0)

    def _simulate_soc_duration_minutes(
        self,
        curve: dict,
        initial_soc: float,
        target_soc: float,
    ) -> float:
        battery_kwh = self._sample_battery_kwh(curve)
        peak_kw = self._sample_peak_kw(curve, battery_kwh)
        efficiency = max(0.75, min(0.99, curve["efficiency"]))

        soc = self._clip(initial_soc, 0.0, 0.99)
        target = self._clip(target_soc, soc + 1e-4, 0.995)
        step_soc = 0.01
        total_hours = 0.0

        while soc < target:
            next_soc = min(target, soc + step_soc)
            mean_soc = 0.5 * (soc + next_soc)
            power_fraction = self._power_fraction_at_soc(curve, mean_soc)
            power_kw = max(0.1, peak_kw * power_fraction)
            energy_kwh = battery_kwh * (next_soc - soc)
            total_hours += energy_kwh / (power_kw * efficiency)
            soc = next_soc

        scaled_minutes = total_hours * 60.0 * curve["duration_scale"]
        duration_jitter = max(0.65, random.gauss(1.0, curve["duration_jitter"]))
        return max(4.0, scaled_minutes * duration_jitter)

    def _sample_empirical_curve_duration_minutes(self, curve_id: str) -> float:
        curve = self.CURVE_PRESETS.get(curve_id)
        if curve is None:
            return self.avg_service_time + self._draw_buffer_minutes()

        initial_soc, target_soc = self._draw_soc_pair_for_curve(curve_id)
        minutes = self._simulate_soc_duration_minutes(curve, initial_soc, target_soc)
        return minutes + self._draw_buffer_minutes()

    def _sample_with_soc(self, curve_id: str) -> tuple[float, float]:
        """Returns (duration_minutes, arrival_soc)."""
        curve = self.CURVE_PRESETS.get(curve_id)
        if curve is None:
            return self.avg_service_time + self._draw_buffer_minutes(), 0.5
        initial_soc, target_soc = self._draw_soc_pair_for_curve(curve_id)
        minutes = self._simulate_soc_duration_minutes(curve, initial_soc, target_soc)
        return minutes + self._draw_buffer_minutes(), initial_soc

    def _sample_curve_duration_minutes(self, curve_id: str) -> float:
        if curve_id == "dc_fast":
            return self._sample_empirical_curve_duration_minutes(curve_id)
        return self.avg_service_time + self._draw_buffer_minutes()

    def _resolve_curve_id(self) -> str:
        return "dc_fast"

    def calc_all_hours(self, profile: DayProfile) -> BayResult:
        profile.set_hourly_distribution_proportional()

        if not profile.validate_distribution():
            raise ValueError(
                "Hourly distribution must sum to 1.0 and contain 24 non-negative values"
            )

        hourly_sessions = [
            p * profile.get_total_sessions_per_day() for p in profile.get_day_profile()
        ]
        bays_per_hour = []
        util_by_hour = []
        soc_samples: list[float] = []
        duration_samples: list[float] = []
        peak_bays = 0
        peak_hour = 0

        for hour, sessions in enumerate(hourly_sessions):
            session_count = max(0, round(sessions))
            required_bay_hours = 0.0
            for _ in range(session_count):
                curve_id = self._resolve_curve_id()
                session_minutes, arrival_soc = self._sample_with_soc(curve_id)
                required_bay_hours += session_minutes / 60.0
                soc_samples.append(round(arrival_soc, 4))
                duration_samples.append(round(session_minutes, 2))

            raw_bays = required_bay_hours
            buffered_bays = math.ceil(raw_bays)
            bays_per_hour.append(int(buffered_bays))

            util = 0.0
            if buffered_bays > 0:
                util = min(required_bay_hours / buffered_bays, 1.0)
            util_by_hour.append(util)

            if buffered_bays > peak_bays:
                peak_bays = buffered_bays
                peak_hour = hour

        return BayResult(
            bays_per_hour=bays_per_hour,
            peak_bays=peak_bays,
            peak_hour=peak_hour,
            util_by_hour=util_by_hour,
            soc_samples=soc_samples,
            duration_samples=duration_samples,
        )
