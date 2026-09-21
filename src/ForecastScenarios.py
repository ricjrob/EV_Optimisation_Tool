"""Ten-year demand forecast scenarios for EV charging bay sizing.

This module does not change the existing simulation logic in
`BayCalculator`, `DayProfile`, or `InvestmentCalculator`. Each year it derives
new arrival-rate and dwell-time parameter values from the scenario
assumptions and feeds them into those existing components unchanged.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass

import pandas as pd

from .BayCalculator import BayCalculator
from .DayProfile import DayProfile
from .InvestmentCalculator import InvestmentCalculator

HORIZON_YEARS = 10

# Dwell-time variance level -> duration_jitter fed straight into BayCalculator's
# existing curve preset (higher = less predictable session length).
_DWELL_VARIANCE_JITTER = {
    "low": 0.06,
    "moderate": 0.12,
    "high": 0.22,
}


@dataclass(frozen=True)
class Scenario:
    """Ten-year demand-evolution assumptions for one forecast scenario."""

    name: str
    growth_schedule: tuple[
        tuple[int, float], ...
    ]  # (years_at_rate, annual peak-arrival growth rate)
    dwell_time_decline: float  # annual fractional decline in dwell time
    dwell_time_variance: str  # "low" | "moderate" | "high"
    clustering_factor: float  # >1 concentrates arrivals more tightly on the peak hour
    soc_on_arrival_shift_pp: (
        float  # tracked metadata only; no lever exists in BayCalculator for this
    )
    service_level_target: float = 0.95
    charger_power_kw: float = 150.0
    bay_count: int = 10

    def growth_rate_for_year(self, year: int) -> float:
        """Annual peak-arrival growth rate applicable to the given year (1-10)."""
        remaining = year
        for years_at_rate, rate in self.growth_schedule:
            if remaining <= years_at_rate:
                return rate
            remaining -= years_at_rate
        return self.growth_schedule[-1][1]

    def compounded_growth_through_year(self, year: int) -> float:
        """Cumulative growth multiplier from year 0 to `year`, compounding each
        year at the rate applicable to it (correctly handles rate changes
        partway through the schedule, e.g. 7 years at one rate then 3 at another)."""
        multiplier = 1.0
        for y in range(1, year + 1):
            multiplier *= 1.0 + self.growth_rate_for_year(y)
        return multiplier


SCENARIOS: dict[str, Scenario] = {
    "government_policy_drift": Scenario(
        name="Government Policy Drift (downside)",
        growth_schedule=((10, 0.05),),
        dwell_time_decline=0.015,
        dwell_time_variance="high",
        clustering_factor=1.0,
        soc_on_arrival_shift_pp=4.0,
    ),
    "steady_mandate": Scenario(
        name="Steady Mandate (base case)",
        growth_schedule=((7, 0.135), (3, 0.05)),
        dwell_time_decline=0.05,
        dwell_time_variance="moderate",
        clustering_factor=1.15,
        soc_on_arrival_shift_pp=-2.0,
    ),
    "accelerated_adoption": Scenario(
        name="Accelerated Adoption (upside)",
        growth_schedule=((5, 0.19), (5, 0.11)),
        dwell_time_decline=0.08,
        dwell_time_variance="low",
        clustering_factor=1.35,
        soc_on_arrival_shift_pp=-6.0,
    ),
}


@dataclass
class SimModel:
    """Wraps the existing simulation components for a single site/profile."""

    base_profile: DayProfile
    calculator: BayCalculator
    bay_count: int
    simulation_runs: int = 30


def _apply_clustering(
    hourly_distribution: list[float], clustering_factor: float
) -> list[float]:
    """Reshapes the hourly distribution fed into DayProfile to concentrate mass
    around the peak hour; does not touch DayProfile's own validation/logic."""
    if clustering_factor == 1.0:
        return list(hourly_distribution)
    reshaped = [p ** (1.0 / clustering_factor) for p in hourly_distribution]
    total = sum(reshaped)
    return [p / total for p in reshaped]


