from .BayResult import BayResult
from .BayCalculator import BayCalculator
from .DayProfile import DayProfile
from .PowerCalculator import PowerCalculator
from .PowerResult import ChargerConfig, ChargerSimulationResult, PeakPowerNeeds


class apiModel:
    def __init__(self):
        self.profile: DayProfile | None = None
        self.calculator: BayCalculator | None = None
        self.total_sessions: int = 100

    def set_profile(self, total_sessions: int, hourly_dist: list[float]) -> None:
        self.total_sessions = total_sessions
        self.profile = DayProfile(hourly_dist, total_sessions)
        self.profile.set_total_sessions(total_sessions)

    def set_calculator(
        self,
        charge_curve_id: str | None = None,
    ) -> None:
        self.calculator = BayCalculator(charge_curve_id=charge_curve_id)

    def run(self) -> BayResult:
        if not self.profile or not self.calculator:
            raise ValueError("Profile and calculator must be set before running")
        if not self.profile.validate_distribution():
            raise ValueError("Hourly distribution does not sum to 1.0")
        return self.calculator.calc_all_hours(self.profile)

    def get_peak_power_needs(self, concurrent_bays: int = 1) -> PeakPowerNeeds:
        if not self.calculator:
            self.calculator = BayCalculator()
        return PowerCalculator.calculate_peak_power_needs(
            self.calculator, concurrent_bays=concurrent_bays
        )

    def run_power_simulation(
        self,
        charger_config: ChargerConfig,
        simulation_runs: int = 10,
    ) -> ChargerSimulationResult:
        if not self.profile or not self.calculator:
            raise ValueError(
                "Profile and calculator must be set before running simulation"
            )
        return PowerCalculator.simulate_charger_config(
            self.profile,
            charger_config,
            simulation_runs=simulation_runs,
            calculator=self.calculator,
        )

    # not used in app
    def reset(self) -> None:
        self.profile = None
        self.calculator = None
