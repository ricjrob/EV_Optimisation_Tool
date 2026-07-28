import math
import random
from .BayResult import BayResult
from .DayProfile import DayProfile


class BayCalculator:
    CURVE_PRESETS = {
        "legacy": {
            "description": "Average service time plus entry/exit buffer",
        },
        "ac_l2": {
            "description": "AC Level 2 session profile with gradual taper",
            "cc_soc": 0.72,
            "cc_rate_soc_per_min": 0.009,
            "taper_k": 4.0,
            "duration_scale": 1.15,
            "duration_jitter": 0.12,
        },
        "dc_fast": {
            "description": "DC fast charging profile with faster constant-power phase",
            "cc_soc": 0.80,
            "cc_rate_soc_per_min": 0.028,
            "taper_k": 6.5,
            "duration_scale": 0.78,
            "duration_jitter": 0.10,
        },
    }

    def __init__(
        self,
        avg_service_time: float = 0.5,
        safety_buffer: float = 0.05,
        buffer_mean_minutes: float = 4.0,
        buffer_stddev_minutes: float = 1.0,
        charge_curve_id: str | None = None,
        session_mix: dict[str, float] | None = None,
    ):
        self.avg_service_time = avg_service_time
        self.safety_buffer = safety_buffer
        self.buffer_mean_minutes = buffer_mean_minutes
        self.buffer_stddev_minutes = buffer_stddev_minutes
        self.charge_curve_id = (charge_curve_id or "legacy").lower()
        self.session_mix = session_mix or {}

    def _draw_buffer_minutes(self) -> float:
        buffer_minutes = random.gauss(
            self.buffer_mean_minutes, self.buffer_stddev_minutes
        )
        return max(0.0, buffer_minutes)

    def _draw_soc_pair(self) -> tuple[float, float]:
        # Keep SOC draws conservative so generated sessions are realistic for public charging.
        initial_soc = random.betavariate(2.2, 4.8)
        target_soc = random.uniform(0.75, 0.9)
        if target_soc <= initial_soc:
            target_soc = min(0.95, initial_soc + 0.1)
        return initial_soc, target_soc

    def _sample_curve_duration_minutes(self, curve_id: str) -> float:
        if curve_id == "legacy":
            return self.avg_service_time + self._draw_buffer_minutes()

        curve = self.CURVE_PRESETS.get(curve_id)
        if curve is None:
            return self.avg_service_time + self._draw_buffer_minutes()

        initial_soc, target_soc = self._draw_soc_pair()
        cc_soc = curve["cc_soc"]
        cc_rate = curve["cc_rate_soc_per_min"]
        taper_k = curve["taper_k"]

        if target_soc <= cc_soc:
            base_minutes = (target_soc - initial_soc) / cc_rate
        else:
            cc_start_soc = min(initial_soc, cc_soc)
            cc_minutes = max(0.0, (cc_soc - cc_start_soc) / cc_rate)
            taper_start = max(1e-4, 1.0 - cc_soc)
            taper_end = max(1e-4, 1.0 - target_soc)
            taper_minutes = max(
                0.0, (math.log(taper_start) - math.log(taper_end)) / taper_k
            )
            base_minutes = cc_minutes + taper_minutes

        scaled_minutes = base_minutes * curve["duration_scale"]
        duration_jitter = random.gauss(1.0, curve["duration_jitter"])
        jittered_minutes = scaled_minutes * max(0.7, duration_jitter)

        # Calibrate curve outputs around avg_service_time so existing defaults remain intuitive.
        reference_minutes = 55.0 if curve_id == "ac_l2" else 28.0
        calibration = self.avg_service_time / reference_minutes
        calibrated_minutes = jittered_minutes * max(0.5, calibration)

        return max(5.0, calibrated_minutes + self._draw_buffer_minutes())

    def _resolve_curve_id(self) -> str:
        if self.charge_curve_id == "mixed":
            dc_weight = float(self.session_mix.get("dc_fast", 0.4))
            ac_weight = float(self.session_mix.get("ac_l2", 1.0 - dc_weight))
            dc_weight = max(0.0, dc_weight)
            ac_weight = max(0.0, ac_weight)
            total = dc_weight + ac_weight
            if total <= 0:
                return "legacy"
            pick = random.random() * total
            return "dc_fast" if pick <= dc_weight else "ac_l2"

        if self.charge_curve_id in self.CURVE_PRESETS:
            return self.charge_curve_id
        return "legacy"

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
        peak_bays = 0
        peak_hour = 0

        for hour, sessions in enumerate(hourly_sessions):
            session_count = max(0, int(round(sessions)))
            required_bay_hours = 0.0
            for _ in range(session_count):
                curve_id = self._resolve_curve_id()
                session_minutes = self._sample_curve_duration_minutes(curve_id)
                required_bay_hours += session_minutes / 60.0

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
        )
