/**
 * Multi-dimensional optimization suites for RK-SAVR.
 * Google JS Style Guide compliant.
 */

import {shuffle} from './stats.js';
import {random} from './prng.js';

/**
 * Minimizes a function f(x) on the interval [ax, cx] using Brent's Method.
 * @param {function(number): number} f The function to minimize.
 * @param {number} ax Lower bound.
 * @param {number} bx An initial guess.
 * @param {number} cx Upper bound.
 * @param {number} tol Tolerance.
 * @return {{x: number, f: number}} Object containing minimum x and f(x).
 */
export function brentMinimize(f, ax, bx, cx, tol = 1e-6) {
  if (!Number.isFinite(ax) || !Number.isFinite(bx) || !Number.isFinite(cx)) {
    throw new Error('Bounds must be finite numbers');
  }
  let a = Math.min(ax, cx);
  let b = Math.max(ax, cx);
  if (a >= b) {
    throw new Error('Lower bound must be strictly less than upper bound');
  }
  if (bx < a || bx > b) {
    throw new Error('Initial guess must lie within bounds');
  }

  const GOLDEN = 0.3819660;
  const EPS = 1e-10;

  let x = bx || (a + b) / 2;
  let w = x;
  let v = x;

  let fx = f(x);
  let fw = fx;
  let fv = fx;

  let d = 0;
  let e = 0;

  for (let iter = 0; iter < 100; iter++) {
    const xm = 0.5 * (a + b);
    const tol1 = tol * Math.abs(x) + EPS;
    const tol2 = 2.0 * tol1;

    if (Math.abs(x - xm) <= (tol2 - 0.5 * (b - a))) {
      return {x, f: fx};
    }

    if (Math.abs(e) > tol1) {
      let r = (x - w) * (fx - fv);
      let q = (x - v) * (fx - fw);
      let p = (x - v) * q - (x - w) * r;
      q = 2.0 * (q - r);
      if (q > 0.0) p = -p;
      q = Math.abs(q);
      const etemp = e;
      e = d;

      if (Math.abs(p) >= Math.abs(0.5 * q * etemp) ||
          p <= q * (a - x) ||
          p >= q * (b - x)) {
        e = (x >= xm ? a - x : b - x);
        d = GOLDEN * e;
      } else {
        d = p / q;
        const u = x + d;
        if (u - a < tol2 || b - u < tol2) {
          d = (xm - x >= 0 ? tol1 : -tol1);
        }
      }
    } else {
      e = (x >= xm ? a - x : b - x);
      d = GOLDEN * e;
    }

    const u = (Math.abs(d) >= tol1 ? x + d : x + (d >= 0 ? tol1 : -tol1));
    const fu = f(u);

    if (fu <= fx) {
      if (u >= x) a = x;
      else b = x;
      v = w;
      fv = fw;
      w = x;
      fw = fx;
      x = u;
      fx = fu;
    } else {
      if (u < x) a = u;
      else b = u;
      if (fu <= fw || w === x) {
        v = w;
        fv = fw;
        w = u;
        fw = fu;
      } else if (fu <= fv || v === x || v === w) {
        v = u;
        fv = fu;
      }
    }
  }

  return {x, f: fx};
}

/**
 * Nelder-Mead (Simplex) method for multi-dimensional minimization.
 * @param {function(Array<number>): number} f Objective function.
 * @param {Array<number>} x0 Initial guess.
 * @param {Object} opts Options.
 * @param {number} opts.maxIter Maximum iterations (default 1000).
 * @param {number} opts.tol Convergence tolerance (default 1e-6).
 * @param {number} opts.alpha Reflection coefficient (default 1.0).
 * @param {number} opts.gamma Expansion coefficient (default 2.0).
 * @param {number} opts.rho Contraction coefficient (default 0.5).
 * @param {number} opts.sigma Shrink coefficient (default 0.5).
 * @return {{x: Array<number>, f: number, iter: number}}
 */
