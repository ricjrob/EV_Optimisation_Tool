class DayProfile:
    def __init__(self, hourly_distribution: list[float], total_sessions_per_day: int):
        self.total_sessions_per_day = total_sessions_per_day
        self.hourly_distribution = hourly_distribution
        self.peakSessionsPerHour = 0

    def get_day_profile(self) -> list[float]:
        return self.hourly_distribution

    def get_total_sessions_per_day(self) -> int:
        return self.total_sessions_per_day

    def set_total_sessions(self, total_sessions: int) -> None:
        """Update the total sessions per day"""
        if total_sessions < 0:
            raise ValueError("Total sessions must be non-negative")
        self.total_sessions_per_day = total_sessions

    def get_peak_hour(self) -> int:
        peak_hour = 0
        for i in range(1, len(self.hourly_distribution)):
            if self.hourly_distribution[i] > self.hourly_distribution[peak_hour]:
                peak_hour = i
        return peak_hour

    def set_hourly_distribution_proportional(self, dist: list[float] = None):
        if dist is None:
            dist = self.hourly_distribution
        if len(dist) != 24:
            raise ValueError("Hourly distribution must have 24 values")
        total = sum(dist)
        if total == 0:
            raise ValueError("Distribution cannot be all zeros")
        self.hourly_distribution = [v / total for v in dist]
        if not self.validate_distribution():
            raise ValueError("Hourly distribution must sum to 1.0")

    def validate_distribution(self) -> bool:
        if len(self.hourly_distribution) != 24:
            return False
        if any(v < 0 for v in self.hourly_distribution):
            return False
        total = sum(self.hourly_distribution)
        if abs(total - 1.0) > 0.001:
            return False
        return True

    def set_hourly_distribution(self, raw: list[float]) -> None:
        if len(raw) != 24:
            raise ValueError("Hourly distribution must have 24 values")
        total = sum(raw)
        if total == 0:
            raise ValueError("Distribution cannot be all zeros")
        self.hourly_distribution = [v / total for v in raw]

    @classmethod
    def flat(cls, total_sessions: int) -> "DayProfile":
        hourly_distribution = [1 / 24] * 24
        return cls(hourly_distribution, total_sessions)

    @classmethod
    def morning_peak(cls, total_sessions: int) -> "DayProfile":
        hourly_distribution = [0.0] * 24
        for i in range(7, 10):
            hourly_distribution[i] = 0.1
        for i in range(10, 17):
            hourly_distribution[i] = 0.05
        leftover = 1.0 - sum(hourly_distribution)
        filled_hours = sum(1 for v in hourly_distribution if v > 0)
        for i in range(24):
            if hourly_distribution[i] == 0.0:
                hourly_distribution[i] = leftover / (24 - filled_hours)
        return cls(hourly_distribution, total_sessions)

    @classmethod
    def commuter_double_peak(cls, total_sessions: int) -> "DayProfile":
        hourly_distribution = [0.0] * 24
        for i in range(7, 10):
            hourly_distribution[i] = 0.1
        for i in range(16, 19):
            hourly_distribution[i] = 0.1
        leftover = 1.0 - sum(hourly_distribution)
        filled_hours = sum(1 for v in hourly_distribution if v > 0)
        for i in range(24):
            if hourly_distribution[i] == 0.0:
                hourly_distribution[i] = leftover / (24 - filled_hours)
        return cls(hourly_distribution, total_sessions)
