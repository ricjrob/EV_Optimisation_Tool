// DOM elements
const totalSessionsGroup = document.getElementById('total-sessions-group');
const totalSessionsInput = document.getElementById('total-sessions');
const simulationRunsInput = document.getElementById('simulation-runs');
const calculateBtn = document.getElementById('calculate-btn');
const loadExampleBtn = document.getElementById('load-example-btn');
const normalizeBtn = document.getElementById('normalize-btn');
const errorMessage = document.getElementById('error-message');

const modeSessionsBtn = document.getElementById('mode-sessions');
const modeProportionBtn = document.getElementById('mode-proportion');
const dayTabs = document.getElementById('day-tabs');
const copyFromDay = document.getElementById('copy-from-day');
const compareToggle = document.getElementById('compare-toggle');
const compareDay = document.getElementById('compare-day');
const linkedToggle = document.getElementById('linked-toggle');
const barsTrack = document.getElementById('bars-track');
const hourLabels = document.getElementById('hour-labels');
const hourGrid = document.getElementById('hour-grid');
const distTotalLabel = document.getElementById('dist-total-label');
const distSum = document.getElementById('dist-sum');
const resetDistributionBtn = document.getElementById('reset-distribution');
const presetButtons = Array.from(document.querySelectorAll('[data-preset]'));

const resultsSummary = document.getElementById('results-summary');
const resultsTabs = document.getElementById('results-tabs');
const tabBayRequirements = document.getElementById('tab-bay-requirements');
const tabDistributions = document.getElementById('tab-distributions');
const resultsTable = document.getElementById('results-table');
const resultsChart = document.getElementById('results-chart');
const noResults = document.getElementById('no-results');
const maxBaysDisplay = document.getElementById('max-bays');
const peakDayDisplay = document.getElementById('peak-day');
const resultsDayPicker = document.getElementById('results-day-picker');
const resultsTableTitle = document.getElementById('results-table-title');
const resultsChartTitle = document.getElementById('results-chart-title');
const resultsTbody = document.getElementById('results-tbody');

const tabInvestment = document.getElementById('tab-investment');
const invCostPerBayInput = document.getElementById('inv-cost-per-bay');
const invMarginKwhInput = document.getElementById('inv-margin-kwh');
const invDiscountRateInput = document.getElementById('inv-discount-rate');
const invOpexBayInput = document.getElementById('inv-opex-bay');
const runInvestmentBtn = document.getElementById('run-investment-btn');
const investmentError = document.getElementById('investment-error');
const investmentSummary = document.getElementById('investment-summary');
const investmentTable = document.getElementById('investment-table');
const investmentCharts = document.getElementById('investment-charts');
const investmentTbody = document.getElementById('investment-tbody');

const tabPowerConfig = document.getElementById('tab-power-config');
const powerP90Val = document.getElementById('power-p90-val');
const powerP95Val = document.getElementById('power-p95-val');
const powerP99Val = document.getElementById('power-p99-val');
const powerDetailNote = document.getElementById('power-detail-note');

const powerNumChargersInput = document.getElementById('power-num-chargers');
const powerMaxKwInput = document.getElementById('power-max-kw');
const powerBaysPerChargerInput = document.getElementById('power-bays-per-charger');
const runPowerSimBtn = document.getElementById('run-power-sim-btn');
const powerSimError = document.getElementById('power-sim-error');
const powerSimResults = document.getElementById('power-sim-results');

const gbpFormatter = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0
});

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const PRESETS = {
    office: [0, 0, 0, 0, 0, 1, 3, 8, 13, 10, 11, 9, 7, 7, 8, 10, 7, 9, 5, 2, 1, 0, 0, 0],
    retail: [0, 0, 0, 0, 0, 0, 1, 2, 4, 7, 9, 11, 12, 12, 11, 12, 13, 12, 10, 7, 4, 2, 1, 0],
    overnight: [10, 9, 8, 7, 6, 4, 3, 2, 2, 3, 4, 5, 5, 5, 5, 5, 5, 6, 7, 8, 9, 10, 11, 11]
};

const state = {
    mode: 'sessions',
    linked: true,
    activeDay: 'Mon',
    ghostDay: null,
    draggingHour: null,
    totalSessions: 100,
    dayValues: initDayValues(),
    resultSet: null,
    selectedResultDay: 'Mon',
    resultsActiveTab: 'bay-requirements',
    lastProfileConfig: null,
    investmentResult: null,
    peakPowerNeeds: null,
    powerSimulationResult: null
};

function initDayValues() {
    const init = {};
    DAYS.forEach(day => {
        init[day] = PRESETS.office.slice();
    });
    return init;
}

function hourLabel(hour) {
    const period = hour < 12 ? 'am' : 'pm';
    const display = hour % 12 === 0 ? 12 : hour % 12;
    return `${display}${period}`;
}

function normalizeToSum(values, targetSum) {
    const sum = values.reduce((a, b) => a + b, 0);
    if (sum <= 0) {
        return values.map(() => targetSum / values.length);
    }
    return values.map(v => (v / sum) * targetSum);
}

function parseTotalSessionsInput() {
    const value = parseInt(totalSessionsInput.value, 10);
    if (Number.isNaN(value)) {
        return 0;
    }
    return Math.max(0, value);
}

function getActiveValues() {
    return state.dayValues[state.activeDay];
}

function updateActiveValues(mutator) {
    const current = getActiveValues();
    const nextValues = typeof mutator === 'function' ? mutator(current.slice()) : mutator.slice();

    if (state.linked) {
        DAYS.forEach(day => {
            state.dayValues[day] = nextValues.slice();
        });
    } else {
        state.dayValues[state.activeDay] = nextValues;
    }
}

function setHourValue(hour, rawValue) {
    const parsed = parseFloat(rawValue);
    const safeValue = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
    updateActiveValues(prev => {
        const next = prev.slice();
        next[hour] = state.mode === 'sessions' ? Math.round(safeValue) : safeValue;
        return next;
    });
    renderDistributionEditor();
}

function getDisplayValues(values) {
    if (state.mode === 'proportion') {
        return values;
    }
    return values;
}

