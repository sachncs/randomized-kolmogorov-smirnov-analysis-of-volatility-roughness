/**
 * RK-SAVR Observatory — Real-Time H-Estimation Dashboard.
 * Live trajectory, animated rolling estimation, and diagnostic readouts.
 */

import Plotly from 'plotly.js-dist-min';
import {
  dispatchWorker,
  killWorker,
  themedLayout,
  plotlyConfig,
  debounce,
  fmt,
} from './app.js';

// --------------------------------------------------------------------------
// State
// --------------------------------------------------------------------------

const state = {
  trueH: 0.1,
  model: 'fBM',
  nSteps: 2000,
  windowSize: 500,
  sampleSize: 500,
  iterations: 16,
  optimizer: 'brent',
  scaleA1: 1,
  scaleA2: 25,
  path: [],
  rolling: [],
  isRunning: false,
  animationId: null,
  seriesChart: null,
  hChart: null,
};

// --------------------------------------------------------------------------
// DOM Builders
// --------------------------------------------------------------------------

/**
 * Creates a labeled form control group.
 * @param {string} label Label text.
 * @param {string} innerHTML Control HTML.
 * @return {HTMLDivElement} Control group element.
 */
function createControlGroup(label, innerHTML) {
  const div = document.createElement('div');
  div.className = 'form-group';
  div.innerHTML = `<label class="form-label">${label}</label>${innerHTML}`;
  return div;
}

/**
 * Builds the dashboard control panel.
 * @param {HTMLElement} container
 * @return {void}
 */
function buildControls(container) {
  const grid = document.createElement('div');
  grid.className = 'metrics-grid';
  grid.style.marginBottom = '1.5rem';

  const modelSel = createControlGroup(
    'Model',
    `<select class="form-control" id="dash-model">
      <option value="fBM">Fractional Brownian Motion</option>
      <option value="rBergomi">Rough Bergomi</option>
      <option value="rFSV">Rough FSV</option>
      <option value="fOU">Fractional OU</option>
      <option value="mPRE">MPRE</option>
    </select>`,
  );

  const hSlider = createControlGroup(
    'True H',
    `<input type="range" id="dash-h" min="0.01" max="0.49" step="0.01" value="0.1">
     <div class="text-mono text-muted" style="margin-top:4px;font-size:0.75rem">
       <span id="dash-h-val">0.10</span>
     </div>`,
  );

  const nInput = createControlGroup(
    'Path Length',
    `<input type="number" class="form-control" id="dash-n" value="2000" min="500" max="10000" step="100">`,
  );

  const winInput = createControlGroup(
    'Window Size',
    `<input type="number" class="form-control" id="dash-win" value="500" min="100" max="5000" step="50">`,
  );

  const sampInput = createControlGroup(
    'Sample Size',
    `<input type="number" class="form-control" id="dash-samp" value="500" min="50" max="2000" step="50">`,
  );

  const iterInput = createControlGroup(
    'Iterations',
    `<input type="number" class="form-control" id="dash-iter" value="16" min="1" max="64" step="1">`,
  );

  const optSel = createControlGroup(
    'Optimizer',
    `<select class="form-control" id="dash-opt">
      <option value="brent">Brent</option>
      <option value="nelder-mead">Nelder-Mead</option>
      <option value="annealing">Simulated Annealing</option>
      <option value="de">Differential Evolution</option>
      <option value="ags">Adaptive Grid Search</option>
    </select>`,
  );

  grid.append(
    modelSel,
    hSlider,
    nInput,
    winInput,
    sampInput,
    iterInput,
    optSel,
  );
  container.appendChild(grid);

  const actions = document.createElement('div');
  actions.className = 'row';
  actions.innerHTML = `
    <button class="btn btn-secondary" id="dash-gen">Generate Path</button>
    <button class="btn btn-primary" id="dash-run">Run Estimation</button>
    <button class="btn btn-secondary" id="dash-stop" disabled>Stop</button>
  `;
  container.appendChild(actions);

  const progress = document.createElement('div');
  progress.className = 'panel';
  progress.style.marginTop = '1.5rem';
  progress.innerHTML = `
    <div class="panel-header">
      <span class="panel-subtitle">Progress</span>
      <span class="badge badge-amber" id="dash-status">Idle</span>
    </div>
    <div class="progress-bar"><div class="progress-fill" id="dash-progress" style="width:0%"></div></div>
  `;
  container.appendChild(progress);
}

