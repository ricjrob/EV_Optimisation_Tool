from dataclasses import dataclass


@dataclass(frozen=True)
class InvestmentScenario:
    """Financial outcome for a single candidate bay count."""

    bays: int
    capex: float
    lost_sessions_per_day: float
    served_sessions_per_day: float
    avg_energy_per_session_kwh: float
    annual_gross_margin: float
    annual_opex: float
    annual_net_cashflow: float
    simple_payback_years: float | None
    irr_pct: float | None
    discounted_payback_years: float | None
    npv: float

    def to_dict(self) -> dict:
        return {
            "bays": self.bays,
            "capex": self.capex,
            "lost_sessions_per_day": self.lost_sessions_per_day,
            "served_sessions_per_day": self.served_sessions_per_day,
            "avg_energy_per_session_kwh": self.avg_energy_per_session_kwh,
            "annual_gross_margin": self.annual_gross_margin,
            "annual_opex": self.annual_opex,
            "annual_net_cashflow": self.annual_net_cashflow,
            "simple_payback_years": self.simple_payback_years,
            "irr_pct": self.irr_pct,
            "discounted_payback_years": self.discounted_payback_years,
            "npv": self.npv,
        }
