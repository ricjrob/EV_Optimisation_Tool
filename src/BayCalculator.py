class BayCalculator:
    def __init__(self):
        self.avgDwellTime = 30 # in minutes
        self.safetyBuffer = 5 # in minutes
        self.result = BayResult()
        self.utilResult = 0.0
    
    def calcBaysPerHour(self, dayProfile: DayProfile):
        dayProfile.setHourlyDistribution()
        for i in range(24):
            sessionsThisHour = dayProfile.hourlyDistribution[i]
            baysThisHour = (sessionsThisHour * self.avgDwellTime) / 60
            self.result.baysPerHour.append(baysThisHour)
            if baysThisHour > self.result.peakBays:
                self.result.peakBays = baysThisHour
                self.result.peakHour = i
    
    def calcAllHours(self, dayProfile: DayProfile):
        self.calcBaysPerHour(dayProfile)
        for i in range(24):
            self.result.utilByHour.append((self.result.baysPerHour[i] / self.result.peakBays) * 100)
    
    def getPeakBays(self):
        return self.result.peakBays
    
    def applyBuffer(self):
        self.result.peakBays += (self.safetyBuffer / 60) * self.result.peakBays