/**
 * Builds chart panels.
 * @param {HTMLElement} container
 * @return {void}
 */
function buildCharts(container) {
  const row1 = document.createElement('div');
  row1.className = 'row';
  row1.innerHTML = `
    <div class="panel">
      <div class="panel-header"><span class="panel-title">Synthetic Path</span></div>
      <div id="dash-path-chart" class="chart-box"></div>
    </div>
    <div class="panel">
      <div class="panel-header"><span class="panel-title">H Trajectory</span></div>
      <div id="dash-h-chart" class="chart-box"></div>
    </div>
  `;
  container.appendChild(row1);
}

/**
 * Builds metric cards.
 * @param {HTMLElement} container
 * @return {void}
 */
function buildMetrics(container) {
  const grid = document.createElement('div');
  grid.className = 'metrics-grid';
  grid.id = 'dash-metrics';
  grid.innerHTML = `
    <div class="metric-card"><div class="metric-label">Mean Ĥ</div><div class="metric-value" id="m-avg">—</div></div>
    <div class="metric-card"><div class="metric-label">Bias</div><div class="metric-value is-cyan" id="m-bias">—</div></div>
    <div class="metric-card"><div class="metric-label">RMSE</div><div class="metric-value is-crimson" id="m-rmse">—</div></div>
    <div class="metric-card"><div class="metric-label">Std Dev</div><div class="metric-value" id="m-std">—</div></div>
  `;
  container.appendChild(grid);
}

/**
 * Builds the diagnostics panel.
 * @param {HTMLElement} container
 * @return {void}
 */