function getScaleMax(values, ghostValues) {
    const maxMain = Math.max(...values, 0);
    const maxGhost = ghostValues ? Math.max(...ghostValues, 0) : 0;
    const base = Math.max(maxMain, maxGhost, 0);
    return state.mode === 'proportion' ? Math.max(base, 20) : Math.max(base, 5);
}

function renderDayTabs() {
    dayTabs.innerHTML = '';
    DAYS.forEach(day => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `day-tab ${state.activeDay === day ? 'active' : ''}`;
        button.textContent = day;
        button.addEventListener('click', () => {
            state.activeDay = day;
            if (state.ghostDay === day) {
                state.ghostDay = null;
            }
            renderDistributionEditor();
        });
        dayTabs.appendChild(button);
    });
}

function renderCopyControls() {
    copyFromDay.innerHTML = '<option value="">choose day...</option>';
    DAYS.filter(day => day !== state.activeDay).forEach(day => {
        const option = document.createElement('option');
        option.value = day;
        option.textContent = day;
        copyFromDay.appendChild(option);
    });

    if (state.ghostDay && state.ghostDay === state.activeDay) {
        state.ghostDay = null;
    }

    compareDay.innerHTML = '';
    DAYS.filter(day => day !== state.activeDay).forEach(day => {
        const option = document.createElement('option');
        option.value = day;
        option.textContent = day;
        compareDay.appendChild(option);
    });

    if (!state.ghostDay) {
        compareDay.classList.add('hidden');
        compareToggle.textContent = 'Compare';
    } else {
        compareDay.classList.remove('hidden');
        compareToggle.textContent = `Comparing: ${state.ghostDay}`;
        compareDay.value = state.ghostDay;
    }

    copyFromDay.disabled = state.linked;
    compareToggle.disabled = state.linked;
    compareDay.disabled = state.linked;

    linkedToggle.textContent = state.linked ? 'Same every day' : 'Customized by day';
    linkedToggle.classList.toggle('active', state.linked);
}

function renderBars() {
    const activeValues = getDisplayValues(getActiveValues());
    const ghostValues = state.ghostDay ? getDisplayValues(state.dayValues[state.ghostDay]) : null;
    const scaleMax = getScaleMax(activeValues, ghostValues);

    barsTrack.innerHTML = '';

    HOURS.forEach(hour => {
        const value = activeValues[hour];
        const barPct = scaleMax > 0 ? Math.min(100, (value / scaleMax) * 100) : 0;
        const ghostValue = ghostValues ? ghostValues[hour] : null;
        const ghostPct = ghostValue !== null && scaleMax > 0 ? Math.min(100, (ghostValue / scaleMax) * 100) : 0;

        const col = document.createElement('div');
        col.className = 'bar-col';
        col.dataset.hour = String(hour);

        if (ghostValue !== null) {
            const ghost = document.createElement('div');
            ghost.className = 'bar-ghost';
            ghost.style.height = `${ghostPct}%`;
            col.appendChild(ghost);
        }

        const bar = document.createElement('div');
        const maxValue = Math.max(...activeValues);
        bar.className = `bar-fill ${value > 0 && value === maxValue ? 'peak' : ''}`;
        bar.style.height = `${barPct}%`;
        bar.title = `${hourLabel(hour)}: ${state.mode === 'proportion' ? value.toFixed(1) + '%' : Math.round(value)}`;
        col.appendChild(bar);

        col.addEventListener('mousedown', event => {
            state.draggingHour = hour;
            updateBarFromPointer(event.clientY);
        });

        barsTrack.appendChild(col);
    });
}

function renderHourLabels() {
    hourLabels.innerHTML = '';
    HOURS.forEach(hour => {
        const el = document.createElement('div');
        el.className = 'hour-label';
        el.textContent = hour % 3 === 0 ? hourLabel(hour) : '';
        hourLabels.appendChild(el);
    });
}

function renderHourGrid() {
    const values = getDisplayValues(getActiveValues());
    hourGrid.innerHTML = '';

    HOURS.forEach(hour => {
        const wrap = document.createElement('div');
        wrap.className = 'hour-input-wrap';

        const label = document.createElement('label');
        label.className = 'hour-input-label';
        label.textContent = hourLabel(hour);

        const input = document.createElement('input');
        input.className = 'hour-input';
        input.type = 'number';
        input.min = '0';
        input.max = state.mode === 'proportion' ? '100' : '';
        input.step = '1';
        input.value = state.mode === 'proportion' ? values[hour].toFixed(1) : String(Math.round(values[hour]));
        input.setAttribute('aria-label', state.mode === 'proportion' ? `${hourLabel(hour)} percentage` : `${hourLabel(hour)} sessions`);
        input.addEventListener('change', e => {
            setHourValue(hour, e.target.value);
        });

        const inputRow = document.createElement('div');
        inputRow.className = 'hour-input-row';
        inputRow.appendChild(input);

        if (state.mode === 'proportion') {
            const suffix = document.createElement('span');
            suffix.className = 'hour-input-suffix';
            suffix.textContent = '%';
            inputRow.appendChild(suffix);
        }

        wrap.appendChild(label);
        wrap.appendChild(inputRow);
        hourGrid.appendChild(wrap);
    });
}

function renderSummary() {
    const values = getActiveValues();
    const total = values.reduce((a, b) => a + b, 0);

    if (state.mode === 'proportion') {
        totalSessionsInput.value = String(Math.max(1, Math.round(state.totalSessions)));
        distTotalLabel.textContent = 'Total across 24 hours';
        distSum.textContent = `${total.toFixed(1)}%`;
        distSum.classList.toggle('error', Math.abs(total - 100) > 0.5);
    } else {
        distTotalLabel.textContent = 'Total sessions';
        distSum.textContent = `${Math.round(total)} sessions`;
        distSum.classList.remove('error');
        if (total > 0) {
            state.totalSessions = Math.round(total);
        }
    }

    totalSessionsGroup.classList.toggle('hidden', state.mode !== 'proportion');
    normalizeBtn.classList.toggle('hidden', state.mode !== 'proportion');
    modeSessionsBtn.classList.toggle('active', state.mode === 'sessions');
    modeProportionBtn.classList.toggle('active', state.mode === 'proportion');
}

function renderDistributionEditor() {
    renderDayTabs();
    renderCopyControls();
    renderBars();
    renderHourLabels();
    renderHourGrid();
    renderSummary();
}

