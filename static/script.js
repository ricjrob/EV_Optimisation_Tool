// DOM Elements
const totalSessionsInput = document.getElementById('total-sessions');
const hourlyPresetSelect = document.getElementById('hourly-preset');
const hourlyDistInput = document.getElementById('hourly-dist');
const avgServiceTimeInput = document.getElementById('avg-service-time');
const utilTargetInput = document.getElementById('util-target');
const safetyBufferInput = document.getElementById('safety-buffer');
const calculateBtn = document.getElementById('calculate-btn');
const loadExampleBtn = document.getElementById('load-example-btn');
const normalizeBtn = document.getElementById('normalize-btn');
const errorMessage = document.getElementById('error-message');
const distSum = document.getElementById('dist-sum');

const resultsSummary = document.getElementById('results-summary');
const resultsTable = document.getElementById('results-table');
const resultsChart = document.getElementById('results-chart');
const noResults = document.getElementById('no-results');
const maxBaysDisplay = document.getElementById('max-bays');
const resultsTbody = document.getElementById('results-tbody');

// Preset distributions
const presets = {
    even: Array(24).fill(1 / 24),
    'peak-morning': [
        0.02, 0.02, 0.02, 0.02, 0.03,  // 0-4
        0.05, 0.06, 0.07, 0.08, 0.08,  // 5-9
        0.08, 0.08, 0.07, 0.06, 0.05,  // 10-14
        0.06, 0.07, 0.08, 0.08, 0.07,  // 15-19
        0.06, 0.04, 0.03, 0.02          // 20-23
    ],
    'peak-afternoon': [
        0.02, 0.02, 0.02, 0.02, 0.02,  // 0-4
        0.03, 0.04, 0.05, 0.05, 0.06,  // 5-9
        0.07, 0.08, 0.09, 0.09, 0.08,  // 10-14
        0.09, 0.09, 0.08, 0.07, 0.06,  // 15-19
        0.05, 0.04, 0.03, 0.02          // 20-23
    ],
    'night-friendly': [
        0.03, 0.02, 0.01, 0.01, 0.01,  // 0-4
        0.02, 0.03, 0.04, 0.05, 0.05,  // 5-9
        0.05, 0.05, 0.05, 0.05, 0.05,  // 10-14
        0.05, 0.05, 0.05, 0.04, 0.03,  // 15-19
        0.06, 0.08, 0.09, 0.06          // 20-23
    ]
};

// Event Listeners
calculateBtn.addEventListener('click', handleCalculate);
loadExampleBtn.addEventListener('click', loadExample);
normalizeBtn.addEventListener('click', normalizeDistribution);
hourlyPresetSelect.addEventListener('change', applyPreset);
hourlyDistInput.addEventListener('input', updateDistributionSum);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    applyPreset();
    updateDistributionSum();
});

// Apply preset distribution
function applyPreset() {
    const preset = hourlyPresetSelect.value;
    if (preset !== 'custom' && presets[preset]) {
        hourlyDistInput.value = presets[preset].map(v => v.toFixed(4)).join(', ');
        updateDistributionSum();
    }
}

// Update distribution sum display
function updateDistributionSum() {
    const values = parseDistribution();
    if (values) {
        const sum = values.reduce((a, b) => a + b, 0);
        distSum.textContent = `Sum: ${sum.toFixed(4)}`;

        // Change color based on validity
        if (Math.abs(sum - 1.0) < 0.001) {
            distSum.style.color = '#0a7;';
        } else if (sum === 0) {
            distSum.style.color = '#666';
        } else {
            distSum.style.color = '#a70;';
        }
    }
}

// Parse distribution input
function parseDistribution() {
    const text = hourlyDistInput.value.trim();
    if (!text) return null;

    try {
        const values = text.split(',').map(v => parseFloat(v.trim()));

        if (values.length !== 24) {
            showError(`Distribution must have exactly 24 values, got ${values.length}`);
            return null;
        }

        if (values.some(v => isNaN(v) || v < 0 || v > 1)) {
            showError('All values must be numbers between 0 and 1');
            return null;
        }

        return values;
    } catch (e) {
        showError('Invalid distribution format: ' + e.message);
        return null;
    }
}

// Normalize distribution to sum to 1.0
function normalizeDistribution() {
    const values = parseDistribution();
    if (!values) return;

    const sum = values.reduce((a, b) => a + b, 0);
    if (sum === 0) {
        showError('Cannot normalize: sum is 0');
        return;
    }

    const normalized = values.map(v => v / sum);
    hourlyDistInput.value = normalized.map(v => v.toFixed(4)).join(', ');
    updateDistributionSum();
    showSuccess('Distribution normalized to sum to 1.0');
}

// Load example configuration
async function loadExample() {
    try {
        const response = await fetch('/api/example');
        if (!response.ok) throw new Error('Failed to load example');

        const data = await response.json();

        totalSessionsInput.value = data.profile.total_sessions;
        hourlyDistInput.value = data.profile.hourly_dist.map(v => v.toFixed(4)).join(', ');
        avgServiceTimeInput.value = data.calculator.avg_service_time;
        utilTargetInput.value = data.calculator.util_target;
        safetyBufferInput.value = data.calculator.safety_buffer;
        hourlyPresetSelect.value = 'peak-morning';

        updateDistributionSum();
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
    const totalSessions = parseInt(totalSessionsInput.value);
    if (isNaN(totalSessions) || totalSessions < 1) {
        showError('Total sessions must be a positive number');
        return;
    }

    const hourlyDist = parseDistribution();
    if (!hourlyDist) return;

    const sum = hourlyDist.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.001) {
        showError(`Distribution must sum to 1.0 (current sum: ${sum.toFixed(4)}). Click "Normalize" to fix.`);
        return;
    }

    const avgServiceTime = parseFloat(avgServiceTimeInput.value);
    if (isNaN(avgServiceTime) || avgServiceTime <= 0) {
        showError('Average service time must be a positive number');
        return;
    }

    const utilTarget = parseFloat(utilTargetInput.value);
    if (isNaN(utilTarget) || utilTarget < 0 || utilTarget > 1) {
        showError('Utilisation target must be between 0 and 1');
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
            hourly_dist: hourlyDist
        },
        calculator: {
            avg_service_time: avgServiceTime,
            util_target: utilTarget,
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
            throw new Error(error.error || 'Calculation failed');
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
