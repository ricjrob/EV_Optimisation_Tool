class DayProfile:
    def __init__(self, day_profile, totalSessionsPerDay):
        self.totalSessionsPerDay = totalSessionsPerDay
        self.dayProfile = day_profile
        self.peakHour = self.get_peak_hour()
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
    
    def setHourlyDistribution(self):
        hourlyDistribution = (self.get_total_sessions_per_day() / 24) * self.get_day_profile()
        self.hourlyDistribution = hourlyDistribution
        self.peakSessionsPerHour = self.hourlyDistribution[self.peakHour]

    def get_sessions_for_hour(self, hour: int) -> int:
        # Returns round(total_sessions * hourly_distribution[hour])
        # The only place the multiplication happens — keeps it consistent and allows for caching if needed
        pass

    def get_peak_hour(self) -> int:
        # Returns argmax of hourly_distribution
        # Cached after first call
        pass

    def validate_distribution(self) -> bool:
        # Checks len == 24, all values >= 0, sum within tolerance of 1.0
        # e.g. abs(sum(dist) - 1.0) < 0.001
        pass

    def set_hourly_distribution(self, raw: list[float]) -> None:
        total = sum(raw)
        if total == 0:
            raise ValueError("Distribution cannot be all zeros")
        self.hourly_distribution = [v / total for v in raw]
        self._invalidate_cache()

    @classmethod
    def flat(cls, total_sessions: int) -> "DayProfile":
        # Equal weight across all 24 hours
        pass


    @classmethod
    def morning_peak(cls, total_sessions: int) -> "DayProfile":
        # Heavy weighting 7–9am, moderate afternoon, quiet evenings 
        pass

    @classmethod
    def commuter_double_peak(cls, total_sessions: int) -> "DayProfile":
        # Twin peaks at 8am and 5–6pm, mirrors typical road traffic
        pass