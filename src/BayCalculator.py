from .BayResult import BayResult
from . import DayProfile


class BayCalculator:
    def __init__(
        self,
        avg_service_time: float = 2.0,
        util_target: float = 0.85,
        safety_buffer: float = 1.1,
    ):
        self.avg_service_time = avg_service_time
        self.util_target = util_target
        self.safety_buffer = safety_buffer
        # no result stored here

    def calc_all_hours(self, profile: DayProfile) -> BayResult:
        # compute and return directly, don't assign to self
        ...
        return BayResult(...)

    def calcBaysPerHour(self, dayProfile: DayProfile):
        dayProfile.setHourlyDistribution()
        for i in range(24):
            sessionsThisHour = dayProfile.hourlyDistribution[i]
            baysThisHour = (sessionsThisHour * self.avg_service_time) / 60
            self.result.baysPerHour.append(baysThisHour)
            if baysThisHour > self.result.peakBays:
                self.result.peakBays = baysThisHour
                self.result.peakHour = i

    def getPeakBays(self):
        return self.result.peakBays

    def applyBuffer(self):
        self.result.peakBays += (self.safety_buffer / 60) * self.result.peakBays