function updateBarFromPointer(clientY) {
    if (state.draggingHour === null) {
        return;
    }

    const column = barsTrack.querySelector(`[data-hour="${state.draggingHour}"]`);
    if (!column) {
        return;
    }

    const activeValues = getDisplayValues(getActiveValues());
    const ghostValues = state.ghostDay ? getDisplayValues(state.dayValues[state.ghostDay]) : null;
    const scaleMax = getScaleMax(activeValues, ghostValues);
    const rect = column.getBoundingClientRect();
    const fromBottom = rect.bottom - clientY;
    const ratio = Math.min(1, Math.max(0, fromBottom / rect.height));
    const newValue = ratio * scaleMax;
    setHourValue(state.draggingHour, state.mode === 'proportion' ? newValue.toFixed(1) : Math.round(newValue));
}

function applyPreset(preset) {
    if (!PRESETS[preset]) {
        return;
    }

    let nextValues = PRESETS[preset].slice();
    if (state.mode === 'proportion') {
        nextValues = normalizeToSum(nextValues, 100);
    }

    updateActiveValues(nextValues);
    renderDistributionEditor();
}

function resetDistribution() {
    const target = state.mode === 'proportion' ? 100 : Math.max(state.totalSessions, 100);
    updateActiveValues(HOURS.map(() => target / 24));
    renderDistributionEditor();
}

function normalizeDistribution() {
    if (state.mode !== 'proportion') {
        return;
    }
    updateActiveValues(values => normalizeToSum(values, 100));
    renderDistributionEditor();
    showSuccess('Distribution normalized to 100%');
}

function exportHourlyEditorPayload() {
    const days = {};
    DAYS.forEach(day => {
        days[day] = state.dayValues[day].map(v => Number(v));
    });
    return {
        mode: state.mode,
        linked: state.linked,
        active_day: state.activeDay,
        days
    };
}

function getActiveDayDistributionForApi() {
    const values = getActiveValues();
    const sum = values.reduce((a, b) => a + b, 0);
    if (sum <= 0) {
        return null;
    }
    return values.map(v => v / sum);
}

function getEffectiveTotalSessions() {
    if (state.mode === 'sessions') {
        const sum = getActiveValues().reduce((a, b) => a + b, 0);
        const inferred = Math.round(sum);
        if (inferred > 0) {
            state.totalSessions = inferred;
        }
        return inferred;
    }

    const enteredTotal = parseTotalSessionsInput();
    if (enteredTotal > 0) {
        state.totalSessions = enteredTotal;
    }
    return Math.max(1, Math.round(state.totalSessions));
}

function getEffectiveSimulationRuns() {
    const entered = Math.round(Number(simulationRunsInput.value));
    const clamped = Math.min(1000, Math.max(1, isNaN(entered) ? 1 : entered));
    simulationRunsInput.value = String(clamped);
    return clamped;
}

async function loadExample() {
    try {
        const response = await fetch('/api/example');
        if (!response.ok) {
            throw new Error('Failed to load example');
        }

        const data = await response.json();
        const totalSessions = data.profile.total_sessions;
        const sessionsValues = data.profile.hourly_dist.map(v => v * totalSessions);

        state.mode = 'sessions';
        state.linked = true;
        state.activeDay = 'Mon';
        state.ghostDay = null;
        DAYS.forEach(day => {
            state.dayValues[day] = sessionsValues.slice();
        });

        state.totalSessions = totalSessions;

        renderDistributionEditor();
        clearError();
        showSuccess('Example configuration loaded');
    } catch (error) {
        showError('Failed to load example: ' + error.message);
    }
}

// Handle calculate button
async function handleCalculate() {
    clearError();

    // Validate inputs
    const totalSessions = getEffectiveTotalSessions();
    if (isNaN(totalSessions) || totalSessions < 1) {
        showError('Total sessions must be a positive number');
        return;
    }

    const hourlyDist = getActiveDayDistributionForApi();
    if (!hourlyDist) {
        showError('Distribution cannot be all zeros');
        return;
    }

    const simulationRuns = getEffectiveSimulationRuns();

    // Prepare request
    const requestData = {
        profile: {
            total_sessions: totalSessions,
            hourly_dist: hourlyDist,
            hourly_editor: exportHourlyEditorPayload(),
            charge_curve_id: 'dc_fast',
            simulation_runs: simulationRuns
        }
    };
    state.lastProfileConfig = requestData.profile;

    // Send to API
    try {
        calculateBtn.disabled = true;
        calculateBtn.textContent = 'Calculating...';

        const response = await fetch('/api/calculate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || error.error || 'Calculation failed');
        }

        const result = await response.json();
        displayResults(result);
    } catch (error) {
        showError('Calculation error: ' + error.message);
    } finally {
        calculateBtn.disabled = false;
        calculateBtn.textContent = 'Calculate';
    }
}

function initDistributionEditor() {
    totalSessionsInput.addEventListener('change', () => {
        const entered = parseTotalSessionsInput();
        if (entered > 0) {
            state.totalSessions = entered;
            totalSessionsInput.value = String(entered);
        } else {
            totalSessionsInput.value = String(Math.max(1, Math.round(state.totalSessions)));
        }
    });

    simulationRunsInput.addEventListener('change', () => {
        getEffectiveSimulationRuns();
    });

    modeSessionsBtn.addEventListener('click', () => {
        if (state.mode === 'sessions') {
            return;
        }
        const target = Math.max(state.totalSessions, 1);
        DAYS.forEach(day => {
            state.dayValues[day] = normalizeToSum(state.dayValues[day], target);
        });
        state.mode = 'sessions';
        renderDistributionEditor();
    });

    modeProportionBtn.addEventListener('click', () => {
        if (state.mode === 'proportion') {
            return;
        }
        DAYS.forEach(day => {
            state.dayValues[day] = normalizeToSum(state.dayValues[day], 100);
        });
        state.mode = 'proportion';
        renderDistributionEditor();
    });

    linkedToggle.addEventListener('click', () => {
        if (!state.linked) {
            const snapshot = state.dayValues[state.activeDay].slice();
            DAYS.forEach(day => {
                state.dayValues[day] = snapshot.slice();
            });
        }
        state.linked = !state.linked;
        if (state.linked) {
            state.ghostDay = null;
        }
        renderDistributionEditor();
    });

    copyFromDay.addEventListener('change', event => {
        const source = event.target.value;
        if (!source || source === state.activeDay) {
            return;
        }
        state.dayValues[state.activeDay] = state.dayValues[source].slice();
        copyFromDay.value = '';
        renderDistributionEditor();
    });

    compareToggle.addEventListener('click', () => {
        if (state.linked) {
            return;
        }
        if (state.ghostDay) {
            state.ghostDay = null;
        } else {
            state.ghostDay = DAYS.find(day => day !== state.activeDay) || null;
        }
        renderDistributionEditor();
    });

    compareDay.addEventListener('change', event => {
        state.ghostDay = event.target.value || null;
        renderDistributionEditor();
    });

    presetButtons.forEach(button => {
        button.addEventListener('click', () => applyPreset(button.dataset.preset));
    });

    resetDistributionBtn.addEventListener('click', resetDistribution);
    normalizeBtn.addEventListener('click', normalizeDistribution);

    document.addEventListener('mousemove', event => {
        if (state.draggingHour === null) {
            return;
        }
        updateBarFromPointer(event.clientY);
    });

    document.addEventListener('mouseup', () => {
        state.draggingHour = null;
    });

    renderDistributionEditor();
}

