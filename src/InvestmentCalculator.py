import heapq
import math
import random
import statistics

from .BayCalculator import BayCalculator
from .DayProfile import DayProfile
from .InvestmentResult import InvestmentScenario

DAYS_PER_YEAR = 365.0
MINUTES_PER_HOUR = 60.0


class InvestmentCalculator:
    """Financial analysis of candidate bay counts.

    For each bay count, a finite-capacity loss simulation (arrivals that find
    every bay occupied are turned away) estimates lost/served sessions per day.
    Served sessions drive an annual gross margin which, net of opex per bay,
    feeds IRR and discounted payback calculations over a fixed horizon.
    """

    def __init__(
        self,
        cost_per_bay: float,
        gross_margin_per_kwh: float,
        discount_rate_pct: float = 8.0,
        opex_per_bay: float = 0.0,
        horizon_years: int = 10,
        curve_preset: dict[str, float] | None = None,
    ):
        if cost_per_bay <= 0:
            raise ValueError("Cost per bay must be positive")
        if gross_margin_per_kwh < 0:
            raise ValueError("Gross margin per kWh must be non-negative")
        if not 0.0 <= discount_rate_pct <= 50.0:
            raise ValueError("Discount rate must be between 0 and 50%")
        if opex_per_bay < 0:
            raise ValueError("Opex per bay must be non-negative")
        if not 1 <= int(horizon_years) <= 30:
            raise ValueError("Horizon must be between 1 and 30 years")

        self.cost_per_bay = float(cost_per_bay)
        self.gross_margin_per_kwh = float(gross_margin_per_kwh)
        self.discount_rate = float(discount_rate_pct) / 100.0
        self.opex_per_bay = float(opex_per_bay)
        self.horizon_years = int(horizon_years)
        self.curve_preset = curve_preset

    # ------------------------------------------------------------------
    # Simulation
    # ------------------------------------------------------------------
    def simulate_scenarios(
        self,
        profile: DayProfile,
        bay_counts: list[int],
        simulation_runs: int = 25,
    ) -> list[InvestmentScenario]:
        calculator = BayCalculator(curve_preset=self.curve_preset)
        runs = max(1, int(simulation_runs))
        return [
            self._evaluate_bays(profile, bays, runs, calculator) for bays in bay_counts
        ]

    def estimate_peak_bays(self, profile: DayProfile) -> int:
        """Rough peak-hour bay requirement, used to default the scenario range."""
        total = profile.get_total_sessions_per_day()
        dist = profile.get_day_profile()
        peak_sessions = max(p * total for p in dist)
        calculator = BayCalculator(curve_preset=self.curve_preset)
        samples = [calculator.sample_session()[0] for _ in range(150)]
        mean_minutes = statistics.mean(samples) if samples else 30.0
        return max(1, math.ceil(peak_sessions * mean_minutes / MINUTES_PER_HOUR))

    def _evaluate_bays(
        self,
        profile: DayProfile,
        bays: int,
        runs: int,
        calculator: BayCalculator,
    ) -> InvestmentScenario:
        lost_per_day, served_per_day, avg_energy = self._simulate_loss(
            profile, bays, runs, calculator
        )

        capex = bays * self.cost_per_bay
        annual_margin = (
            served_per_day * DAYS_PER_YEAR * avg_energy * self.gross_margin_per_kwh
        )
        annual_opex = bays * self.opex_per_bay
        annual_net = annual_margin - annual_opex

        return InvestmentScenario(
            bays=bays,
            capex=capex,
            lost_sessions_per_day=lost_per_day,
            served_sessions_per_day=served_per_day,
            avg_energy_per_session_kwh=avg_energy,
            annual_gross_margin=annual_margin,
            annual_opex=annual_opex,
            annual_net_cashflow=annual_net,
            simple_payback_years=self._simple_payback(capex, annual_net),
            irr_pct=self._irr_pct(capex, annual_net),
            discounted_payback_years=self._discounted_payback(capex, annual_net),
            npv=self._npv(capex, annual_net),
        )

    def _simulate_loss(
        self,
        profile: DayProfile,
        bays: int,
        runs: int,
        calculator: BayCalculator,
    ) -> tuple[float, float, float]:
        lost_total = 0.0
        served_total = 0.0
        energy_total = 0.0
        for _ in range(runs):
            lost, served, energy = self._simulate_one_day(profile, bays, calculator)
            lost_total += lost
            served_total += served
            energy_total += energy

        lost_per_day = lost_total / runs
        served_per_day = served_total / runs
        avg_energy = (energy_total / served_total) if served_total > 0 else 0.0
        return lost_per_day, served_per_day, avg_energy

    def _simulate_one_day(
        self,
        profile: DayProfile,
        bays: int,
        calculator: BayCalculator,
    ) -> tuple[int, int, float]:
        """Loss system: an arrival finding all bays occupied is turned away."""
        total = profile.get_total_sessions_per_day()
        dist = profile.get_day_profile()

        arrivals: list[float] = []
        for hour, proportion in enumerate(dist):
            count = max(0, round(proportion * total))
            for _ in range(count):
                arrivals.append(
                    hour * MINUTES_PER_HOUR + random.random() * MINUTES_PER_HOUR
                )
        arrivals.sort()

        bay_free_times = [0.0] * bays
        heapq.heapify(bay_free_times)

        lost = 0
        served = 0
        energy_kwh = 0.0
        for arrival in arrivals:
            duration_minutes, session_kwh = calculator.sample_session()
            if bay_free_times[0] <= arrival:
                heapq.heapreplace(bay_free_times, arrival + duration_minutes)
                served += 1
                energy_kwh += session_kwh
            else:
                lost += 1
        return lost, served, energy_kwh

    # ------------------------------------------------------------------
    # Financial maths
    # ------------------------------------------------------------------
    def _annuity_factor(self, rate: float, years: int) -> float:
        if rate <= 0:
            return float(years)
        return (1.0 - (1.0 + rate) ** -years) / rate

    def _simple_payback(self, capex: float, annual_cashflow: float) -> float | None:
        if annual_cashflow <= 0:
            return None
        return capex / annual_cashflow

    def _npv(self, capex: float, annual_cashflow: float) -> float:
        return -capex + annual_cashflow * self._annuity_factor(
            self.discount_rate, self.horizon_years
        )

    def _irr_pct(self, capex: float, annual_cashflow: float) -> float | None:
        if capex <= 0 or annual_cashflow <= 0:
            return None

        def npv_at(rate: float) -> float:
            return -capex + annual_cashflow * self._annuity_factor(
                rate, self.horizon_years
            )

        lo, hi = -0.99, 10.0
        if npv_at(hi) > 0:
            return 1000.0  # capped: IRR beyond 1000% is not meaningful here

        for _ in range(80):
            mid = 0.5 * (lo + hi)
            if npv_at(mid) > 0:
                lo = mid
            else:
                hi = mid
        return 0.5 * (lo + hi) * 100.0

    def _discounted_payback(self, capex: float, annual_cashflow: float) -> float | None:
        """Years until cumulative discounted cash flow covers capex.

        Returns None when the cash flow never recovers the investment
        (non-positive cash flow, or a perpetuity worth less than the capex).
        Values above the horizon are returned as-is for the UI to format.
        """
        if annual_cashflow <= 0:
            return None
        rate = self.discount_rate
        if rate <= 0:
            return capex / annual_cashflow
        if annual_cashflow <= capex * rate:
            return None
        return math.log(annual_cashflow / (annual_cashflow - capex * rate)) / math.log(
            1.0 + rate
        )
