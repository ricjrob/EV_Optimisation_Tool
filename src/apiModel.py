from BayCalculator import BayCalculator
from DayProfile import DayProfile

class apiModel:
    def __init__(self, name, description, parameters):
        self.profile = DayProfile(parameters['dayProfile'], parameters['totalSessionsPerDay'])
        self.calculator = BayCalculator()
    
    def run(self):
        self.calculator.calcAllHours(self.profile)
        self.calculator.applyBuffer()
        return self.calculator.result.getSummary()
    
    def setProfile(self, dayProfile, totalSessionsPerDay):
        #validate dayProfile adds up to 1 and totalSessionsPerDay is a positive integer
        if not all(isinstance(x, (int, float)) and x >= 0 for x in dayProfile):
            raise ValueError("dayProfile must be a list of non-negative numbers")
        if sum(dayProfile) != 1:
            raise ValueError("dayProfile must add up to 1")
        if not isinstance(totalSessionsPerDay, int) or totalSessionsPerDay <= 0:
            raise ValueError("totalSessionsPerDay must be a positive integer")  
        self.profile = DayProfile(dayProfile, totalSessionsPerDay)  

    def setCalculator(self, avgDwellTime, safetyBuffer):
        #validate avgDwellTime is a positive number and does not exceed 600 and safetyBuffer is a non-negative number and is not greater than the avgDwellTime
        if not isinstance(avgDwellTime, (int, float)) or avgDwellTime <= 0 or avgDwellTime > 600:
            raise ValueError("avgDwellTime must be a positive number not exceeding 600")
        if not isinstance(safetyBuffer, (int, float)) or safetyBuffer < 0 or safetyBuffer > avgDwellTime:
            raise ValueError("safetyBuffer must be a non-negative number not greater than avgDwellTime")
        self.calculator.avgDwellTime = avgDwellTime
        self.calculator.safetyBuffer = safetyBuffer 
