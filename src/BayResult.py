class BayResult:
    def __init__(self):
        self.baysPerHour: list = []
        self.peakBays: int = 0
        self.peakHour: int = 0
        self.utilByHour: list = []
        
    def getSummary(self):
        return f"Peak Bays: {self.peakBays} at Hour: {self.peakHour}\nBays Per Hour: {self.baysPerHour}\nUtilization By Hour: {self.utilByHour}"
    
    def toCSV(self):
        csv = "Hour,Bays,Utilization\n"
        for i in range(len(self.baysPerHour)):
            csv += f"{i},{self.baysPerHour[i]},{self.utilByHour[i]}\n"
        return csv