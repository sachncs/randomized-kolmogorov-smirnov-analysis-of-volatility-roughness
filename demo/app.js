/**
 * RK-SAVR Observatory — SPA Entry Point.
 * Orchestrates view switching, shared worker, and component lifecycle.
 */

import {initDashboard} from './dashboard.js';
import {initExplorer} from './explorer.js';
import {initFigures} from './figures.js';

// --------------------------------------------------------------------------
// Shared Worker
// --------------------------------------------------------------------------

let worker = null;
let jobId = 0;
const pendingJobs = new Map();
const WORKER_TIMEOUT_MS = 60000;

/**
 * Returns the shared worker instance, lazily created.
 * @return {Worker} The worker instance.
 */
function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./worker.js', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = handleWorkerMessage;
    worker.onerror = handleWorkerError;
  }
  return worker;
}

/**
 * Handles incoming messages from the worker.
 * @param {MessageEvent} e
 * @return {void}
 */
function handleWorkerMessage(e) {
  const {type, id, progress, result, message} = e.data;
  const job = pendingJobs.get(id);
  if (!job) return;

  if (type === 'progress') {
    job.onProgress?.(progress);
  } else if (type === 'complete') {
    clearTimeout(job.timer);
    pendingJobs.delete(id);
    job.resolve(result);
  } else if (type === 'error') {
    clearTimeout(job.timer);
    pendingJobs.delete(id);
    job.reject(new Error(message || 'Worker error'));
  }
}

/**
 * Handles worker-level errors.
 * @param {ErrorEvent} err
 * @return {void}
 */
function handleWorkerError(err) {
  console.error('Worker error:', err);
  for (const [id, job] of pendingJobs) {
    clearTimeout(job.timer);
    job.reject(new Error('Worker crashed'));
    pendingJobs.delete(id);
  }
  worker = null;
}

/**
 * Dispatches a command to the worker and returns a promise.
 * @param {string} cmd Command name.
 * @param {Object} payload Command payload.
 * @param {function(number): void=} onProgress Progress callback.
 * @return {Promise<Object>} Worker result.
 */
export function dispatchWorker(cmd, payload, onProgress) {
  return new Promise((resolve, reject) => {
    const id = ++jobId;
    const w = getWorker();
    const timer = setTimeout(() => {
      pendingJobs.delete(id);
      reject(new Error('Worker timeout'));
    }, WORKER_TIMEOUT_MS);
    pendingJobs.set(id, {resolve, reject, onProgress, timer});
    w.postMessage({id, cmd, payload});
  });
}

/**
 * Aborts all pending worker jobs and terminates the worker.
 */
export function killWorker() {
  for (const [id, job] of pendingJobs) {
    clearTimeout(job.timer);
    job.reject(new Error('Aborted'));
    pendingJobs.delete(id);
  }
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

// --------------------------------------------------------------------------
// View Router
// --------------------------------------------------------------------------

const views = new Map();
let activeView = 'dashboard';

/**
 * Registers a view component.
 * @param {string} name View identifier.
 * @param {Object} component Component with init/destroy methods.
 */
function registerView(name, component) {
  views.set(name, component);
}

/**
 * Switches to the named view.
 * @param {string} name View identifier.
 */
function switchView(name) {
  if (name === activeView) return;

  const old = views.get(activeView);
  if (old?.pause) old.pause();

  document.querySelectorAll('.view').forEach((el) => {
    el.classList.remove('is-active');
    el.hidden = true;
  });
  document.querySelectorAll('.nav-link').forEach((el) => {
    el.classList.remove('is-active');
    el.setAttribute('aria-selected', 'false');
  });

  const viewEl = document.getElementById(`view-${name}`);
  const navEl = document.querySelector(`.nav-link[data-view="${name}"]`);
  if (viewEl) {
    viewEl.hidden = false;
    viewEl.classList.add('is-active');
  }
  if (navEl) {
    navEl.classList.add('is-active');
    navEl.setAttribute('aria-selected', 'true');
  }

  activeView = name;
  const next = views.get(name);
  if (next?.resume) next.resume();
}

// --------------------------------------------------------------------------
// Plotly Theme
// --------------------------------------------------------------------------

const PLOTLY_THEME = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  font: {color: '#c8d0e0', family: "'Geist Mono', monospace"},
  margin: {t: 10, b: 40, l: 50, r: 10},
  xaxis: {
    gridcolor: 'rgba(58,74,96,0.3)',
    zeroline: false,
    tickfont: {size: 11},
  },
  yaxis: {
    gridcolor: 'rgba(58,74,96,0.3)',
    zeroline: false,
    tickfont: {size: 11},
  },
};

/**
 * Applies the Observatory theme to a Plotly layout object.
 * @param {Object} layout Base layout.
 * @return {Object} Themed Plotly layout object.
 */
export function themedLayout(layout = {}) {
  return {
    ...PLOTLY_THEME,
    ...layout,
    xaxis: {...PLOTLY_THEME.xaxis, ...layout.xaxis},
    yaxis: {...PLOTLY_THEME.yaxis, ...layout.yaxis},
  };
}

export const plotlyConfig = {responsive: true, displayModeBar: false};

// --------------------------------------------------------------------------
// Utilities
// --------------------------------------------------------------------------

/**
 * Debounces a function.
 * @param {function(...*): void} fn
 * @param {number} ms
 * @return {function(...*): void} Debounced function.
 */
export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Formats a number to fixed decimals, handling null/NaN.
 * @param {number|null} v
 * @param {number} d
 * @return {string} Formatted value.
 */
export function fmt(v, d = 3) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toFixed(d);
}

// --------------------------------------------------------------------------
// Initialization
// --------------------------------------------------------------------------

/**
 * Initializes sidebar navigation router.
 * @return {void}
 */
function initRouter() {
  document.querySelectorAll('.nav-link').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view) switchView(view);
    });
  });
}

window.addEventListener('load', () => {
  initRouter();

  registerView('dashboard', initDashboard('dashboard-root'));
  registerView('explorer', initExplorer('explorer-root'));
  registerView('figures', initFigures('figures-root'));

  switchView('dashboard');
});