// Event listeners
calculateBtn.addEventListener('click', handleCalculate);
loadExampleBtn.addEventListener('click', loadExample);
runInvestmentBtn.addEventListener('click', handleInvestmentAnalysis);
runPowerSimBtn.addEventListener('click', handlePowerSimulation);

document.addEventListener('DOMContentLoaded', () => {
    initDistributionEditor();
    initResultsTabs();
});

// Results tab switching
function initResultsTabs() {
    document.querySelectorAll('.results-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            state.resultsActiveTab = btn.dataset.tab;
            document.querySelectorAll('.results-tab').forEach(b => {
                b.classList.toggle('active', b === btn);
            });
            tabBayRequirements.classList.toggle('hidden', state.resultsActiveTab !== 'bay-requirements');
            tabDistributions.classList.toggle('hidden', state.resultsActiveTab !== 'distributions');
            tabInvestment.classList.toggle('hidden', state.resultsActiveTab !== 'investment');
            tabPowerConfig.classList.toggle('hidden', state.resultsActiveTab !== 'power-config');
            if (state.resultsActiveTab === 'distributions' && state.resultSet) {
                const selected = state.resultSet.dayResults[state.selectedResultDay];
                if (selected) {
                    renderDistributionsPanel(selected.soc_samples || [], selected.duration_samples || []);
                }
            }
            if (state.resultsActiveTab === 'investment' && state.investmentResult) {
                renderInvestmentResult();
            }
            if (state.resultsActiveTab === 'power-config' && state.peakPowerNeeds) {
                renderPowerNeeds(state.peakPowerNeeds);
                if (state.powerSimulationResult) {
                    renderPowerSimulationResult(state.powerSimulationResult);
                }
            }
        });
    });
}

// Display results
function displayResults(result) {
    const dayOrder = Array.isArray(result.day_order) && result.day_order.length > 0
        ? result.day_order
        : [result.active_day || state.activeDay || 'Mon'];

    const dayResults = result.day_results || {
        [dayOrder[0]]: {
            results: result.results,
            peak_bays: result.peak_bays,
            peak_hour: result.peak_hour,
            summary: result.summary
        }
    };

    state.resultSet = {
        dayOrder,
        dayResults,
        overallPeakBays: result.overall_peak_bays ?? result.peak_bays,
        peakDay: result.peak_day || dayOrder[0]
    };

    state.selectedResultDay = dayResults[result.active_day] ? result.active_day : dayOrder[0];

    maxBaysDisplay.textContent = state.resultSet.overallPeakBays;
    peakDayDisplay.textContent = state.resultSet.peakDay;
    resultsSummary.classList.remove('hidden');
    resultsTabs.classList.remove('hidden');
    noResults.classList.add('hidden');

    // New demand profile invalidates any previous investment analysis
    state.investmentResult = null;
    investmentSummary.classList.add('hidden');
    investmentTable.classList.add('hidden');
    investmentCharts.classList.add('hidden');
    clearInvestmentError();

    // Store power needs from calculation
    if (result.peak_power_needs) {
        state.peakPowerNeeds = result.peak_power_needs;
        renderPowerNeeds(result.peak_power_needs);
    }
    if (result.charger_simulation) {
        state.powerSimulationResult = result.charger_simulation;
        renderPowerSimulationResult(result.charger_simulation);
    } else {
        state.powerSimulationResult = null;
        renderPowerSimulationResult(null);
    }

    renderResultsDayPicker();
    renderSelectedDayResults();
}

