import math
import random
import unittest

from src.DayProfile import DayProfile
from src.InvestmentCalculator import InvestmentCalculator


class FinancialMathTests(unittest.TestCase):
    def setUp(self):
        self.calc = InvestmentCalculator(
            cost_per_bay=100.0,
            gross_margin_per_kwh=0.35,
            discount_rate_pct=8.0,
            opex_per_bay=0.0,
            horizon_years=10,
        )

    def test_annuity_factor_zero_rate(self):
        self.assertAlmostEqual(self.calc._annuity_factor(0.0, 10), 10.0)

    def test_annuity_factor_known_value(self):
        # Annuity factor at 8% over 10 years
        self.assertAlmostEqual(self.calc._annuity_factor(0.08, 10), 6.7100814, places=5)

    def test_irr_matches_known_annuity(self):
        # Cash flow chosen so that NPV = 0 at exactly 10% over 10 years
        cashflow = 100.0 / self.calc._annuity_factor(0.10, 10)
        irr = self.calc._irr_pct(100.0, cashflow)
        self.assertIsNotNone(irr)
        self.assertAlmostEqual(irr, 10.0, delta=0.05)

    def test_irr_none_when_cashflow_non_positive(self):
        self.assertIsNone(self.calc._irr_pct(100.0, 0.0))
        self.assertIsNone(self.calc._irr_pct(100.0, -5.0))

    def test_irr_negative_when_total_cashflow_below_capex(self):
        irr = self.calc._irr_pct(100.0, 5.0)  # only 50 back over 10 years
        self.assertIsNotNone(irr)
        self.assertLess(irr, 0.0)

    def test_simple_payback(self):
        self.assertAlmostEqual(self.calc._simple_payback(100.0, 25.0), 4.0)
        self.assertIsNone(self.calc._simple_payback(100.0, 0.0))

    def test_discounted_payback_closed_form(self):
        # t = ln(M / (M - C*r)) / ln(1 + r) with C=100, M=20, r=8%
        expected = math.log(20.0 / (20.0 - 100.0 * 0.08)) / math.log(1.08)
        result = self.calc._discounted_payback(100.0, 20.0)
        self.assertIsNotNone(result)
        self.assertAlmostEqual(result, expected, places=5)
        self.assertAlmostEqual(result, 6.6372, places=3)

    def test_discounted_payback_zero_rate_equals_simple(self):
        calc = InvestmentCalculator(
            cost_per_bay=100.0, gross_margin_per_kwh=0.35, discount_rate_pct=0.0
        )
        self.assertAlmostEqual(calc._discounted_payback(100.0, 25.0), 4.0)

    def test_discounted_payback_never_when_perpetuity_insufficient(self):
        # 100 * 8% = 8 >= 5 cash flow: never recovers the outlay
        self.assertIsNone(self.calc._discounted_payback(100.0, 5.0))

    def test_npv(self):
        expected = -100.0 + 20.0 * self.calc._annuity_factor(0.08, 10)
        self.assertAlmostEqual(self.calc._npv(100.0, 20.0), expected)

    def test_input_validation(self):
        with self.assertRaises(ValueError):
            InvestmentCalculator(cost_per_bay=0, gross_margin_per_kwh=0.35)
        with self.assertRaises(ValueError):
            InvestmentCalculator(cost_per_bay=100, gross_margin_per_kwh=-0.1)
        with self.assertRaises(ValueError):
            InvestmentCalculator(
                cost_per_bay=100, gross_margin_per_kwh=0.35, discount_rate_pct=60
            )
        with self.assertRaises(ValueError):
            InvestmentCalculator(
                cost_per_bay=100, gross_margin_per_kwh=0.35, opex_per_bay=-1
            )
        with self.assertRaises(ValueError):
            InvestmentCalculator(
                cost_per_bay=100, gross_margin_per_kwh=0.35, horizon_years=0
            )


class LossSimulationTests(unittest.TestCase):
    def setUp(self):
        random.seed(7)
        self.profile = DayProfile.flat(48)
        self.calc = InvestmentCalculator(
            cost_per_bay=10000.0,
            gross_margin_per_kwh=0.35,
            discount_rate_pct=8.0,
            opex_per_bay=500.0,
            horizon_years=10,
        )

    def test_lost_sessions_decrease_as_bays_increase(self):
        scenarios = self.calc.simulate_scenarios(
            self.profile, [1, 3, 8], simulation_runs=3
        )
        lost = [s.lost_sessions_per_day for s in scenarios]
        self.assertGreaterEqual(lost[0], lost[1])
        self.assertGreaterEqual(lost[1], lost[2])

    def test_no_lost_sessions_with_excess_bays(self):
        scenarios = self.calc.simulate_scenarios(self.profile, [200], simulation_runs=2)
        self.assertEqual(scenarios[0].lost_sessions_per_day, 0.0)
        self.assertAlmostEqual(scenarios[0].served_sessions_per_day, 48.0, places=5)

    def test_scenario_conservation_and_capex(self):
        scenarios = self.calc.simulate_scenarios(self.profile, [4], simulation_runs=3)
        s = scenarios[0]
        self.assertAlmostEqual(
            s.served_sessions_per_day + s.lost_sessions_per_day, 48.0, places=5
        )
        self.assertAlmostEqual(s.capex, 4 * 10000.0)
        self.assertAlmostEqual(s.annual_opex, 4 * 500.0)
        self.assertAlmostEqual(
            s.annual_net_cashflow, s.annual_gross_margin - s.annual_opex
        )
        self.assertGreater(s.avg_energy_per_session_kwh, 0.0)

    def test_estimate_peak_bays_reasonable(self):
        estimate = self.calc.estimate_peak_bays(self.profile)
        self.assertGreaterEqual(estimate, 1)
        self.assertLessEqual(estimate, 48)


if __name__ == "__main__":
    unittest.main()
