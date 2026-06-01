from BayResult import BayResult
from BayCalculator import BayCalculator
from DayProfile import DayProfile

class apiModel:
        def __init__(self):
            self.profile: DayProfile = None
            self.calculator: BayCalculator = None
            self.total_sessions: int = 1000
            self.avg_service_time: float = 2.0  # minutes
            self.util_target: float = 0.85
            self.safety_buffer: float = 1.1

        def set_profile(self, total_sessions: int, hourly_dist: list[float]) -> None:
            pass

        def set_calculator(
            self, avg_service_time: float, util_target: float, safety_buffer: float
        ) -> None:
            pass

        def run(self) -> BayResult:
            if not self.profile or not self.calculator:
                raise ValueError("Profile and calculator must be set before running")
            if not self.profile.validate_distribution():
                raise ValueError("Hourly distribution does not sum to 1.0")
            return self.calculator.calc_all_hours(self.profile)

        def reset(self) -> None:
            self.profile = None
            self.calculator = None