function renderResultsDayPicker() {
    if (!state.resultSet) {
        resultsDayPicker.innerHTML = '';
        return;
    }

    resultsDayPicker.innerHTML = '';
    state.resultSet.dayOrder.forEach(day => {
        const dayResult = state.resultSet.dayResults[day];
        if (!dayResult) {
            return;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = `results-day-chip ${state.selectedResultDay === day ? 'active' : ''}`;
        button.innerHTML = `
            <span class="results-day-chip-label">${day}</span>
            <span class="results-day-chip-value">${dayResult.peak_bays} max bays</span>
        `;
        button.addEventListener('click', () => {
            state.selectedResultDay = day;
            renderResultsDayPicker();
            renderSelectedDayResults();
        });
        resultsDayPicker.appendChild(button);
    });
}

function renderSelectedDayResults() {
    if (!state.resultSet) {
        return;
    }

    const selected = state.resultSet.dayResults[state.selectedResultDay];
    if (!selected) {
        return;
    }

    resultsTableTitle.textContent = `Hourly Breakdown (${state.selectedResultDay})`;
    resultsChartTitle.textContent = `Bays Required by Hour (${state.selectedResultDay})`;

    resultsTbody.innerHTML = '';
    selected.results.forEach(row => {
        const tr = document.createElement('tr');
        const ciLabel = `${row.bays_ci_low.toFixed(1)} - ${row.bays_ci_high.toFixed(1)}`;
        tr.innerHTML = `
            <td>${row.hour}</td>
            <td>${row.sessions}</td>
            <td>${(row.utilisation * 100).toFixed(1)}%</td>
            <td><strong>${row.bays_mean.toFixed(1)}</strong></td>
            <td>${ciLabel}</td>
        `;
        resultsTbody.appendChild(tr);
    });
    resultsTable.classList.remove('hidden');
    resultsChart.classList.remove('hidden');
    drawChart(selected.results);

    if (state.resultsActiveTab === 'distributions') {
        renderDistributionsPanel(selected.soc_samples || [], selected.duration_samples || []);
    }

    if (state.resultsActiveTab === 'investment' && state.investmentResult) {
        renderInvestmentResult();
    }
}

// Draw chart using Canvas
function drawChart(results) {
    const canvas = document.getElementById('chart-canvas');
    const ctx = canvas.getContext('2d');

    // Set canvas size (device-pixel-ratio aware so the chart stays sharp on retina displays)
    const rect = canvas.parentElement.getBoundingClientRect();
    const width = Math.max(320, rect.width - 24);
    const height = 360;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const plot = {
        top: 28,
        right: 20,
        bottom: 72,
        left: 74
    };

    const maxBays = Math.max(...results.map(r => r.bays_ci_high ?? r.bays_needed));
    const chartMax = Math.max(1, maxBays);
    const plotWidth = width - plot.left - plot.right;
    const plotHeight = height - plot.top - plot.bottom;
    const dataWidth = plotWidth / 24;
    const scaleY = plotHeight / (chartMax * 1.1);
    const xTickStep = dataWidth < 22 ? 2 : 1;

    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= chartMax; i++) {
        const y = height - plot.bottom - (i * scaleY);
        ctx.beginPath();
        ctx.moveTo(plot.left, y);
        ctx.lineTo(width - plot.right, y);
        ctx.stroke();

        // Y-axis labels
        ctx.fillStyle = '#666';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(i.toString(), plot.left - 18, y);
    }

    // Draw bars (median bays needed, with 95% CI error bars around the mean)
    results.forEach((row, index) => {
        const x = plot.left + (index * dataWidth) + (dataWidth * 0.12);
        const barWidth = dataWidth * 0.8;
        const barHeight = row.bays_needed * scaleY;
        const y = height - plot.bottom - barHeight;

        // Bar gradient
        const gradient = ctx.createLinearGradient(0, y, 0, height - plot.bottom);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth, barHeight);

        // 95% CI error bar around the mean
        if (typeof row.bays_ci_low === 'number' && typeof row.bays_ci_high === 'number') {
            const ciX = x + barWidth / 2;
            const ciLowY = height - plot.bottom - (row.bays_ci_low * scaleY);
            const ciHighY = height - plot.bottom - (row.bays_ci_high * scaleY);
            const capWidth = barWidth * 0.3;

            ctx.strokeStyle = '#1f1147';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(ciX, ciLowY);
            ctx.lineTo(ciX, ciHighY);
            ctx.moveTo(ciX - capWidth / 2, ciLowY);
            ctx.lineTo(ciX + capWidth / 2, ciLowY);
            ctx.moveTo(ciX - capWidth / 2, ciHighY);
            ctx.lineTo(ciX + capWidth / 2, ciHighY);
            ctx.stroke();
        }

        // Hour label
        if (index % xTickStep === 0) {
            ctx.fillStyle = '#333';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(index.toString(), x + barWidth / 2, height - plot.bottom + 10);
        }
    });


    // Draw axes
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(plot.left, plot.top);
    ctx.lineTo(plot.left, height - plot.bottom);
    ctx.lineTo(width - plot.right, height - plot.bottom);
    ctx.stroke();

    // Y-axis label
    ctx.save();
    ctx.translate(24, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#333';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Bays Needed', 0, 0);
    ctx.restore();

    // X-axis label
    ctx.fillStyle = '#333';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Hour of Day', width / 2, height - 18);
}

// Histogram chart for distributions tab
function drawHistogram(canvasId, samples, options) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        return;
    }
    const ctx = canvas.getContext('2d');
    const { binSize, minVal, maxVal, xLabel, yLabel, gradientTop, gradientBottom, formatter, statFormatter } = options;

    const rect = canvas.parentElement.getBoundingClientRect();
    const width = Math.max(280, rect.width - 32);
    const height = 280;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const plot = { top: 32, right: 20, bottom: 62, left: 54 };

    const numBins = Math.max(1, Math.ceil((maxVal - minVal) / binSize));
    const bins = Array(numBins).fill(0);
    samples.forEach(v => {
        const idx = Math.min(numBins - 1, Math.floor((v - minVal) / binSize));
        if (idx >= 0) {
            bins[idx]++;
        }
    });

    const maxCount = bins.reduce((m, v) => Math.max(m, v), 1);
    const plotWidth = width - plot.left - plot.right;
    const plotHeight = height - plot.top - plot.bottom;
    const barW = plotWidth / numBins;
    const scaleY = plotHeight / maxCount;

    ctx.fillStyle = '#f9f9f9';
    ctx.fillRect(0, 0, width, height);

    const yStep = Math.max(1, Math.ceil(maxCount / 5));
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let y = 0; y <= maxCount; y += yStep) {
        const yPos = height - plot.bottom - y * scaleY;
        ctx.beginPath();
        ctx.moveTo(plot.left, yPos);
        ctx.lineTo(width - plot.right, yPos);
        ctx.stroke();
        ctx.fillStyle = '#666';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(y), plot.left - 6, yPos);
    }

    bins.forEach((count, i) => {
        if (count === 0) {
            return;
        }
        const x = plot.left + i * barW;
        const bh = count * scaleY;
        const y = height - plot.bottom - bh;
        const gradient = ctx.createLinearGradient(0, y, 0, height - plot.bottom);
        gradient.addColorStop(0, gradientTop);
        gradient.addColorStop(1, gradientBottom);
        ctx.fillStyle = gradient;
        ctx.fillRect(x + 1, y, Math.max(1, barW - 2), bh);
    });

    const labelStep = numBins <= 12 ? 1 : Math.ceil(numBins / 12);
    ctx.fillStyle = '#333';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    bins.forEach((_, i) => {
        if (i % labelStep === 0) {
            const x = plot.left + (i + 0.5) * barW;
            ctx.fillText(formatter(minVal + i * binSize), x, height - plot.bottom + 8);
        }
    });

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(plot.left, plot.top);
    ctx.lineTo(plot.left, height - plot.bottom);
    ctx.lineTo(width - plot.right, height - plot.bottom);
    ctx.stroke();

    ctx.save();
    ctx.translate(16, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#333';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    ctx.fillStyle = '#333';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(xLabel, width / 2, height - 14);

    if (samples.length > 0) {
        const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
        const sorted = [...samples].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        ctx.fillStyle = '#667eea';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(`n=${samples.length}  mean: ${statFormatter(mean)}  median: ${statFormatter(median)}`, width - plot.right, plot.top - 20);
    }
}

