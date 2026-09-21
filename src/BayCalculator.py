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
            "battery_kwh_std": 18.0,
            "battery_kwh_min": 35.0,
            "battery_kwh_max": 120.0,
            "peak_kw_intercept": -30.0,
            "peak_kw_slope": 2.2,
            "peak_kw_std": 60.0,
            "peak_kw_min": 45.0,
            "peak_kw_max": 340.0,
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
        buffer_mean_minutes: float = 4.0,
        buffer_stddev_minutes: float = 1.0,
        charge_curve_id: str | None = None,
        curve_preset: dict[str, float] | None = None,
    ):
        self.buffer_mean_minutes = buffer_mean_minutes
        self.buffer_stddev_minutes = buffer_stddev_minutes
        # Model is now DC-only. Keep incoming parameter for backward compatibility.
        self.charge_curve_id = "dc_fast"
        self.curve_preset = self._build_curve_preset(curve_preset)

    def _build_curve_preset(self, overrides: dict[str, float] | None) -> dict:
        curve = self.CURVE_PRESETS["dc_fast"].copy()
        if overrides:
            unknown_keys = set(overrides) - set(curve)
            if unknown_keys:
                raise ValueError(
                    f"Unknown curve preset parameters: {sorted(unknown_keys)}"
                )
            curve.update(overrides)

        if any(
            not isinstance(value, (int, float)) or not math.isfinite(value)
            for value in curve.values()
            if not isinstance(value, str)
        ):
            raise ValueError("Curve preset values must be finite numbers")
        if (
            curve["battery_kwh_min"] <= 0
            or curve["battery_kwh_max"] < curve["battery_kwh_min"]
        ):
            raise ValueError("Battery capacity bounds must be positive and ordered")
        if curve["peak_kw_min"] <= 0 or curve["peak_kw_max"] < curve["peak_kw_min"]:
            raise ValueError("Peak power bounds must be positive and ordered")
        if curve["low_soc_tau"] <= 0 or curve["taper_width"] <= 0:
            raise ValueError("SOC curve widths must be positive")
        if not 0 < curve["efficiency"] <= 1:
            raise ValueError("Efficiency must be greater than 0 and at most 1")
        if curve["duration_scale"] <= 0 or curve["duration_jitter"] < 0:
            raise ValueError(
                "Duration scale must be positive and jitter cannot be negative"
            )
        if not 0 <= curve["min_power_fraction"] <= 1:
            raise ValueError("Minimum power fraction must be between 0 and 1")
        return curve

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

    def _sample_time_weighted_power_kw(self, curve: dict) -> float:
        """Sample a vehicle's actual instantaneous draw (kW) at a random moment
        during its charging session, weighted by how long it spends at each SOC.

        A vehicle's real-time power depends on where it is in the SOC taper, not
        its theoretical peak_kw. Sampling proportionally to time-in-state means a
        fleet snapshot correctly reflects that most plugged-in vehicles are
        tapering rather than all drawing their maximum simultaneously.
        """
        battery_kwh = self._sample_battery_kwh(curve)
        peak_kw = self._sample_peak_kw(curve, battery_kwh)
        initial_soc, target_soc = self._draw_soc_pair_for_curve("dc_fast")
        efficiency = max(0.75, min(0.99, curve["efficiency"]))

        soc = self._clip(initial_soc, 0.0, 0.99)
        target = self._clip(target_soc, soc + 1e-4, 0.995)
        step_soc = 0.01

        durations_hours = []
        powers_kw = []
        while soc < target:
            next_soc = min(target, soc + step_soc)
            mean_soc = 0.5 * (soc + next_soc)
            power_fraction = self._power_fraction_at_soc(curve, mean_soc)
            power_kw = max(0.1, peak_kw * power_fraction)
            energy_kwh = battery_kwh * (next_soc - soc)
            durations_hours.append(energy_kwh / (power_kw * efficiency))
            powers_kw.append(power_kw)
            soc = next_soc

        total_duration = sum(durations_hours)
        if total_duration <= 0:
            return peak_kw

        pick = random.random() * total_duration
        cumulative = 0.0
        for duration, power_kw in zip(durations_hours, powers_kw):
            cumulative += duration
            if pick <= cumulative:
                return power_kw
        return powers_kw[-1]

    def sample_instantaneous_power_kw(self, curve_id: str = "dc_fast") -> float:
        """Public sampler for a single vehicle's realistic instantaneous power draw."""
        return self._sample_time_weighted_power_kw(self.curve_preset)

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

    def _simulate_soc_session(
        self,
        curve: dict,
        initial_soc: float,
        target_soc: float,
        battery_kwh: float | None = None,
        peak_kw: float | None = None,
        apply_jitter: bool = True,
    ) -> tuple[float, float]:
        """Simulate one session; returns (duration_minutes, energy_kwh_delivered).

        battery_kwh/peak_kw can be supplied so a baseline (unconstrained) run
        matches the exact vehicle used elsewhere for the same session, rather
        than an independently re-sampled vehicle. apply_jitter=False yields a
        pure physics-based duration comparable to a per-timestep simulation
        that has no random human-factor jitter of its own.
        """
        if battery_kwh is None:
            battery_kwh = self._sample_battery_kwh(curve)
        if peak_kw is None:
            peak_kw = self._sample_peak_kw(curve, battery_kwh)
        efficiency = max(0.75, min(0.99, curve["efficiency"]))

        soc = self._clip(initial_soc, 0.0, 0.99)
        target = self._clip(target_soc, soc + 1e-4, 0.995)
        step_soc = 0.01
        total_hours = 0.0
        total_energy_kwh = 0.0

        while soc < target:
            next_soc = min(target, soc + step_soc)
            mean_soc = 0.5 * (soc + next_soc)
            power_fraction = self._power_fraction_at_soc(curve, mean_soc)
            power_kw = max(0.1, peak_kw * power_fraction)
            energy_kwh = battery_kwh * (next_soc - soc)
            total_hours += energy_kwh / (power_kw * efficiency)
            total_energy_kwh += energy_kwh
            soc = next_soc

        scaled_minutes = total_hours * 60.0 * curve["duration_scale"]
        duration_jitter = (
            max(0.65, random.gauss(1.0, curve["duration_jitter"]))
            if apply_jitter
            else 1.0
        )
        return max(4.0, scaled_minutes * duration_jitter), total_energy_kwh

    def _simulate_soc_duration_minutes(
        self,
        curve: dict,
        initial_soc: float,
        target_soc: float,
    ) -> float:
        minutes, _ = self._simulate_soc_session(curve, initial_soc, target_soc)
        return minutes

    def sample_session(self) -> tuple[float, float]:
        """Public sampler used by investment analysis.

        Returns (total_occupancy_minutes_incl_buffer, energy_kwh_delivered)
        for a single DC fast-charge session.
        """
        curve = self.curve_preset
        initial_soc, target_soc = self._draw_soc_pair_for_curve("dc_fast")
        minutes, energy_kwh = self._simulate_soc_session(curve, initial_soc, target_soc)
        return minutes + self._draw_buffer_minutes(), energy_kwh

    def _sample_empirical_curve_duration_minutes(self, curve_id: str) -> float:
        if curve_id != "dc_fast":
            return self._draw_buffer_minutes()
        curve = self.curve_preset

        initial_soc, target_soc = self._draw_soc_pair_for_curve(curve_id)
        minutes = self._simulate_soc_duration_minutes(curve, initial_soc, target_soc)
        return minutes + self._draw_buffer_minutes()

    def _sample_with_soc(self, curve_id: str) -> tuple[float, float]:
        """Returns (duration_minutes, arrival_soc)."""
        if curve_id != "dc_fast":
            return self._draw_buffer_minutes(), 0.5
        curve = self.curve_preset
        initial_soc, target_soc = self._draw_soc_pair_for_curve(curve_id)
        minutes = self._simulate_soc_duration_minutes(curve, initial_soc, target_soc)
        return minutes + self._draw_buffer_minutes(), initial_soc

    def _sample_curve_duration_minutes(self, curve_id: str) -> float:
        if curve_id == "dc_fast":
            return self._sample_empirical_curve_duration_minutes(curve_id)
        return self._draw_buffer_minutes()

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
