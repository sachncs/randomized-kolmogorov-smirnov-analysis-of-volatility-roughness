/**
 * RK-SAVR Observatory — Paper Figure Renderer.
 * Replicated figures from Angelini & Bianchi with configurable parameters.
 */

import Plotly from 'plotly.js-dist-min';
import {themedLayout, plotlyConfig, fmt} from './app.js';
import {RKSAVR, generateFBM, setSeed, resetSeed} from '../lib/index.js';

const FIGURES = [
  {
    id: 'fig-ks-curve',
    title: 'Figure 1 — KS Distance vs H',
    desc: 'The KS objective D(H) as a function of candidate H. The minimum identifies the estimate.',
  },
  {
    id: 'fig-multi-scale',
    title: 'Figure 2 — Multi-Scale Profile',
    desc: 'Pairwise KS distances across scales for a single window, showing scale invariance.',
  },
  {
    id: 'fig-rolling',
    title: 'Figure 3 — Rolling Estimation',
    desc: 'Sliding-window H estimates on a rough volatility path with true H reference.',
  },
  {
    id: 'fig-bias-variance',
    title: 'Figure 4 — Bias–Variance Tradeoff',
    desc: 'RMSE and bias as a function of window size for several true H values.',
  },
];

const state = {
  activeFigure: FIGURES[0].id,
};

// --------------------------------------------------------------------------
// DOM Builders
// --------------------------------------------------------------------------

/**
 * Builds the figure selector panel.
 * @param {HTMLElement} container
 * @return {void}
 */