function renderDistributionsPanel(socSamples, durationSamples) {
    drawHistogram('soc-chart-canvas', socSamples, {
        binSize: 0.05,
        minVal: 0,
        maxVal: 0.85,
        xLabel: 'Arrival SOC',
        yLabel: 'Sessions',
        gradientTop: '#34d399',
        gradientBottom: '#059669',
        formatter: v => `${Math.round(v * 100)}%`,
        statFormatter: v => `${(v * 100).toFixed(1)}%`
    });

    const maxDuration = durationSamples.reduce((m, v) => Math.max(m, v), 0);
    const durationMax = Math.max(60, Math.ceil(maxDuration / 10) * 10);
    drawHistogram('duration-chart-canvas', durationSamples, {
        binSize: 5,
        minVal: 0,
        maxVal: durationMax,
        xLabel: 'Charging Duration (min)',
        yLabel: 'Sessions',
        gradientTop: '#fb923c',
        gradientBottom: '#ea580c',
        formatter: v => `${Math.round(v)}`,
        statFormatter: v => `${v.toFixed(1)} min`
    });
}

// Investment analysis tab
function showInvestmentError(message) {
    investmentError.textContent = message;
    investmentError.classList.add('show');
}

function clearInvestmentError() {
    investmentError.classList.remove('show');
}

function formatPaybackYears(value, horizon) {
    if (value === null || value === undefined) {
        return 'Never';
    }
    if (value > horizon) {
        return `>${horizon} yrs`;
    }
    return `${value.toFixed(1)} yrs`;
}

async function handleInvestmentAnalysis() {
    clearInvestmentError();

    if (!state.lastProfileConfig || !state.resultSet) {
        showInvestmentError('Run Calculate first to generate a demand profile.');
        return;
    }

    const costPerBay = Number(invCostPerBayInput.value);
    if (!isFinite(costPerBay) || costPerBay <= 0) {
        showInvestmentError('Cost per bay must be a positive number');
        return;
    }
    const marginKwh = Number(invMarginKwhInput.value);
    if (!isFinite(marginKwh) || marginKwh < 0) {
        showInvestmentError('Gross margin per kWh must be zero or positive');
        return;
    }
    const discountRate = Number(invDiscountRateInput.value);
    if (!isFinite(discountRate) || discountRate < 0 || discountRate > 50) {
        showInvestmentError('Discount rate must be between 0 and 50%');
        return;
    }
    const opexBay = Number(invOpexBayInput.value);
    if (!isFinite(opexBay) || opexBay < 0) {
        showInvestmentError('Opex per bay must be zero or positive');
        return;
    }

    // Default range brackets the selected day's peak recommendation and its CI,
    // covering "one more bay than the CI suggests" and "management adds two".
    const selected = state.resultSet.dayResults[state.selectedResultDay] || {};
    const ciLow = typeof selected.peak_bays_ci_low === 'number'
        ? selected.peak_bays_ci_low
        : (selected.peak_bays ?? 1);
    const ciHigh = typeof selected.peak_bays_ci_high === 'number'
        ? selected.peak_bays_ci_high
        : (selected.peak_bays ?? 1);
    const bayMin = Math.max(1, Math.floor(ciLow) - 1);
    const bayMax = Math.min(bayMin + 11, Math.ceil(ciHigh) + 2);

    // Analyse the day chosen in the results day picker, using the last profile
    const profile = { ...state.lastProfileConfig };
    if (profile.hourly_editor) {
        profile.hourly_editor = { ...profile.hourly_editor, active_day: state.selectedResultDay };
    }
    const selectedDayValues = state.dayValues[state.selectedResultDay] || getActiveValues();
    const selectedDaySum = selectedDayValues.reduce((a, b) => a + b, 0);
    if (selectedDaySum > 0) {
        profile.hourly_dist = selectedDayValues.map(v => v / selectedDaySum);
    }

    const requestData = {
        profile,
        investment: {
            cost_per_bay: costPerBay,
            gross_margin_per_kwh: marginKwh,
            discount_rate_pct: discountRate,
            opex_per_bay: opexBay,
            horizon_years: 10,
            bay_min: bayMin,
            bay_max: bayMax
        }
    };

    try {
        runInvestmentBtn.disabled = true;
        runInvestmentBtn.textContent = 'Analysing...';

        const response = await fetch('/api/investment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || error.error || 'Investment analysis failed');
        }

        state.investmentResult = await response.json();
        renderInvestmentResult();
    } catch (error) {
        showInvestmentError('Investment analysis error: ' + error.message);
    } finally {
        runInvestmentBtn.disabled = false;
        runInvestmentBtn.textContent = 'Run Investment Analysis';
    }
}