export function nelderMead(f, x0, opts = {}) {
  const maxIter = opts.maxIter || 1000;
  const tol = opts.tol || 1e-6;
  const alpha = opts.alpha || 1.0;
  const gamma = opts.gamma || 2.0;
  const rho = opts.rho || 0.5;
  const sigma = opts.sigma || 0.5;

  const n = x0.length;
  const simplex = [];

  // Create initial simplex: x0 + (x0 + eps) for each dimension
  for (let i = 0; i <= n; i++) {
    if (i === 0) {
      simplex.push([...x0]);
    } else {
      const point = [...x0];
      point[i - 1] = x0[i - 1] + 1e-4;
      simplex.push(point);
    }
  }

  const fVals = simplex.map((pt) => f(pt));

  let bestPt = simplex[0];
  let bestFVal = fVals[0];

  for (let iter = 0; iter < maxIter; iter++) {
    // Sort by function value
    const sorted = simplex.map((pt, idx) => ({pt, fVal: fVals[idx]}))
        .sort((a, b) => a.fVal - b.fVal);

    const sortedPts = sorted.map((s) => s.pt);
    const sortedF = sorted.map((s) => s.fVal);

    bestPt = sortedPts[0];
    bestFVal = sortedF[0];

    const xo = sortedPts[n];        // worst
    const fn = sortedF[n];
    const secondWorst = sortedF[n - 1];

    const centroid = [];
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        sum += sortedPts[j][i];
      }
      centroid.push(sum / n);
    }

    // Reflection
    const xr = centroid.map((c, i) => c + alpha * (c - xo[i]));
    const fr = f(xr);

    if (fr < sortedF[0]) {
      // Expansion
      const xe = centroid.map((c, i) => c + gamma * (xr[i] - c));
      const fe = f(xe);
      if (fe < fr) {
        simplex[n] = xe;
        fVals[n] = fe;
      } else {
        simplex[n] = xr;
        fVals[n] = fr;
      }
    } else if (fr < secondWorst) {
      simplex[n] = xr;
      fVals[n] = fr;
    } else {
      // Contraction
      const xc = centroid.map((c, i) => xo[i] + rho * (c - xo[i]));
      const fc = f(xc);
      if (fc < fn) {
        simplex[n] = xc;
        fVals[n] = fc;
      } else {
        // Shrink
        const best = sortedPts[0];
        for (let i = 0; i <= n; i++) {
          simplex[i] = simplex[i].map((val, j) => best[j] + sigma * (val - best[j]));
          fVals[i] = f(simplex[i]);
        }
      }
    }

    // Check convergence
    let maxDiff = 0;
    for (let i = 1; i <= n; i++) {
      const diff = Math.abs(fVals[i] - fVals[0]);
      if (diff > maxDiff) maxDiff = diff;
    }
    if (maxDiff < tol) {
      return {x: bestPt, f: bestFVal, iter};
    }
  }

  return {x: bestPt, f: bestFVal, iter: maxIter};
}

/**
 * Simulated Annealing for global optimization.
 * @param {function(Array<number>): number} f Objective function.
 * @param {Array<number>} x0 Initial guess.
 * @param {Object} opts Options.
 * @param {number} opts.maxIter Maximum iterations (default 5000).
 * @param {number} opts.initialTemp Initial temperature (default 100).
 * @param {number} opts.finalTemp Final temperature (default 0.001).
 * @param {number} opts.coolingRate Cooling rate (default 0.995).
 * @param {number} opts.stepSize Step size for neighbors (default 0.1).
 * @return {{x: Array<number>, f: number}}
 */
export function simulatedAnnealing(f, x0, opts = {}) {
  const maxIter = opts.maxIter || 5000;
  const initialTemp = opts.initialTemp || 100;
  const finalTemp = opts.finalTemp || 0.001;
  const coolingRate = opts.coolingRate || 0.995;
  const stepSize = opts.stepSize || 0.1;

  let current = [...x0];
  let currentValue = f(current);
  let best = [...current];
  let bestValue = currentValue;

  let temp = initialTemp;

  for (let iter = 0; iter < maxIter && temp > finalTemp; iter++) {
    const neighbor = current.map((val) => {
      const delta = (random() - 0.5) * 2 * stepSize;
      return val + delta;
    });
    const neighborValue = f(neighbor);
    const delta = neighborValue - currentValue;

    const acceptanceProb = Math.exp(Math.min(700, -delta / temp));
    if (delta < 0 || random() < acceptanceProb) {
      current = neighbor;
      currentValue = neighborValue;
      if (currentValue < bestValue) {
        best = [...current];
        bestValue = currentValue;
      }
    }
    temp *= coolingRate;
  }

  return {x: best, f: bestValue};
}

/**
 * Differential Evolution for global optimization.
 * @param {function(Array<number>): number} f Objective function.
 * @param {Array<number>} x0 Initial guess (center of population).
 * @param {Object} opts Options.
 * @param {number} opts.maxIter Maximum iterations (default 500).
 * @param {number} opts.popSize Population size (default 20).
 * @param {number} opts.cr Crossover probability (default 0.7).
 * @param {number} opts.f Scale factor F (default 0.8).
 * @param {Array<number>} opts.lb Lower bounds (default all -5).
 * @param {Array<number>} opts.ub Upper bounds (default all 5).
 * @return {{x: Array<number>, f: number}}
 */
