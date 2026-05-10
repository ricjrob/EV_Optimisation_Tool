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