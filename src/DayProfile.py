class DayProfile:
    def __init__(self, day_profile, totalSessionsPerDay):
        self.total_sessions_per_day = totalSessionsPerDay
        self.hourly_distribution = day_profile
        self.peakSessionsPerHour = 0

    def get_day_profile(self):
        return self.dayProfile

    def get_total_sessions_per_day(self):
        return self.totalSessionsPerDay

    def get_peak_hour(self: int):
        peakHour = 0
        for i in range(1, len(self.dayProfile)):
            if self.dayProfile[i] > self.dayProfile[peakHour]:
                peakHour = i
        return peakHour

    def set_hourly_distribution_proportional(self, dist: list[float] = None):
        if dist is None:
            hourlyDistribution = (
                self.get_total_sessions_per_day() / 24
            ) * self.get_day_profile()
        else:
            hourlyDistribution = dist
        self.hourlyDistribution = hourlyDistribution
        self.validate_distribution()

    def validate_distribution(self) -> bool:
        # Checks len == 24, all values >= 0, sum within tolerance of 1.0
        # e.g. abs(sum(dist) - 1.0) < 0.001
        if len(self.dayProfile) != 24:
            return False
        if any(v < 0 for v in self.dayProfile):
            return False
        total = sum(self.dayProfile)
        if abs(total - 1.0) > 0.001:
            return False
        return True

    def set_hourly_distribution(self, raw: list[float]) -> None:
        total = sum(raw)
        if total == 0:
            raise ValueError("Distribution cannot be all zeros")
        self.hourly_distribution = [v / total for v in raw]
        self._invalidate_cache()

    @classmethod
    def flat(cls, total_sessions: int) -> "DayProfile":
        # Equal weight across all 24 hours
        hourly_distribution = [total_sessions / 24] * 24
        return cls(hourly_distribution, total_sessions)

    @classmethod
    def morning_peak(cls, total_sessions: int) -> "DayProfile":
        # Heavy weighting 7–9am, moderate afternoon, quiet evenings
        hourly_distribution = [0.0] * 24  # Start with flat zero distribution
        for i in range(7, 10):
            hourly_distribution[i] = 0.1  # 10% in each of these hours
        for i in range(10, 17):
            hourly_distribution[i] = 0.05  # 5% in each of these hours
        # Remaining hours are split flat from the leftover percentage
        leftover = 1.0 - sum(hourly_distribution)
        filled_hours = sum(1 for v in hourly_distribution if v > 0)
        for i in range(24):
            if hourly_distribution[i] == 0.0:
                hourly_distribution[i] = leftover / (
                    24 - filled_hours
                )  # Distribute leftover evenly
        return cls(hourly_distribution, total_sessions)

    @classmethod
    def commuter_double_peak(cls, total_sessions: int) -> "DayProfile":
        # Twin peaks at 8am and 5–6pm, mirrors typical road traffic
        hourly_distribution = [0.0] * 24
        for i in range(7, 10):
            hourly_distribution[i] = 0.1  # Morning peak
        for i in range(16, 19):
            hourly_distribution[i] = 0.1  # Evening peak
        # Remaining hours get flat distribution of leftover percentage
        leftover = 1.0 - sum(hourly_distribution)
        filled_hours = sum(1 for v in hourly_distribution if v > 0)
        for i in range(24):
            if hourly_distribution[i] == 0.0:
                hourly_distribution[i] = leftover / (
                    24 - filled_hours
                )  # Distribute leftover evenly
        return cls(hourly_distribution, total_sessions)
