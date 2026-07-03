from .BayResult import BayResult
from .BayCalculator import BayCalculator
from .DayProfile import DayProfile


class apiModel:
    def __init__(self):
        self.profile: DayProfile = None
        self.calculator: BayCalculator = None

    def set_profile(self, total_sessions: int, hourly_dist: list[float]) -> None:
        self.total_sessions = total_sessions
        self.profile = DayProfile(hourly_dist, total_sessions)
        self.profile.set_total_sessions(total_sessions)

    def set_calculator(self, avg_service_time: float, safety_buffer: float) -> None:
        self.avg_service_time = avg_service_time
        self.safety_buffer = safety_buffer
        self.calculator = BayCalculator(avg_service_time, safety_buffer)

    def run(self) -> BayResult:
        if not self.profile or not self.calculator:
            raise ValueError("Profile and calculator must be set before running")
        if not self.profile.validate_distribution():
            raise ValueError("Hourly distribution does not sum to 1.0")
        return self.calculator.calc_all_hours(self.profile)

    # not used in app
    def reset(self) -> None:
        self.profile = None
        self.calculator = None
