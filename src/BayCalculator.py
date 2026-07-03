import math
from .BayResult import BayResult
from .DayProfile import DayProfile


class BayCalculator:
    def __init__(
        self,
        avg_service_time: float = 0.5,
        safety_buffer: float = 0.05,
    ):
        self.avg_service_time = avg_service_time
        self.safety_buffer = safety_buffer

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
            required_bay_hours = sessions * (self.avg_service_time / 60.0)
            raw_bays = required_bay_hours
            buffered_bays = math.ceil(raw_bays * (1 + self.safety_buffer))
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