def _year_profile(
    base_profile: DayProfile, scenario: Scenario, year: int
) -> DayProfile:
    compounded_growth = scenario.compounded_growth_through_year(year)
    total_sessions = round(
        base_profile.get_total_sessions_per_day() * compounded_growth
    )
    clustered_dist = _apply_clustering(
        base_profile.get_day_profile(), scenario.clustering_factor
    )
    return DayProfile(clustered_dist, total_sessions)


def _year_curve_overrides(
    base_calculator: BayCalculator, scenario: Scenario, year: int
) -> dict[str, float]:
    dwell_multiplier = max(0.1, (1.0 - scenario.dwell_time_decline) ** year)
    overrides = dict(base_calculator.curve_preset)
    overrides["duration_scale"] = overrides["duration_scale"] * dwell_multiplier
    overrides["duration_jitter"] = _DWELL_VARIANCE_JITTER[scenario.dwell_time_variance]
    return overrides


def run_scenario(sim_model: SimModel, scenario_params: Scenario) -> list[dict]:
    """Runs the existing peak-hour queue/loss simulation for years 1-10 under a
    scenario. charger_power_kw and bay_count are held fixed for the horizon;
    only arrival rate and dwell-time parameters evolve year over year.
    """
    results: list[dict] = []

    for year in range(1, HORIZON_YEARS + 1):
        year_profile = _year_profile(sim_model.base_profile, scenario_params, year)
        curve_overrides = _year_curve_overrides(
            sim_model.calculator, scenario_params, year
        )

        year_calculator = BayCalculator(
            buffer_mean_minutes=sim_model.calculator.buffer_mean_minutes,
            buffer_stddev_minutes=sim_model.calculator.buffer_stddev_minutes,
            curve_preset=curve_overrides,
        )
        dwell_samples = [year_calculator.sample_session()[0] for _ in range(200)]
        mean_dwell_time = sum(dwell_samples) / len(dwell_samples)

        # Recommended provision: median peak bays from the existing bay-sizing
        # simulation (BayCalculator.calc_all_hours), independent of bay_count.
        bay_sizing_runs = [
            year_calculator.calc_all_hours(year_profile)
            for _ in range(sim_model.simulation_runs)
        ]
        required_bays = statistics.median(r.peak_bays for r in bay_sizing_runs)

        investment_calc = InvestmentCalculator(
            cost_per_bay=1.0,
            gross_margin_per_kwh=0.0,
            curve_preset=curve_overrides,
        )
        loss_result = investment_calc.simulate_scenarios(
            year_profile, [sim_model.bay_count], sim_model.simulation_runs
        )[0]

        served = loss_result.served_sessions_per_day
        lost = loss_result.lost_sessions_per_day
        total = served + lost
        service_level = served / total if total > 0 else 1.0

        peak_hour = year_profile.get_peak_hour()
        peak_arrival_rate = (
            year_profile.get_day_profile()[peak_hour]
            * year_profile.get_total_sessions_per_day()
        )

        results.append({
            "year": year,
            "scenario_name": scenario_params.name,
            "total_sessions": year_profile.get_total_sessions_per_day(),
            "peak_arrival_rate": peak_arrival_rate,
            "mean_dwell_time": mean_dwell_time,
            "required_bays": required_bays,
            "service_level": service_level,
            "queue_length": lost,
            "charger_power_kw": scenario_params.charger_power_kw,
            "bay_count": sim_model.bay_count,
        })

    return results


def run_all_scenarios(sim_model: SimModel) -> pd.DataFrame:
    """Runs all three scenarios through the existing simulation and returns a
    combined per-year, per-scenario result table."""
    all_results: list[dict] = []
    for scenario in SCENARIOS.values():
        all_results.extend(run_scenario(sim_model, scenario))
    return pd.DataFrame(all_results)


if __name__ == "__main__":
    base_profile = DayProfile.commuter_double_peak(total_sessions=80)
    base_calculator = BayCalculator()
    sim_model = SimModel(
        base_profile=base_profile, calculator=base_calculator, bay_count=10
    )

    forecast_df = run_all_scenarios(sim_model)
    print(forecast_df.to_string(index=False))
