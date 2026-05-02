import { generateFBM } from '../lib/fbm.js';
import Plotly from 'plotly.js-dist-min';

// DOM Elements
const hurstInput = document.getElementById('hurstInput');
const hurstValueDisplay = document.getElementById('hurstValue');
const lengthInput = document.getElementById('lengthInput');
const windowInput = document.getElementById('windowInput');
const sampleInput = document.getElementById('sampleInput');
const iterInput = document.getElementById('iterInput');
const runBtn = document.getElementById('runBtn');
const avgHDisplay = document.getElementById('avgHDisplay');
const errorHDisplay = document.getElementById('errorHDisplay');
const statusText = document.getElementById('statusText');
const statusDot = document.getElementById('statusDot');
const progressBox = document.getElementById('progressBox');
const progressBar = document.getElementById('progressBar');

// Worker instance
let worker = null;

// Initialize charts
const chartConfig = {
    responsive: true,
    displayModeBar: false
};

const chartLayout = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#94a3b8', family: 'Outfit' },
    margin: { t: 10, b: 40, l: 50, r: 10 },
    xaxis: { gridcolor: 'rgba(255,255,255,0.05)', zeroline: false },
    yaxis: { gridcolor: 'rgba(255,255,255,0.05)', zeroline: false }
};

// Update slider display
hurstInput.addEventListener('input', () => {
    hurstValueDisplay.textContent = parseFloat(hurstInput.value).toFixed(2);
});

async function runAnalysis() {
    // UI Setup
    statusText.textContent = 'Generating Path...';
    statusDot.classList.add('busy');
    runBtn.disabled = true;
    progressBox.classList.remove('hidden');
    progressBar.style.width = '0%';

    const trueH = parseFloat(hurstInput.value);
    const n = parseInt(lengthInput.value);
    const windowSize = parseInt(windowInput.value);
    
    // Config for library
    const config = {
        sampleSize: parseInt(sampleInput.value),
        iterations: parseInt(iterInput.value),
        scaleA1: 1,
        scaleA2: 25 // Optimization for demo
    };

    // 1. Generate Data
    const series = generateFBM(n, trueH);
    renderSeries(series);

    // 2. Start Worker
    if (worker) worker.terminate();
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

    worker.onmessage = (e) => {
        const { type, progress, results } = e.data;
        
        if (type === 'progress') {
            statusText.textContent = `Analyzing (${(progress * 100).toFixed(0)}%)`;
            progressBar.style.width = `${progress * 100}%`;
        } else if (type === 'complete') {
            handleCompletion(results, trueH);
        }
    };

    worker.onerror = (err) => {
        console.error('Worker error:', err);
        statusText.textContent = 'Error in Worker';
        runBtn.disabled = false;
    };

    worker.postMessage({
        series,
        windowSize,
        step: 25, // Step size for visual continuity
        config
    });
}

function handleCompletion(results, trueH) {
    statusText.textContent = 'Analysis Complete';
    statusDot.classList.remove('busy');
    runBtn.disabled = false;
    progressBox.classList.add('hidden');

    const avgH = results.reduce((a, b) => a + b.H, 0) / results.length;
    avgHDisplay.textContent = avgH.toFixed(3);
    errorHDisplay.textContent = (avgH - trueH).toFixed(3);

    renderResults(results, trueH);
}

function renderSeries(series) {
    const trace = {
        y: series,
        type: 'scatter',
        mode: 'lines',
        line: { color: '#38bdf8', width: 1.5 },
        fill: 'tozeroy',
        fillcolor: 'rgba(56, 189, 248, 0.05)'
    };
    
    Plotly.newPlot('seriesChart', [trace], {
        ...chartLayout,
        xaxis: { ...chartLayout.xaxis, visible: false }
    }, chartConfig);
}

function renderResults(results, trueH) {
    const x = results.map(r => r.t);
    const y = results.map(r => r.H);

    const traceEstimate = {
        x: x,
        y: y,
        name: 'Estimated Ĥ',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#f472b6', width: 2 },
        marker: { size: 4 },
        fill: 'tozeroy',
        fillcolor: 'rgba(244, 114, 182, 0.05)'
    };

    const traceTrue = {
        x: [x[0], x[x.length - 1]],
        y: [trueH, trueH],
        name: 'Target H',
        mode: 'lines',
        line: { color: 'rgba(255,255,255,0.3)', dash: 'dash', width: 1 }
    };

    Plotly.newPlot('resultsChart', [traceEstimate, traceTrue], {
        ...chartLayout,
        yaxis: { ...chartLayout.yaxis, range: [0, 1] }
    }, chartConfig);
}

runBtn.addEventListener('click', runAnalysis);

// Auto-run on load
window.addEventListener('load', () => {
    setTimeout(runAnalysis, 500);
});