export function differentialEvolution(f, x0, opts = {}) {
  const maxIter = opts.maxIter || 500;
  const popSize = opts.popSize || Math.max(20, 10 * x0.length);
  const cr = opts.cr || 0.7;
  const fScale = opts.f || 0.8;
  const lb = opts.lb || x0.map(() => -5);
  const ub = opts.ub || x0.map(() => 5);

  const dim = x0.length;
  const population = [];
  for (let i = 0; i < popSize; i++) {
    population.push(x0.map((val, j) => lb[j] + random() * (ub[j] - lb[j])));
  }

  const fVals = new Float64Array(popSize);
  for (let i = 0; i < popSize; i++) {
    fVals[i] = f(population[i]);
  }
  let bestIdx = 0;
  let bestValue = fVals[0];
  for (let i = 1; i < popSize; i++) {
    if (fVals[i] < bestValue) {
      bestValue = fVals[i];
      bestIdx = i;
    }
  }

  for (let iter = 0; iter < maxIter; iter++) {
    for (let i = 0; i < popSize; i++) {
      // Select 3 distinct indices != i
      const indices = [];
      for (let k = 0; k < popSize; k++) {
        if (k !== i) indices.push(k);
      }
      const shuffled = shuffle(indices);
      const a = population[shuffled[0]];
      const b = population[shuffled[1]];
      const c = population[shuffled[2]];

      const trial = [...population[i]];
      const jRand = Math.floor(random() * dim);

      for (let j = 0; j < dim; j++) {
        if (j === jRand || random() < cr) {
          trial[j] = a[j] + fScale * (b[j] - c[j]);
          if (trial[j] < lb[j]) trial[j] = lb[j];
          if (trial[j] > ub[j]) trial[j] = ub[j];
        }
      }

      const trialValue = f(trial);
      const currentValue = fVals[i];

      if (trialValue < currentValue) {
        population[i] = trial;
        fVals[i] = trialValue;
        if (trialValue < bestValue) {
          bestValue = trialValue;
          bestIdx = i;
        }
      }
    }
  }

  return {x: population[bestIdx], f: bestValue};
}

/**
 * Adaptive Grid Search with Brent refinement.
 * @param {function(number): number} f Objective function (1D).
 * @param {number} min Lower bound.
 * @param {number} max Upper bound.
 * @param {Object} opts Options.
 * @param {number} opts.gridSize Coarse grid points (default 50).
 * @param {number} opts.refineIters Refinement iterations (default 3).
 * @param {number} opts.tol Convergence tolerance (default 1e-7).
 * @return {{x: number, f: number}}
 */
export function adaptiveGridSearch(f, min, max, opts = {}) {
  const gridSize = opts.gridSize || 50;
  if (gridSize <= 1) {
    throw new Error('gridSize must be > 1');
  }
  const refineIters = opts.refineIters || 3;
  const tol = opts.tol || 1e-7;

  let a = min;
  let b = max;
  let bestX = (a + b) / 2;
  let bestF = f(bestX);

  for (let refine = 0; refine < refineIters; refine++) {
    const step = (b - a) / (gridSize - 1);

    for (let i = 0; i < gridSize; i++) {
      const x = a + i * step;
      const fx = f(x);
      if (fx < bestF) {
        bestF = fx;
        bestX = x;
      }
    }

    const newA = Math.max(a, bestX - step * 2);
    const newB = Math.min(b, bestX + step * 2);
    a = newA;
    b = newB;

    if (b - a < tol) break;
  }

  return brentMinimize(f, a, bestX, b, tol);
}

/**
 * Optimizer registry mapping name to factory function.
 * Factory receives no arguments and returns an optimizer function.
 * @private @const
 */
/**
 * Wraps an optimizer so that failures return NaN instead of throwing.
 * @param {function} opt Optimizer function.
 * @return {function} Safe optimizer.
 */
function safeOptimizer(opt) {
  return function(...args) {
    try {
      return opt(...args);
    } catch (err) {
      return NaN;
    }
  };
}

const OPTIMIZER_REGISTRY = {
  'brent': () => safeOptimizer((fn, min, guess) =>
    brentMinimize(fn, min, guess[0] || 0.5, 1.0, 1e-5).x),
  'nelder-mead': () => safeOptimizer((fn) =>
    nelderMead((x) => fn(x[0]), [0.5], {maxIter: 500}).x[0]),
  'annealing': () => safeOptimizer((fn) =>
    simulatedAnnealing(
        (x) => fn(x[0]), [0.5], {maxIter: 2000, coolingRate: 0.99, stepSize: 0.1}).x[0]),
  'de': () => safeOptimizer((fn) =>
    differentialEvolution(
        (x) => fn(x[0]), [0.5], {maxIter: 300, popSize: 30}).x[0]),
  'ags': () => safeOptimizer((fn, min, guess) =>
    adaptiveGridSearch(fn, min, 1.0).x),
};

/**
 * Retrieves an optimizer factory by name.
 * @param {string} name Optimizer identifier.
 * @return {function|undefined} Factory or undefined.
 */
export function getOptimizerFactory(name) {
  return OPTIMIZER_REGISTRY[name];
}

/**
 * Registers a custom optimizer factory.
 * @param {string} name Optimizer identifier.
 * @param {function(): function} factory Returns the optimizer function.
 */
export function registerOptimizerFactory(name, factory) {
  OPTIMIZER_REGISTRY[name] = factory;
}