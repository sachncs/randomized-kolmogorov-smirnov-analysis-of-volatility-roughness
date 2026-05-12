/**
 * RK-SAVR Observatory — Parameter Explorer.
 * Grid search across Hurst values, window sizes, and optimizers.
 */

import Plotly from 'plotly.js-dist-min';
import {
  dispatchWorker,
  killWorker,
  themedLayout,
  plotlyConfig,
  fmt,
} from './app.js';

const state = {
  hStart: 0.05,
  hEnd: 0.45,
  hStep: 0.05,
  windowSizes: [250, 500, 1000],
  optimizers: ['brent', 'nelder-mead', 'annealing', 'de', 'ags'],
  nTrials: 5,
  pathLength: 1500,
  results: [],
  isRunning: false,
};

/**
 * Builds the explorer control panel.
 * @param {HTMLElement} container
 * @return {void}
 */
function buildControls(container) {
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="panel-header"><span class="panel-title">Search Space</span></div>
    <div class="row" style="margin-bottom:0">
      <div class="form-group">
        <label class="form-label">H Range</label>
        <div style="display:flex;gap:0.5rem">
          <input type="number" class="form-control" id="exp-h0" value="0.05" min="0.01" max="0.99" step="0.01" style="flex:1">
          <input type="number" class="form-control" id="exp-h1" value="0.45" min="0.01" max="0.99" step="0.01" style="flex:1">
          <input type="number" class="form-control" id="exp-hs" value="0.05" min="0.01" max="0.5" step="0.01" style="flex:1">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Window Sizes</label>
        <input type="text" class="form-control" id="exp-wins" value="250, 500, 1000">
      </div>
      <div class="form-group">
        <label class="form-label">Optimizers</label>
        <div id="exp-opts" style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.5rem">
          ${['brent', 'nelder-mead', 'annealing', 'de', 'ags']
            .map(
              (o) => `
            <label style="display:flex;align-items:center;gap:0.25rem;cursor:pointer;font-size:0.8125rem;color:var(--text-secondary)">
              <input type="checkbox" value="${o}" checked> ${o}
            </label>
          `,
            )
            .join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Trials / Config</label>
        <input type="number" class="form-control" id="exp-trials" value="5" min="1" max="20">
      </div>
      <div class="form-group">
        <label class="form-label">Path Length</label>
        <input type="number" class="form-control" id="exp-len" value="1500" min="500" max="5000" step="100">
      </div>
    </div>
    <div style="display:flex;gap:0.75rem;margin-top:1rem">
      <button class="btn btn-primary" id="exp-run">Run Grid Search</button>
      <button class="btn btn-secondary" id="exp-stop" disabled>Stop</button>
    </div>
  `;
  container.appendChild(panel);

  const prog = document.createElement('div');
  prog.className = 'panel';
  prog.style.marginTop = '1.5rem';
  prog.innerHTML = `
    <div class="panel-header">
      <span class="panel-subtitle">Progress</span>
      <span class="badge badge-amber" id="exp-status">Idle</span>
    </div>
    <div class="progress-bar"><div class="progress-fill" id="exp-progress" style="width:0%"></div></div>
  `;
  container.appendChild(prog);
}

/**
 * Builds chart panels.
 * @param {HTMLElement} container
 * @return {void}
 */
function buildCharts(container) {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `
    <div class="panel">
      <div class="panel-header"><span class="panel-title">RMSE Heatmap</span><span class="panel-subtitle">H × Window Size</span></div>
      <div id="exp-heatmap" class="chart-box" style="min-height:360px"></div>
    </div>
    <div class="panel">
      <div class="panel-header"><span class="panel-title">Optimizer Comparison</span><span class="panel-subtitle">Mean RMSE per Optimizer</span></div>
      <div id="exp-bar" class="chart-box" style="min-height:360px"></div>
    </div>
  `;
  container.appendChild(row);
}

/**
 * Builds the results table.
 * @param {HTMLElement} container
 * @return {void}
 */
function buildTable(container) {
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.style.marginTop = '1.5rem';
  panel.innerHTML = `
    <div class="panel-header"><span class="panel-title">Results</span></div>
    <div style="overflow-x:auto">
      <table class="data-table" id="exp-table">
        <thead><tr>
          <th>True H</th><th>Window</th><th>Optimizer</th><th>RMSE</th><th>Bias</th><th>Fail Rate</th><th>Avg Time (ms)</th>
        </tr></thead>
        <tbody></tbody>
      </table>
    </div>
  `;
  container.appendChild(panel);
}

/**
 * Parses a comma-separated window size string.
 * @param {string} str
 * @return {Array<number>} Parsed window sizes.
 */
function parseWindows(str) {
  return str
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
}

/**
 * Returns the list of selected optimizers.
 * @return {Array<string>} Selected optimizer names.
 */
function getSelectedOptimizers() {
  return Array.from(document.querySelectorAll('#exp-opts input:checked')).map(
    (i) => i.value,
  );
}

/**
 * Updates the status badge.
 * @param {string} text
 * @return {void}
 */
function updateStatus(text) {
  const el = document.getElementById('exp-status');
  if (el) el.textContent = text;
}

/**
 * Updates the progress bar.
 * @param {number} p
 * @return {void}
 */
function updateProgress(p) {
  const el = document.getElementById('exp-progress');
  if (el) el.style.width = `${(p * 100).toFixed(0)}%`;
}

/**
 * Renders the RMSE heatmap chart.
 * @return {void}
 */
function renderHeatmap() {
  const byWin = new Map();
  for (const r of state.results) {
    if (!byWin.has(r.windowSize)) byWin.set(r.windowSize, []);
    byWin.get(r.windowSize).push(r);
  }

  const windows = Array.from(byWin.keys()).sort((a, b) => a - b);
  const hs = [...new Set(state.results.map((r) => r.trueH))].sort(
    (a, b) => a - b,
  );

  const traces = windows.map((w) => {
    const rows = byWin.get(w).filter((r) => Number.isFinite(r.rmse));
    const z = hs.map((h) => {
      const row = rows.find((r) => Math.abs(r.trueH - h) < 1e-9);
      return row ? row.rmse : null;
    });
    return {
      x: hs,
      y: z,
      name: `W=${w}`,
      type: 'scatter',
      mode: 'lines+markers',
      line: {width: 2},
      marker: {size: 6},
    };
  });

  const colors = ['#f0a030', '#30d0f0', '#e03060', '#8a9ab0', '#c8d0e0'];
  traces.forEach((t, i) => {
    t.line.color = colors[i % colors.length];
    t.marker.color = colors[i % colors.length];
  });

  Plotly.newPlot(
    'exp-heatmap',
    traces,
    themedLayout({
      yaxis: {title: 'RMSE', type: 'log'},
      xaxis: {title: 'True H'},
      legend: {orientation: 'h', y: -0.2},
    }),
    plotlyConfig,
  );
}

/**
 * Renders the optimizer comparison bar chart.
 * @return {void}
 */
function renderBarChart() {
  const byOpt = new Map();
  for (const r of state.results) {
    if (!Number.isFinite(r.rmse)) continue;
    if (!byOpt.has(r.optimizer)) byOpt.set(r.optimizer, []);
    byOpt.get(r.optimizer).push(r);
  }

  const opts = Array.from(byOpt.keys());
  const means = opts.map((o) => {
    const vals = byOpt.get(o).map((r) => r.rmse);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });

  const trace = {
    x: opts,
    y: means,
    type: 'bar',
    marker: {
      color: means.map((_, i) => {
        const colors = ['#f0a030', '#30d0f0', '#e03060', '#8a9ab0', '#c8d0e0'];
        return colors[i % colors.length];
      }),
    },
  };

  Plotly.newPlot(
    'exp-bar',
    [trace],
    themedLayout({
      yaxis: {title: 'Mean RMSE', type: 'log'},
      xaxis: {title: 'Optimizer'},
    }),
    plotlyConfig,
  );
}

/**
 * Renders the results table.
 * @return {void}
 */
function renderTable() {
  const tbody = document.querySelector('#exp-table tbody');
  if (!tbody) return;
  tbody.innerHTML = state.results
    .map(
      (r) => `
    <tr>
      <td>${fmt(r.trueH)}</td>
      <td>${r.windowSize}</td>
      <td>${r.optimizer}</td>
      <td>${fmt(r.rmse, 4)}</td>
      <td>${fmt(r.bias, 4)}</td>
      <td>${fmt(r.failRate, 2)}</td>
      <td>${Math.round(r.avgTime)}</td>
    </tr>
  `,
    )
    .join('');
}

/**
 * Runs the parameter grid search.
 * @return {Promise<void>} Resolves when grid search completes.
 */
async function runGridSearch() {
  if (state.isRunning) return;
  state.isRunning = true;
  document.getElementById('exp-run').disabled = true;
  document.getElementById('exp-stop').disabled = false;
  updateStatus('Running...');
  updateProgress(0);

  const trueHs = [];
  for (let h = state.hStart; h <= state.hEnd + 1e-9; h += state.hStep) {
    trueHs.push(Math.round(h * 100) / 100);
  }

  try {
    const {results} = await dispatchWorker(
      'explorer',
      {
        trueHs,
        windowSizes: state.windowSizes,
        optimizers: state.optimizers,
        nTrials: state.nTrials,
        pathLength: state.pathLength,
        configBase: {scaleA1: 1, scaleA2: 25, sampleSize: 500, iterations: 8},
      },
      (p) => updateProgress(p),
    );

    state.results = results;
    renderHeatmap();
    renderBarChart();
    renderTable();
    updateStatus('Complete');
  } catch (err) {
    updateStatus(`Error: ${err.message}`);
  } finally {
    state.isRunning = false;
    document.getElementById('exp-run').disabled = false;
    document.getElementById('exp-stop').disabled = true;
    updateProgress(1);
  }
}

/**
 * Stops the grid search.
 * @return {void}
 */
function stopSearch() {
  killWorker();
  state.isRunning = false;
  document.getElementById('exp-run').disabled = false;
  document.getElementById('exp-stop').disabled = true;
  updateStatus('Stopped');
}

/**
 * Binds DOM event listeners.
 * @return {void}
 */
function bindControls() {
  const bind = (id, key, parser) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      state[key] = parser(el.value);
    });
  };

  bind('exp-h0', 'hStart', parseFloat);
  bind('exp-h1', 'hEnd', parseFloat);
  bind('exp-hs', 'hStep', parseFloat);
  document.getElementById('exp-wins').addEventListener('change', () => {
    state.windowSizes = parseWindows(document.getElementById('exp-wins').value);
  });
  document.getElementById('exp-trials').addEventListener('change', () => {
    state.nTrials = parseInt(document.getElementById('exp-trials').value, 10);
  });
  document.getElementById('exp-len').addEventListener('change', () => {
    state.pathLength = parseInt(document.getElementById('exp-len').value, 10);
  });
  document.getElementById('exp-opts').addEventListener('change', () => {
    state.optimizers = getSelectedOptimizers();
  });

  document.getElementById('exp-run').addEventListener('click', runGridSearch);
  document.getElementById('exp-stop').addEventListener('click', stopSearch);
}

/**
 * Initializes the explorer component.
 * @param {string} rootId Container element ID.
 * @return {{pause: function(): void, resume: function(): void}} Explorer component.
 */
export function initExplorer(rootId) {
  const root = document.getElementById(rootId);
  if (!root) return {};

  buildControls(root);
  buildCharts(root);
  buildTable(root);
  bindControls();

  return {
    pause: () => {
      if (state.isRunning) stopSearch();
    },
    resume: () => {},
  };
}
