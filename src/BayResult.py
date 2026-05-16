from dataclasses import dataclass

@dataclass(frozen=True)
class BayResult:
    def __init__(self, name, bases, dict, /, **kwds):
        pass
    bays_per_hour: list[int]      # raw calculated bays for each of 24 hours
    peak_bays: int                 # buffered peak — the headline recommendation
    peak_hour: int                 # hour index (0–23) where peak occurs
    util_by_hour: list[float]     # implied utilisation per hour (0.0–1.0)   
        
    def get_summary(self) -> str:
        # Human-readable one-liner for the UI header
        # e.g. "Peak demand of 8 bays at 08:00, recommended provision: 9 bays"
        peak_label = self.get_hour_label(self.peak_hour)
        raw_peak = self.bays_per_hour[self.peak_hour]
        return (
            f"Peak demand of {raw_peak} bays at {peak_label}. "
            f"Recommended provision (with buffer): {self.peak_bays} bays."
        )
    
    def to_csv(self) -> str:
        # Hour-by-hour table: hour, sessions, bays, utilisation
        # Ready to write to file or copy-paste into Excel
        pass

    def get_hour_label(self, hour: int) -> str:
        # Converts 0–23 index to "00:00", "08:00" etc. for display
        pass

    def is_peak_hour(self, hour: int) -> bool:
        # True if this hour equals peak_hour — useful for highlighting in UI
        pass