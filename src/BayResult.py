from dataclasses import dataclass, field


@dataclass(frozen=True)
class BayResult:
    bays_per_hour: list[int]
    peak_bays: int
    peak_hour: int
    util_by_hour: list[float]
    soc_samples: list[float] = field(default_factory=list)
    duration_samples: list[float] = field(default_factory=list)

    def get_summary(self) -> str:
        # Human-readable one-liner for the UI header
        # e.g. "Peak demand of 8 bays at 08:00, recommended provision: 9 bays"
        peak_label = self.get_hour_label(self.peak_hour)
        raw_peak = self.bays_per_hour[self.peak_hour]
        return (
            f"Peak demand of {raw_peak} bays at {peak_label}. "
            f"Recommended provision (with buffer): {self.peak_bays} bays."
        )

    # not used in app
    def to_csv(self) -> str:
        rows = ["hour,bays_required,utilisation"]
        for hour, (bays, util) in enumerate(zip(self.bays_per_hour, self.util_by_hour)):
            rows.append(f"{hour},{bays},{util:.6f}")
        return "\n".join(rows)

    # not used in app
    def get_hour_label(self, hour: int) -> str:
        if hour < 0 or hour > 23:
            raise ValueError("hour must be between 0 and 23")
        return f"{hour:02d}:00"

    # not used in app
    def is_peak_hour(self, hour: int) -> bool:
        return hour == self.peak_hour