function buildDiagnostics(container) {
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="panel-header"><span class="panel-title">Last Window Diagnostics</span></div>
    <table class="data-table">
      <tbody>
        <tr><td>KS Distance D</td><td class="text-mono text-amber" id="d-ks">—</td></tr>
        <tr><td>p-Value</td><td class="text-mono text-cyan" id="d-pv">—</td></tr>
        <tr><td>Significant?</td><td class="text-mono" id="d-sig">—</td></tr>
        <tr><td>Standard Error</td><td class="text-mono" id="d-se">—</td></tr>
        <tr><td>95% CI</td><td class="text-mono" id="d-ci">—</td></tr>
      </tbody>
    </table>
  `;
  container.appendChild(panel);
}

// --------------------------------------------------------------------------
// Chart Rendering
// --------------------------------------------------------------------------

/**
 * Renders the synthetic path chart.
 * @return {void}
 */
function renderPathChart() {
  const trace = {
    y: state.path,
    type: 'scatter',
    mode: 'lines',
    line: {color: '#f0a030', width: 1},
    fill: 'tozeroy',
    fillcolor: 'rgba(240,160,48,0.05)',
  };
  Plotly.newPlot(
    'dash-path-chart',
    [trace],
    themedLayout({xaxis: {visible: false}}),
    plotlyConfig,
  );
}

/**
 * Renders the H trajectory chart.
 * @return {void}
 */
function renderHChart() {
  const x = state.rolling.map((r) => r.t);
  const y = state.rolling.map((r) => r.H);
  const traceEst = {
    x,
    y,
    name: 'Estimated Ĥ',
    type: 'scatter',
    mode: 'lines',
    line: {color: '#30d0f0', width: 1.5},
  };
  const traceTrue = {
    x: [x[0] || 0, x[x.length - 1] || 0],
    y: [state.trueH, state.trueH],
    name: 'True H',
    mode: 'lines',
    line: {color: 'rgba(106,122,144,0.5)', dash: 'dash', width: 1},
  };
  Plotly.newPlot(
    'dash-h-chart',
    [traceEst, traceTrue],
    themedLayout({yaxis: {range: [0, 0.6]}}),
    plotlyConfig,
  );
}

// --------------------------------------------------------------------------
// Actions
// --------------------------------------------------------------------------

/**
 * Generates a synthetic path from the selected model.
 * @return {Promise<void>} Resolves when path generation completes.
 */
async function generatePath() {
  const btn = document.getElementById('dash-gen');
  btn.disabled = true;
  setStatus('Generating...');

  try {
    const res = await dispatchWorker('generate', {
      model: state.model,
      nSteps: state.nSteps,
      h: state.trueH,
      seed: Math.floor(Math.random() * 1e9),
    });
    state.path = res.path;
    state.rolling = [];
    renderPathChart();
    updateMetrics([]);
    updateDiagnostics(null);
    setStatus('Path Ready');
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

/**
 * Runs rolling H estimation.
 * @return {Promise<void>} Resolves when estimation completes.
 */
async function runEstimation() {
  if (state.isRunning || state.path.length === 0) return;
  state.isRunning = true;
  document.getElementById('dash-run').disabled = true;
  document.getElementById('dash-stop').disabled = false;
  setStatus('Estimating...');
  updateProgress(0);

  const step = Math.max(1, Math.floor(state.windowSize / 8));
  const config = {
    scaleA1: state.scaleA1,
    scaleA2: state.scaleA2,
    sampleSize: state.sampleSize,
    iterations: state.iterations,
    optimizerType: state.optimizer,
  };

  try {
    const {results} = await dispatchWorker(
      'rolling',
      {path: state.path, windowSize: state.windowSize, step, config},
      (p) => updateProgress(p),
    );

    state.rolling = results;
    renderHChart();
    updateMetrics(results);
    await runDiagnostics(results);
    setStatus('Complete');
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  } finally {
    state.isRunning = false;
    document.getElementById('dash-run').disabled = false;
    document.getElementById('dash-stop').disabled = true;
    updateProgress(1);
  }
}

/**
 * Runs diagnostics on the last valid window.
 * @param {Array<Object>} results Rolling results.
 * @return {Promise<void>} Resolves when diagnostics complete.
 */
async function runDiagnostics(results) {
  const valid = results.filter((r) => Number.isFinite(r.H));
  if (valid.length === 0) return;
  const last = valid[valid.length - 1];
  const t = last.t;
  const w = state.windowSize;
  const slice = state.path.slice(t, t + w);
  if (slice.length < w) return;

  const config = {
    scaleA1: state.scaleA1,
    scaleA2: state.scaleA2,
    sampleSize: state.sampleSize,
    iterations: state.iterations,
    optimizerType: state.optimizer,
  };

  try {
    const diag = await dispatchWorker('single', {path: slice, config});
    updateDiagnostics(diag);
  } catch (_err) {
    updateDiagnostics(null);
  }
}

/**
 * Stops the current estimation.
 * @return {void}
 */
function stopEstimation() {
  killWorker();
  state.isRunning = false;
  document.getElementById('dash-run').disabled = false;
  document.getElementById('dash-stop').disabled = true;
  setStatus('Stopped');
}

// --------------------------------------------------------------------------
// UI Updates
// --------------------------------------------------------------------------

/**
 * Updates the status badge text.
 * @param {string} text
 * @return {void}
 */
function setStatus(text) {
  const el = document.getElementById('dash-status');
  if (el) el.textContent = text;
}

/**
 * Updates the progress bar width.
 * @param {number} p Progress fraction [0,1].
 * @return {void}
 */
function updateProgress(p) {
  const el = document.getElementById('dash-progress');
  if (el) el.style.width = `${(p * 100).toFixed(0)}%`;
}

/**
 * Updates metric cards from results.
 * @param {Array<Object>} results Rolling results.
 * @return {void}
 */
function updateMetrics(results) {
  const valid = results.filter((r) => Number.isFinite(r.H));
  const avg = valid.length
    ? valid.reduce((a, b) => a + b.H, 0) / valid.length
    : null;
  const bias = avg !== null ? avg - state.trueH : null;
  const rmse = valid.length
    ? Math.sqrt(
        valid.reduce((a, b) => a + (b.H - state.trueH) ** 2, 0) / valid.length,
      )
    : null;
  const mean = avg;
  const std = valid.length
    ? Math.sqrt(valid.reduce((a, b) => a + (b.H - mean) ** 2, 0) / valid.length)
    : null;

  document.getElementById('m-avg').textContent = fmt(avg);
  document.getElementById('m-bias').textContent = fmt(bias);
  document.getElementById('m-rmse').textContent = fmt(rmse);
  document.getElementById('m-std').textContent = fmt(std);
}

/**
 * Updates the diagnostics table.
 * @param {Object|null} diag Diagnostics object.
 * @return {void}
 */
function updateDiagnostics(diag) {
  if (!diag) {
    ['d-ks', 'd-pv', 'd-sig', 'd-se', 'd-ci'].forEach((id) => {
      document.getElementById(id).textContent = '—';
    });
    return;
  }
  document.getElementById('d-ks').textContent = fmt(diag.minimizedD, 4);
  document.getElementById('d-pv').textContent = fmt(
    diag.significance?.pValue,
    4,
  );
  const sig = diag.significance?.significant;
  const sigEl = document.getElementById('d-sig');
  sigEl.textContent = sig === true ? 'Yes' : sig === false ? 'No' : '—';
  sigEl.className = `text-mono ${sig ? 'text-cyan' : 'text-muted'}`;
  document.getElementById('d-se').textContent = fmt(diag.se, 4);
  const ci = diag.ci;
  document.getElementById('d-ci').textContent = ci
    ? `[${fmt(ci.lower, 3)}, ${fmt(ci.upper, 3)}]`
    : '—';
}

// --------------------------------------------------------------------------
// Binding
// --------------------------------------------------------------------------

/**
 * Binds DOM event listeners.
 * @return {void}
 */
function bindControls() {
  document.getElementById('dash-model').addEventListener('change', (e) => {
    state.model = e.target.value;
  });
  document.getElementById('dash-h').addEventListener(
    'input',
    debounce((e) => {
      state.trueH = parseFloat(e.target.value);
      document.getElementById('dash-h-val').textContent =
        state.trueH.toFixed(2);
    }, 50),
  );
  document.getElementById('dash-n').addEventListener('change', (e) => {
    state.nSteps = parseInt(e.target.value, 10);
  });
  document.getElementById('dash-win').addEventListener('change', (e) => {
    state.windowSize = parseInt(e.target.value, 10);
  });
  document.getElementById('dash-samp').addEventListener('change', (e) => {
    state.sampleSize = parseInt(e.target.value, 10);
  });
  document.getElementById('dash-iter').addEventListener('change', (e) => {
    state.iterations = parseInt(e.target.value, 10);
  });
  document.getElementById('dash-opt').addEventListener('change', (e) => {
    state.optimizer = e.target.value;
  });

  document.getElementById('dash-gen').addEventListener('click', generatePath);
  document.getElementById('dash-run').addEventListener('click', runEstimation);
  document
    .getElementById('dash-stop')
    .addEventListener('click', stopEstimation);
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/**
 * Initializes the dashboard component.
 * @param {string} rootId Container element ID.
 * @return {{pause: function(): void, resume: function(): void}} Dashboard component.
 */
export function initDashboard(rootId) {
  const root = document.getElementById(rootId);
  if (!root) return {};

  buildControls(root);
  buildCharts(root);
  buildMetrics(root);
  buildDiagnostics(root);
  bindControls();

  // Generate initial path
  setTimeout(generatePath, 300);

  return {
    pause: () => {
      if (state.isRunning) stopEstimation();
    },
    resume: () => {},
  };
}
