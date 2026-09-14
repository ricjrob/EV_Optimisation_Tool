from dataclasses import dataclass, asdict
from typing import Any


@dataclass
class PeakPowerNeeds:
    p90_kw: float
    p95_kw: float
    p99_kw: float
    single_vehicle_p90_kw: float
    single_vehicle_p95_kw: float
    single_vehicle_p99_kw: float
    concurrent_bays: int
    mean_kw: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class ChargerConfig:
    num_chargers: int
    max_kw_per_charger: float
    bays_per_charger: int

    def __post_init__(self):
        if self.num_chargers < 1:
            raise ValueError("Number of chargers must be at least 1")
        if self.max_kw_per_charger <= 0:
            raise ValueError("Max kW per charger must be positive")
        if self.bays_per_charger < 1:
            raise ValueError("Bays per charger must be at least 1")

    @property
    def total_bays(self) -> int:
        return self.num_chargers * self.bays_per_charger

    def to_dict(self) -> dict[str, Any]:
        return {
            "num_chargers": self.num_chargers,
            "max_kw_per_charger": self.max_kw_per_charger,
            "bays_per_charger": self.bays_per_charger,
            "total_bays": self.total_bays,
        }


@dataclass
class ChargerSimulationResult:
    num_chargers: int
    max_kw_per_charger: float
    bays_per_charger: int
    total_bays: int
    total_sessions: int
    delayed_sessions: float
    delayed_sessions_pct: float
    avg_unconstrained_dwell_min: float
    avg_constrained_dwell_min: float
    avg_dwell_extension_min: float
    avg_extension_for_delayed_min: float
    max_dwell_extension_min: float
    power_capped_minutes: float
    total_energy_kwh: float
    peak_power_kw: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
