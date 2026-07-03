// DOM elements
const totalSessionsInput = document.getElementById('total-sessions');
const avgServiceTimeInput = document.getElementById('avg-service-time');
const safetyBufferInput = document.getElementById('safety-buffer');
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
const resultsTable = document.getElementById('results-table');
const resultsChart = document.getElementById('results-chart');
const noResults = document.getElementById('no-results');
const maxBaysDisplay = document.getElementById('max-bays');
const resultsTbody = document.getElementById('results-tbody');

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
    dayValues: initDayValues()
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

function parseTotalSessions() {
    const value = parseInt(totalSessionsInput.value, 10);
    return Number.isNaN(value) ? 0 : value;
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
        input.step = state.mode === 'proportion' ? '0.1' : '1';
        input.value = state.mode === 'proportion' ? values[hour].toFixed(1) : String(Math.round(values[hour]));
        input.addEventListener('change', e => {
            setHourValue(hour, e.target.value);
        });

        wrap.appendChild(label);
        wrap.appendChild(input);
        hourGrid.appendChild(wrap);
    });
}

function renderSummary() {
    const values = getActiveValues();
    const total = values.reduce((a, b) => a + b, 0);

    if (state.mode === 'proportion') {
        distTotalLabel.textContent = 'Total across 24 hours';
        distSum.textContent = `${total.toFixed(1)}%`;
        distSum.classList.toggle('error', Math.abs(total - 100) > 0.5);
    } else {
        distTotalLabel.textContent = 'Total sessions';
        distSum.textContent = `${Math.round(total)} sessions`;
        distSum.classList.remove('error');
        if (total > 0) {
            totalSessionsInput.value = String(Math.round(total));
        }
    }

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
    const target = state.mode === 'proportion' ? 100 : Math.max(parseTotalSessions(), 100);
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
        return Math.round(sum);
    }
    return parseTotalSessions();
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

        totalSessionsInput.value = String(totalSessions);
        avgServiceTimeInput.value = data.calculator.avg_service_time;
        safetyBufferInput.value = data.calculator.safety_buffer;

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

    const avgServiceTime = parseFloat(avgServiceTimeInput.value);
    if (isNaN(avgServiceTime) || avgServiceTime <= 0) {
        showError('Average service time must be a positive number');
        return;
    }

    const safetyBuffer = parseFloat(safetyBufferInput.value);
    if (isNaN(safetyBuffer) || safetyBuffer < 0 || safetyBuffer > 1) {
        showError('Safety buffer must be between 0 and 1');
        return;
    }

    // Prepare request
    const requestData = {
        profile: {
            total_sessions: totalSessions,
            hourly_dist: hourlyDist,
            hourly_editor: exportHourlyEditorPayload()
        },
        calculator: {
            avg_service_time: avgServiceTime,
            safety_buffer: safetyBuffer
        }
    };

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
    modeSessionsBtn.addEventListener('click', () => {
        if (state.mode === 'sessions') {
            return;
        }
        const target = Math.max(parseTotalSessions(), 1);
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

document.addEventListener('DOMContentLoaded', () => {
    initDistributionEditor();
});

// Display results
function displayResults(result) {
    // Update summary
    maxBaysDisplay.textContent = result.peak_bays;
    resultsSummary.classList.remove('hidden');
    noResults.classList.add('hidden');

    // Populate table
    resultsTbody.innerHTML = '';
    result.results.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.hour}</td>
            <td>${row.sessions}</td>
            <td>${(row.utilisation * 100).toFixed(1)}%</td>
            <td><strong>${row.bays_needed}</strong></td>
        `;
        resultsTbody.appendChild(tr);
    });
    resultsTable.classList.remove('hidden');

    // Draw chart
    drawChart(result.results);
    resultsChart.classList.remove('hidden');
}

// Draw chart using Canvas
function drawChart(results) {
    const canvas = document.getElementById('chart-canvas');
    const ctx = canvas.getContext('2d');

    // Set canvas size
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width - 40;
    canvas.height = 300;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;

    const maxBays = Math.max(...results.map(r => r.bays_needed));
    const dataWidth = (width - padding * 2) / 24;
    const scaleY = (height - padding * 2) / (maxBays * 1.1);

    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= maxBays; i++) {
        const y = height - padding - (i * scaleY);
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();

        // Y-axis labels
        ctx.fillStyle = '#666';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(i.toString(), padding - 10, y);
    }

    // Draw bars
    results.forEach((row, index) => {
        const x = padding + (index * dataWidth) + (dataWidth * 0.1);
        const barWidth = dataWidth * 0.8;
        const barHeight = row.bays_needed * scaleY;
        const y = height - padding - barHeight;

        // Bar gradient
        const gradient = ctx.createLinearGradient(0, y, 0, height - padding);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth, barHeight);

        // Hour label
        ctx.fillStyle = '#333';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(index.toString(), x + barWidth / 2, height - padding + 10);
    });

    // Draw axes
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Y-axis label
    ctx.save();
    ctx.translate(15, height / 2);
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
    ctx.fillText('Hour of Day', width / 2, height - 10);
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