function renderInvestmentResult() {
    const result = state.investmentResult;
    if (!result) {
        return;
    }

    const scenarios = result.scenarios || [];
    const horizon = result.inputs?.horizon_years ?? 10;
    const selectedDayResult = state.resultSet?.dayResults?.[state.selectedResultDay];
    const recommendedBays = selectedDayResult ? selectedDayResult.peak_bays : null;

    const avgEnergy = scenarios.length > 0 ? scenarios[0].avg_energy_per_session_kwh : 0;
    investmentSummary.textContent =
        `Day analysed: ${result.day} · ${result.total_sessions} sessions/day · ` +
        `${result.simulation_runs} simulation run(s) · avg ${avgEnergy.toFixed(1)} kWh dispensed per session` +
        (recommendedBays !== null ? ` · model recommendation: ${recommendedBays} bays (highlighted)` : '');
    investmentSummary.classList.remove('hidden');

    investmentTbody.innerHTML = '';
    scenarios.forEach(s => {
        const tr = document.createElement('tr');
        if (s.bays === recommendedBays) {
            tr.classList.add('investment-row-recommended');
        }
        tr.innerHTML = `
            <td><strong>${s.bays}</strong></td>
            <td>${gbpFormatter.format(s.capex)}</td>
            <td>${s.served_sessions_per_day.toFixed(1)}</td>
            <td>${s.lost_sessions_per_day.toFixed(1)}</td>
            <td>${gbpFormatter.format(s.annual_gross_margin)}</td>
            <td>${gbpFormatter.format(s.annual_net_cashflow)}</td>
            <td>${formatPaybackYears(s.simple_payback_years, horizon)}</td>
            <td>${s.irr_pct === null ? 'n/a' : s.irr_pct.toFixed(1) + '%'}</td>
            <td>${formatPaybackYears(s.discounted_payback_years, horizon)}</td>
            <td>${gbpFormatter.format(s.npv)}</td>
        `;
        investmentTbody.appendChild(tr);
    });
    investmentTable.classList.remove('hidden');

    investmentCharts.classList.remove('hidden');
    drawInvestmentLineChart('irr-chart-canvas', scenarios, [
        { key: 'irr_pct', label: 'IRR (%)', color: '#667eea' }
    ], { yLabel: 'IRR (%)', yFormatter: v => `${v.toFixed(0)}%`, recommendedBays });

    drawInvestmentLineChart('payback-chart-canvas', scenarios, [
        { key: 'discounted_payback_years', label: 'Discounted payback', color: '#667eea' },
        { key: 'simple_payback_years', label: 'Simple payback', color: '#f59e0b' }
    ], { yLabel: 'Years', yFormatter: v => v.toFixed(0), recommendedBays });
}

// Multi-series line chart for investment scenarios (null values render as gaps)
function drawInvestmentLineChart(canvasId, scenarios, seriesDefs, options) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || scenarios.length === 0) {
        return;
    }
    const ctx = canvas.getContext('2d');

    const rect = canvas.parentElement.getBoundingClientRect();
    const width = Math.max(280, rect.width - 32);
    const height = 280;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const plot = { top: 40, right: 20, bottom: 52, left: 58 };

    ctx.fillStyle = '#f9f9f9';
    ctx.fillRect(0, 0, width, height);

    const allValues = [];
    seriesDefs.forEach(def => {
        scenarios.forEach(s => {
            const v = s[def.key];
            if (typeof v === 'number' && isFinite(v)) {
                allValues.push(v);
            }
        });
    });

    if (allValues.length === 0) {
        ctx.fillStyle = '#666';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No data for these assumptions', width / 2, height / 2);
        return;
    }

    const maxY = Math.max(...allValues);
    const yLow = Math.min(0, ...allValues);
    const yHigh = maxY > 0 ? maxY * 1.15 : 1;

    const xValues = scenarios.map(s => s.bays);
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const plotWidth = width - plot.left - plot.right;
    const plotHeight = height - plot.top - plot.bottom;
    const scaleX = xMax > xMin ? plotWidth / (xMax - xMin) : 0;
    const scaleY = plotHeight / (yHigh - yLow);

    const xPos = bays => xMax > xMin
        ? plot.left + (bays - xMin) * scaleX
        : plot.left + plotWidth / 2;
    const yPos = v => height - plot.bottom - (v - yLow) * scaleY;

    // Gridlines and y-axis labels
    const yTicks = 5;
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= yTicks; i++) {
        const v = yLow + (yHigh - yLow) * (i / yTicks);
        const y = yPos(v);
        ctx.beginPath();
        ctx.moveTo(plot.left, y);
        ctx.lineTo(width - plot.right, y);
        ctx.stroke();
        ctx.fillStyle = '#666';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(options.yFormatter(v), plot.left - 6, y);
    }

    // Recommended bay count marker
    if (typeof options.recommendedBays === 'number' &&
        options.recommendedBays >= xMin && options.recommendedBays <= xMax) {
        const x = xPos(options.recommendedBays);
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(x, plot.top);
        ctx.lineTo(x, height - plot.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#059669';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('recommended', x, plot.top - 4);
    }

    // Series lines and point markers
    seriesDefs.forEach(def => {
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        let pen = false;
        scenarios.forEach(s => {
            const v = s[def.key];
            if (typeof v !== 'number' || !isFinite(v)) {
                pen = false;
                return;
            }
            const x = xPos(s.bays);
            const y = yPos(v);
            if (pen) {
                ctx.lineTo(x, y);
            } else {
                ctx.moveTo(x, y);
                pen = true;
            }
        });
        ctx.stroke();

        scenarios.forEach(s => {
            const v = s[def.key];
            if (typeof v !== 'number' || !isFinite(v)) {
                return;
            }
            ctx.fillStyle = def.color;
            ctx.beginPath();
            ctx.arc(xPos(s.bays), yPos(v), 3, 0, Math.PI * 2);
            ctx.fill();
        });
    });

    // Axes
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(plot.left, plot.top);
    ctx.lineTo(plot.left, height - plot.bottom);
    ctx.lineTo(width - plot.right, height - plot.bottom);
    ctx.stroke();

    // X-axis ticks and label
    ctx.fillStyle = '#333';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    xValues.forEach(bays => {
        ctx.fillText(String(bays), xPos(bays), height - plot.bottom + 8);
    });
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('Number of Bays', width / 2, height - 14);

    // Y-axis label
    ctx.save();
    ctx.translate(16, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#333';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(options.yLabel, 0, 0);
    ctx.restore();

    // Legend (top-right, built right to left)
    let legendX = width - plot.right;
    for (let i = seriesDefs.length - 1; i >= 0; i--) {
        const def = seriesDefs[i];
        ctx.font = '10px sans-serif';
        const labelWidth = ctx.measureText(def.label).width;
        ctx.fillStyle = '#333';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(def.label, legendX, plot.top - 22);
        legendX -= labelWidth + 8;
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(legendX - 14, plot.top - 22);
        ctx.lineTo(legendX, plot.top - 22);
        ctx.stroke();
        legendX -= 14 + 14;
    }
}

// Error/Success messages
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
}

