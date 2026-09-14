import random
import unittest

from src.BayCalculator import BayCalculator
from src.DayProfile import DayProfile
from src.PowerCalculator import PowerCalculator
from src.PowerResult import ChargerConfig, ChargerSimulationResult, PeakPowerNeeds


class PowerNeedsTests(unittest.TestCase):
    def setUp(self):
        random.seed(42)
        self.calculator = BayCalculator()

    def test_percentile_power_needs_single_and_concurrent(self):
        power_needs = PowerCalculator.calculate_peak_power_needs(
            calculator=self.calculator, concurrent_bays=4, num_samples=100
        )
        self.assertIsInstance(power_needs, PeakPowerNeeds)
        # Percentiles must be non-decreasing: p90 <= p95 <= p99
        self.assertLessEqual(power_needs.p90_kw, power_needs.p95_kw)
        self.assertLessEqual(power_needs.p95_kw, power_needs.p99_kw)
        self.assertLessEqual(
            power_needs.single_vehicle_p90_kw, power_needs.single_vehicle_p95_kw
        )
        self.assertLessEqual(
            power_needs.single_vehicle_p95_kw, power_needs.single_vehicle_p99_kw
        )
        self.assertEqual(power_needs.concurrent_bays, 4)
        self.assertGreater(power_needs.mean_kw, 0)


class ChargerSimulationTests(unittest.TestCase):
    def setUp(self):
        random.seed(42)
        self.profile = DayProfile.flat(48)
        self.calc = BayCalculator()

    def test_charger_config_validation(self):
        with self.assertRaises(ValueError):
            ChargerConfig(num_chargers=0, max_kw_per_charger=400, bays_per_charger=2)
        with self.assertRaises(ValueError):
            ChargerConfig(num_chargers=2, max_kw_per_charger=-10, bays_per_charger=2)
        with self.assertRaises(ValueError):
            ChargerConfig(num_chargers=2, max_kw_per_charger=400, bays_per_charger=0)

    def test_unconstrained_vs_constrained_capping_impact(self):
        # Generous capacity: 4 chargers of 400kW, 1 bay each (4 bays total)
        generous_config = ChargerConfig(
            num_chargers=4, max_kw_per_charger=400, bays_per_charger=1
        )
        res_generous = PowerCalculator.simulate_charger_config(
            self.profile, generous_config, simulation_runs=2, calculator=self.calc
        )

        # Capped capacity: 1 charger of 150kW shared across 4 bays (37.5kW per bay when full)
        constrained_config = ChargerConfig(
            num_chargers=1, max_kw_per_charger=150, bays_per_charger=4
        )
        res_constrained = PowerCalculator.simulate_charger_config(
            self.profile, constrained_config, simulation_runs=2, calculator=self.calc
        )

        # Under tight power capping, delayed sessions and average dwell time extension should be higher
        self.assertGreater(
            res_constrained.avg_constrained_dwell_min,
            res_generous.avg_constrained_dwell_min,
        )
        self.assertGreaterEqual(
            res_constrained.delayed_sessions, res_generous.delayed_sessions
        )
        self.assertGreater(res_constrained.power_capped_minutes, 0)

    def test_dynamic_load_balancing_split(self):
        # 2 chargers x 2 bays = 4 bays total, 400kW max per charger
        cfg = ChargerConfig(num_chargers=2, max_kw_per_charger=400, bays_per_charger=2)
        result = PowerCalculator.simulate_charger_config(
            self.profile, cfg, simulation_runs=2, calculator=self.calc
        )
        self.assertIsInstance(result, ChargerSimulationResult)
        self.assertEqual(result.total_bays, 4)
        self.assertGreater(result.total_energy_kwh, 0)


if __name__ == "__main__":
    unittest.main()