function buildSelector(container) {
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="panel-header"><span class="panel-title">Select Figure</span></div>
    <div class="form-group">
      <select class="form-control" id="fig-select">
        ${FIGURES.map((f) => `<option value="${f.id}">${f.title}</option>`).join('')}
      </select>
    </div>
    <p class="page-desc" id="fig-desc" style="margin-top:0.5rem">${FIGURES[0].desc}</p>
  `;
  container.appendChild(panel);
}

/**
 * Builds figure-specific controls.
 * @param {HTMLElement} container
 * @return {void}
 */
function buildControls(container) {
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.id = 'fig-controls';
  panel.innerHTML = renderControlsFor(FIGURES[0].id);
  container.appendChild(panel);

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '0.75rem';
  actions.style.marginTop = '1rem';
  actions.innerHTML = `
    <button class="btn btn-primary" id="fig-render">Render Figure</button>
    <button class="btn btn-secondary" id="fig-export">Export SVG</button>
  `;
  container.appendChild(actions);
}

/**
 * Builds the chart container.
 * @param {HTMLElement} container
 * @return {void}
 */
function buildChart(container) {
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.style.marginTop = '1.5rem';
  panel.innerHTML = `
    <div class="panel-header"><span class="panel-title" id="fig-chart-title">${FIGURES[0].title}</span></div>
    <div id="fig-chart" class="chart-box" style="min-height:420px"></div>
  `;
  container.appendChild(panel);
}

/**
 * Renders control HTML for the given figure.
 * @param {string} figId Figure identifier.
 * @return {string} Control HTML.
 */
function renderControlsFor(figId) {
  const common = `
    <div class="row" style="margin-bottom:0">
      <div class="form-group">
        <label class="form-label">True H</label>
        <input type="number" class="form-control" id="fig-h" value="0.1" min="0.01" max="0.99" step="0.01">
      </div>
      <div class="form-group">
        <label class="form-label">Path Length</label>
        <input type="number" class="form-control" id="fig-n" value="2000" min="500" max="10000" step="100">
      </div>
      <div class="form-group">
        <label class="form-label">Window Size</label>
        <input type="number" class="form-control" id="fig-win" value="500" min="100" max="5000" step="50">
      </div>
    </div>
  `;

  switch (figId) {
    case 'fig-ks-curve':
      return (
        common +
        `
        <div class="row" style="margin-bottom:0">
          <div class="form-group">
            <label class="form-label">H Resolution</label>
            <input type="number" class="form-control" id="fig-res" value="0.005" min="0.001" max="0.05" step="0.001">
          </div>
          <div class="form-group">
            <label class="form-label">Scale A₁</label>
            <input type="number" class="form-control" id="fig-a1" value="1" min="1" max="10">
          </div>
          <div class="form-group">
            <label class="form-label">Scale A₂</label>
            <input type="number" class="form-control" id="fig-a2" value="25" min="2" max="100">
          </div>
        </div>
      `
      );
    case 'fig-multi-scale':
      return (
        common +
        `
        <div class="row" style="margin-bottom:0">
          <div class="form-group">
            <label class="form-label">Scales (comma)</label>
            <input type="text" class="form-control" id="fig-scales" value="1, 2, 5, 10, 20, 50">
          </div>
        </div>
      `
      );
    case 'fig-rolling':
      return (
        common +
        `
        <div class="row" style="margin-bottom:0">
          <div class="form-group">
            <label class="form-label">Step Size</label>
            <input type="number" class="form-control" id="fig-step" value="25" min="1" max="500">
          </div>
          <div class="form-group">
            <label class="form-label">Iterations</label>
            <input type="number" class="form-control" id="fig-iter" value="8" min="1" max="64">
          </div>
        </div>
      `
      );
    case 'fig-bias-variance':
      return `
        <div class="row" style="margin-bottom:0">
          <div class="form-group">
            <label class="form-label">H Values (comma)</label>
            <input type="text" class="form-control" id="fig-hs" value="0.05, 0.1, 0.2, 0.3">
          </div>
          <div class="form-group">
            <label class="form-label">Window Sizes (comma)</label>
            <input type="text" class="form-control" id="fig-wins" value="200, 400, 600, 800, 1000">
          </div>
          <div class="form-group">
            <label class="form-label">Trials per Config</label>
            <input type="number" class="form-control" id="fig-trials" value="10" min="1" max="50">
          </div>
          <div class="form-group">
            <label class="form-label">Path Length</label>
            <input type="number" class="form-control" id="fig-n" value="2000" min="500" max="10000" step="100">
          </div>
        </div>
      `;
    default:
      return common;
  }
}

// --------------------------------------------------------------------------
// Figure Renderers
// --------------------------------------------------------------------------

/**
 * Reads common figure parameters from DOM.
 * @return {{trueH: number, n: number, windowSize: number}} Common parameters.
 */
function getCommonParams() {
  return {
    trueH: parseFloat(document.getElementById('fig-h')?.value || 0.1),
    n: parseInt(document.getElementById('fig-n')?.value || 2000, 10),
    windowSize: parseInt(document.getElementById('fig-win')?.value || 500, 10),
  };
}

/**
 * Generates an fBM path with fixed seed.
 * @param {number} trueH
 * @param {number} n
 * @return {Array<number>} Generated path.
 */
function generatePath(trueH, n) {
  setSeed(42);
  const path = generateFBM(n, trueH);
  resetSeed();
  return path;
}

/**
 * Renders Figure 1 — KS Distance vs H curve.
 * @return {void}
 */
async function renderKSCurve() {
  const {trueH, n, windowSize} = getCommonParams();
  const res = parseFloat(document.getElementById('fig-res').value);
  const a1 = parseInt(document.getElementById('fig-a1').value, 10);
  const a2 = parseInt(document.getElementById('fig-a2').value, 10);

  const path = generatePath(trueH, n);
  const slice = path.slice(0, windowSize);

  const inc1 = RKSAVR.getIncrements(slice, a1);
  const inc2 = RKSAVR.getIncrements(slice, a2);
  const s1 = inc1.slice().sort((a, b) => a - b);
  const s2 = inc2.slice().sort((a, b) => a - b);

  const hs = [];
  const ds = [];
  for (let h = 0.01; h <= 0.99; h += res) {
    const f1 = Math.pow(a1, -h);
    const f2 = Math.pow(a2, -h);
    const d = computeKsRescaled(s1, s2, f1, f2);
    hs.push(h);
    ds.push(d);
  }

  const minIdx = ds.indexOf(Math.min(...ds));
  const minH = hs[minIdx];

  const trace = {
    x: hs,
    y: ds,
    type: 'scatter',
    mode: 'lines',
    line: {color: '#f0a030', width: 1.5},
    fill: 'tozeroy',
    fillcolor: 'rgba(240,160,48,0.05)',
  };

  const minLine = {
    x: [minH, minH],
    y: [0, Math.max(...ds)],
    mode: 'lines',
    line: {color: '#30d0f0', dash: 'dash', width: 1},
    name: `Ĥ = ${fmt(minH)}`,
  };

  Plotly.newPlot(
    'fig-chart',
    [trace, minLine],
    themedLayout({
      xaxis: {title: 'Candidate H'},
      yaxis: {title: 'D(H)'},
      annotations: [
        {
          x: minH,
          y: ds[minIdx],
          xref: 'x',
          yref: 'y',
          text: `Ĥ ≈ ${fmt(minH)}`,
          showarrow: true,
          arrowhead: 2,
          ax: 40,
          ay: -40,
          font: {color: '#30d0f0'},
        },
      ],
    }),
    plotlyConfig,
  );
}

/**
 * Renders Figure 2 — Multi-Scale heatmap.
 * @return {void}
 */
async function renderMultiScale() {
  const {trueH, n, windowSize} = getCommonParams();
  const scalesStr = document.getElementById('fig-scales').value;
  const scales = scalesStr
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((s) => !isNaN(s));

  const path = generatePath(trueH, n);
  const slice = path.slice(0, windowSize);

  const rksavr = new RKSAVR({scales, sampleSize: Math.min(300, windowSize)});
  const raw = rksavr._estimateSingleRaw(slice, {scales});
  const profile = raw.sortedSamples.map((_, i) =>
    raw.sortedSamples.map((_, j) => {
      if (j <= i) return null;
      const fi = Math.pow(raw.scaleValues[i], -raw.H);
      const fj = Math.pow(raw.scaleValues[j], -raw.H);
      return computeKsRescaled(
        raw.sortedSamples[i],
        raw.sortedSamples[j],
        fi,
        fj,
      );
    }),
  );

  const z = [];
  const x = scales.map(String);
  const y = scales.map(String);
  for (let i = 0; i < scales.length; i++) {
    const row = [];
    for (let j = 0; j < scales.length; j++) {
      if (i === j) row.push(0);
      else if (j < i) row.push(profile[j][i]);
      else row.push(profile[i][j]);
    }
    z.push(row);
  }

  const trace = {
    z,
    x,
    y,
    type: 'heatmap',
    colorscale: [
      [0, '#0a0e17'],
      [0.25, '#1a2a4a'],
      [0.5, '#3a5a80'],
      [0.75, '#30d0f0'],
      [1, '#f0a030'],
    ],
    showscale: true,
    colorbar: {
      title: 'D',
      titleside: 'right',
      tickfont: {color: '#6a7a90'},
    },
  };

  Plotly.newPlot(
    'fig-chart',
    [trace],
    themedLayout({
      xaxis: {title: 'Scale', side: 'top'},
      yaxis: {title: 'Scale', autorange: 'reversed'},
      annotations: [
        {
          x: 0.5,
          y: -0.15,
          xref: 'paper',
          yref: 'paper',
          text: `Estimated Ĥ = ${fmt(raw.H)}`,
          showarrow: false,
          font: {color: '#c8d0e0'},
        },
      ],
    }),
    plotlyConfig,
  );
}

/**
 * Renders Figure 3 — Rolling estimation trajectory.
 * @return {void}
 */
async function renderRolling() {
  const {trueH, n, windowSize} = getCommonParams();
  const step = parseInt(document.getElementById('fig-step').value, 10);
  const iterations = parseInt(document.getElementById('fig-iter').value, 10);

  setSeed(42);
  const path = generateFBM(n, trueH);
  resetSeed();

  const rksavr = new RKSAVR({
    scaleA1: 1,
    scaleA2: 25,
    sampleSize: 500,
    iterations,
  });
  const results = rksavr.rolling(path, windowSize, step);

  const valid = results.filter((r) => Number.isFinite(r.H));
  const x = valid.map((r) => r.t);
  const y = valid.map((r) => r.H);

  const traceEst = {
    x,
    y,
    name: 'Estimated Ĥ',
    type: 'scatter',
    mode: 'lines',
    line: {color: '#f0a030', width: 1.5},
    fill: 'tozeroy',
    fillcolor: 'rgba(240,160,48,0.05)',
  };

  const traceTrue = {
    x: [0, n],
    y: [trueH, trueH],
    name: `True H = ${trueH}`,
    mode: 'lines',
    line: {color: '#30d0f0', dash: 'dash', width: 1},
  };

  Plotly.newPlot(
    'fig-chart',
    [traceEst, traceTrue],
    themedLayout({
      xaxis: {title: 'Time'},
      yaxis: {title: 'H', range: [0, 0.6]},
      legend: {orientation: 'h', y: -0.2},
    }),
    plotlyConfig,
  );
}

/**
 * Renders Figure 4 — Bias–Variance tradeoff.
 * @return {void}
 */
async function renderBiasVariance() {
  const hsStr = document.getElementById('fig-hs').value;
  const wsStr = document.getElementById('fig-wins').value;
  const nTrials = parseInt(document.getElementById('fig-trials').value, 10);
  const n = parseInt(document.getElementById('fig-n').value, 10);

  const hs = hsStr
    .split(',')
    .map((s) => parseFloat(s.trim()))
    .filter((v) => !isNaN(v));
  const ws = wsStr
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((v) => !isNaN(v));

  const tracesRmse = [];
  const tracesBias = [];

  for (const trueH of hs) {
    const rmseVals = [];
    const biasVals = [];
    for (const w of ws) {
      const errors = [];
      for (let t = 0; t < nTrials; t++) {
        setSeed(t + 1);
        const path = generateFBM(n, trueH);
        resetSeed();
        const rksavr = new RKSAVR({sampleSize: Math.min(300, w)});
        try {
          const H = rksavr.estimateSingle(path.slice(0, w));
          errors.push(H - trueH);
        } catch (_err) {
          errors.push(NaN);
        }
      }
      const valid = errors.filter((e) => Number.isFinite(e));
      const rmse = valid.length
        ? Math.sqrt(valid.reduce((a, b) => a + b * b, 0) / valid.length)
        : NaN;
      const bias = valid.length
        ? valid.reduce((a, b) => a + b, 0) / valid.length
        : NaN;
      rmseVals.push(rmse);
      biasVals.push(Math.abs(bias));
    }

    const color = getColorForH(trueH, hs);
    tracesRmse.push({
      x: ws,
      y: rmseVals,
      name: `H=${trueH}`,
      type: 'scatter',
      mode: 'lines+markers',
      line: {color, width: 2},
      marker: {size: 6},
      yaxis: 'y',
    });
    tracesBias.push({
      x: ws,
      y: biasVals,
      name: `|Bias| H=${trueH}`,
      type: 'scatter',
      mode: 'lines+markers',
      line: {color, width: 2, dash: 'dash'},
      marker: {size: 6, symbol: 'diamond'},
      yaxis: 'y2',
    });
  }

  Plotly.newPlot(
    'fig-chart',
    [...tracesRmse, ...tracesBias],
    themedLayout({
      xaxis: {title: 'Window Size'},
      yaxis: {title: 'RMSE', type: 'log', side: 'left'},
      yaxis2: {title: '|Bias|', overlaying: 'y', side: 'right', type: 'log'},
      legend: {orientation: 'h', y: -0.25},
    }),
    plotlyConfig,
  );
}

/**
 * Returns a color for a given H value.
 * @param {number} h
 * @param {Array<number>} allHs
 * @return {string} Color hex code.
 */
function getColorForH(h, allHs) {
  const colors = ['#f0a030', '#30d0f0', '#e03060', '#8a9ab0', '#c8d0e0'];
  const idx = allHs.indexOf(h);
  return colors[idx % colors.length];
}

/**
 * Computes rescaled KS distance between two pre-sorted arrays.
 * @param {Array<number>} s1 Sorted sample 1.
 * @param {Array<number>} s2 Sorted sample 2.
 * @param {number} f1 Rescale factor 1.
 * @param {number} f2 Rescale factor 2.
 * @return {number} Rescaled KS distance.
 */
function computeKsRescaled(s1, s2, f1, f2) {
  let i = 0;
  let j = 0;
  let d = 0;
  let cdf1 = 0;
  let cdf2 = 0;
  const n1 = s1.length;
  const n2 = s2.length;

  while (i < n1 && j < n2) {
    const v1 = s1[i] * f1;
    const v2 = s2[j] * f2;
    if (v1 <= v2) {
      cdf1 += 1 / n1;
      i++;
    } else {
      cdf2 += 1 / n2;
      j++;
    }
    d = Math.max(d, Math.abs(cdf1 - cdf2));
  }
  return d;
}

// --------------------------------------------------------------------------
// Wiring
// --------------------------------------------------------------------------

/**
 * Renders the currently selected figure.
 * @return {void}
 */
function renderActiveFigure() {
  switch (state.activeFigure) {
    case 'fig-ks-curve':
      return renderKSCurve();
    case 'fig-multi-scale':
      return renderMultiScale();
    case 'fig-rolling':
      return renderRolling();
    case 'fig-bias-variance':
      return renderBiasVariance();
  }
}

/**
 * Binds DOM event listeners for the figures view.
 * @return {void}
 */
function bindControls() {
  document.getElementById('fig-select').addEventListener('change', (e) => {
    state.activeFigure = e.target.value;
    const fig = FIGURES.find((f) => f.id === state.activeFigure);
    document.getElementById('fig-desc').textContent = fig.desc;
    document.getElementById('fig-chart-title').textContent = fig.title;
    document.getElementById('fig-controls').innerHTML = renderControlsFor(
      state.activeFigure,
    );
  });

  document.getElementById('fig-render').addEventListener('click', () => {
    renderActiveFigure();
  });

  document.getElementById('fig-export').addEventListener('click', () => {
    Plotly.downloadImage('fig-chart', {
      format: 'svg',
      filename: state.activeFigure,
      width: 1200,
      height: 700,
    });
  });
}

/**
 * Initializes the figures component.
 * @param {string} rootId Container element ID.
 * @return {{pause: function(): void, resume: function(): void}} Figures component.
 */
export function initFigures(rootId) {
  const root = document.getElementById(rootId);
  if (!root) return {};

  buildSelector(root);
  buildControls(root);
  buildChart(root);
  bindControls();

  // Render first figure after brief delay
  setTimeout(renderKSCurve, 300);

  return {
    pause: () => {},
    resume: () => {},
  };
}
