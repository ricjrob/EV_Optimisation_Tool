(() => {
class SiteConfigurationStore {
    constructor(initialState) {
        this.value = { ...initialState };
        this.listeners = new Set();
    }

    update(changes) {
        Object.assign(this.value, changes);
        this.listeners.forEach(listener => listener(this.value));
    }

    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.value);
        return () => this.listeners.delete(listener);
    }
}

const DemandPlanningService = {
    getYearOneMetrics(forecastResult, scenarioName) {
        const rows = forecastResult?.scenarios || [];
        return rows.find(row => row.scenario_name === scenarioName && row.year === 1) || null;
    },

    getYearTenRisk(forecastResult) {
        const rows = forecastResult?.scenarios || [];
        return rows
            .filter(row => row.year === 10)
            .sort((left, right) => left.scenario_name.localeCompare(right.scenario_name));
    }
};

const PowerSizingService = {
    deriveHardware(installedBays, baysPerCharger, chargerPowerKw) {
        const safeBays = Math.max(1, Math.round(installedBays || 1));
        const safeBaysPerCharger = Math.max(1, Math.round(baysPerCharger || 1));
        const safeChargerPower = Math.max(1, Number(chargerPowerKw) || 1);
        const chargerCount = Math.ceil(safeBays / safeBaysPerCharger);
        return {
            installedBays: safeBays,
            baysPerCharger: safeBaysPerCharger,
            chargerPowerKw: safeChargerPower,
            chargerCount,
            supportedBays: chargerCount * safeBaysPerCharger,
            gridRequirementKw: chargerCount * safeChargerPower
        };
    }
};

const FinancialAnalysisService = {
    getSelectedScenario(result, scenarioName, installedBays) {
        const group = (result?.scenario_groups || []).find(
            item => item.scenario_name === scenarioName
        );
        if (!group) {
            return null;
        }
        return group.scenarios.find(item => item.bays === installedBays) || null;
    }
};

const ExecutiveSummaryService = {
    createNarrative(config, riskRows) {
        if (!config.installedBays || !config.chargerCount || !config.financialScenario) {
            return 'Complete demand, hardware, and financial evaluation to generate the site recommendation.';
        }

        const financial = config.financialScenario;
        const accelerated = riskRows.find(row =>
            row.scenario_name === 'Accelerated Adoption (upside)'
        );
        const risk = accelerated && accelerated.required_bays > config.installedBays
            ? ` Under accelerated adoption, Year 10 requires ${Math.ceil(accelerated.required_bays)} bays and service level falls to ${(accelerated.service_level * 100).toFixed(1)}%, indicating future expansion requirements.`
            : ' The installed capacity remains sufficient through Year 10 in the accelerated-adoption forecast.';

        return `The recommended deployment is ${config.installedBays} charging bays supported by ${config.chargerCount} × ${config.chargerPowerKw} kW chargers. This configuration has a ${(config.serviceLevel * 100).toFixed(1)}% service level, an estimated IRR of ${financial.irr_pct?.toFixed(1) ?? 'n/a'}%, an NPV of ${config.formatCurrency(financial.npv)}, and a discounted payback period of ${config.formatPayback(financial.discounted_payback_years)}.${risk}`;
    }
};

window.PlanningServices = {
    SiteConfigurationStore,
    DemandPlanningService,
    PowerSizingService,
    FinancialAnalysisService,
    ExecutiveSummaryService
};
})();