function showSuccess(message) {
    errorMessage.textContent = message;
    errorMessage.style.background = '#efe';
    errorMessage.style.color = '#0a7;';
    errorMessage.style.borderColor = '#cfc';
    errorMessage.classList.add('show');
    setTimeout(() => clearError(), 3000);
}

function clearError() {
    errorMessage.classList.remove('show');
    errorMessage.style.background = '';
    errorMessage.style.color = '';
    errorMessage.style.borderColor = '';
}

// Power & Charger simulation tab
function showPowerSimError(message) {
    powerSimError.textContent = message;
    powerSimError.classList.add('show');
}

function clearPowerSimError() {
    powerSimError.classList.remove('show');
}

async function handlePowerSimulation() {
    clearPowerSimError();

    if (!state.lastProfileConfig) {
        showPowerSimError('Please click "Calculate" first to generate the site demand profile');
        return;
    }

    const numChargers = parseInt(powerNumChargersInput.value, 10);
    const maxKw = parseFloat(powerMaxKwInput.value);
    const baysPerCharger = parseInt(powerBaysPerChargerInput.value, 10);

    if (isNaN(numChargers) || numChargers < 1) {
        showPowerSimError('Number of chargers must be at least 1');
        return;
    }
    if (isNaN(maxKw) || maxKw <= 0) {
        showPowerSimError('Max kW output per charger must be a positive number');
        return;
    }
    if (isNaN(baysPerCharger) || baysPerCharger < 1) {
        showPowerSimError('Bays per charger must be at least 1');
        return;
    }

    const profile = { ...state.lastProfileConfig };
    if (profile.hourly_editor) {
        profile.hourly_editor = { ...profile.hourly_editor, active_day: state.selectedResultDay };
    }
    const selectedDayValues = state.dayValues[state.selectedResultDay] || getActiveValues();
    const selectedDaySum = selectedDayValues.reduce((a, b) => a + b, 0);
    if (selectedDaySum > 0) {
        profile.hourly_dist = selectedDayValues.map(v => v / selectedDaySum);
    }

    const requestData = {
        profile,
        charger_config: {
            num_chargers: numChargers,
            max_kw_per_charger: maxKw,
            bays_per_charger: baysPerCharger
        }
    };

    try {
        runPowerSimBtn.disabled = true;
        runPowerSimBtn.textContent = 'Simulating...';

        const response = await fetch('/api/power-simulation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || error.error || 'Power simulation failed');
        }

        const result = await response.json();
        state.peakPowerNeeds = result.peak_power_needs;
        state.powerSimulationResult = result.charger_simulation;

        renderPowerNeeds(result.peak_power_needs);
        renderPowerSimulationResult(result.charger_simulation);
    } catch (error) {
        showPowerSimError('Power simulation error: ' + error.message);
    } finally {
        runPowerSimBtn.disabled = false;
        runPowerSimBtn.textContent = 'Run Power & Charger Simulation';
    }
}

function renderPowerNeeds(needs) {
    if (!needs) return;
    powerP90Val.textContent = needs.p90_kw.toFixed(1);
    powerP95Val.textContent = needs.p95_kw.toFixed(1);
    powerP99Val.textContent = needs.p99_kw.toFixed(1);

    powerDetailNote.textContent =
        `Values represent peak power per bay evaluating ${needs.concurrent_bays} concurrent bay(s). ` +
        `Single-vehicle peak power percentiles: 90% = ${needs.single_vehicle_p90_kw.toFixed(1)} kW, ` +
        `95% = ${needs.single_vehicle_p95_kw.toFixed(1)} kW, 99% = ${needs.single_vehicle_p99_kw.toFixed(1)} kW ` +
        `(average vehicle peak: ${needs.mean_kw.toFixed(1)} kW).`;
}

function renderPowerSimulationResult(sim) {
    if (!sim) {
        powerSimResults.classList.add('hidden');
        powerSimResults.innerHTML = '';
        return;
    }

    powerSimResults.classList.remove('hidden');
    powerSimResults.innerHTML = `
        <div class="results-summary-grid" style="grid-template-columns: repeat(4, minmax(0, 1fr));">
            <div class="summary-box" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                <h3>Sessions Extended</h3>
                <div class="summary-value" style="font-size: 2.2em;">${sim.delayed_sessions}</div>
                <small style="opacity: 0.9;">${sim.delayed_sessions_pct}% of total sessions</small>
            </div>
            <div class="summary-box summary-box-muted">
                <h3>Avg Dwell Time</h3>
                <div class="summary-value" style="font-size: 2em;">${sim.avg_constrained_dwell_min.toFixed(1)}m</div>
                <small style="opacity: 0.9;">vs ${sim.avg_unconstrained_dwell_min.toFixed(1)}m baseline</small>
            </div>
            <div class="summary-box summary-box-muted">
                <h3>Avg Dwell Extension</h3>
                <div class="summary-value" style="font-size: 2em;">+${sim.avg_dwell_extension_min.toFixed(1)}m</div>
                <small style="opacity: 0.9;">(+${sim.avg_extension_for_delayed_min.toFixed(1)}m for extended)</small>
            </div>
            <div class="summary-box summary-box-muted">
                <h3>Max Dwell Extension</h3>
                <div class="summary-value" style="font-size: 2em;">+${sim.max_dwell_extension_min.toFixed(1)}m</div>
                <small style="opacity: 0.9;">longest session delay</small>
            </div>
        </div>

        <div style="margin-top: 20px; background: #fff; padding: 20px; border-radius: 10px; border: 1px solid #e2e8f0;">
            <h4 style="font-size: 1.1em; color: #1e293b; margin-bottom: 12px; font-weight: 600;">Hardware & Load Balancing Summary</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; font-size: 0.95em; color: #334155;">
                <div><strong>Deployed Hardware:</strong> ${sim.num_chargers} × ${sim.max_kw_per_charger} kW chargers (${sim.bays_per_charger} bays/charger = ${sim.total_bays} total bays)</div>
                <div><strong>Power-Capped Operating Time:</strong> ${sim.power_capped_minutes.toFixed(1)} mins/day</div>
                <div><strong>Peak Site Power Drawn:</strong> ${sim.peak_power_kw.toFixed(1)} kW</div>
                <div><strong>Total Energy Delivered:</strong> ${sim.total_energy_kwh.toFixed(1)} kWh/day</div>
            </div>
        </div>
    `;
}
