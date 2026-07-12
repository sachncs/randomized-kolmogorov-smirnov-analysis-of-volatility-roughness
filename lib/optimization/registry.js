/**
 * @fileoverview Optimizer registry and "safe" wrapper for RK-SAVR.
 *
 * Each algorithm in `optimization/` is tailored for general use. Here we
 * adapt them to the **uniform signature** the RK-SAVR estimator expects:
 *
 *     optimizer(f, hMin, hMax, [h0]) -> number
 *
 * - Algorithms that natively accept a scalar argument (Brent, AGS) are
 *   used directly.
 * - Algorithms that want a vector (Nelder-Mead, SA, DE) are wrapped to
 *   lift the scalar objective to a 1-D vector objective.
 *
 * Every factory wraps its optimizer with {@link safeOptimizer}, which
 * converts thrown errors (overflow, non-convergence, ...) into a `NaN`
 * return value. The upper-level `RKSAVR.estimate` then either skips or
 * averages those iterations gracefully.
 */

import {brentMinimize} from './brent.js';
import {nelderMead} from './nelderMead.js';
import {simulatedAnnealing} from './simulatedAnnealing.js';
import {differentialEvolution} from './differentialEvolution.js';
import {adaptiveGridSearch} from './adaptiveGridSearch.js';

/**
 * Wraps an optimizer so that any thrown error becomes `NaN` instead of
 * propagating. The intent is to keep `RKSAVR.estimate` resilient: a bad
 * iteration should be logged and skipped, not abort the whole batch.
 *
 * @param {function} opt Optimizer function with the standard RK-SAVR
 *   signature `(f, hMin, hMax, [h0]) -> number`.
 * @return {function} Wrapped optimizer that returns `NaN` on failure.
 */
export function safeOptimizer(opt) {
  return function (...args) {
    try {
      return opt(...args);
    } catch (_err) {
      return NaN;
    }
  };
}

/**
 * Mapping from short identifiers (`'brent'`, `'de'`, etc.) to
 * factories that return a configured optimizer function.
 *
 * Each entry wraps its optimizer with `safeOptimizer` so that user
 * code never has to catch convergence errors. The factors chosen here
 * are conservative defaults; tune via custom factories for
 * application-specific performance.
 *
 * @private
 * @const
 */
const OPTIMIZER_REGISTRY = {
  brent: () =>
    safeOptimizer(
      (fn, min, max, guess) =>
        brentMinimize(fn, min, guess[0] || 0.5, max, 1e-5).x,
    ),
  'nelder-mead': () =>
    safeOptimizer(
      (fn) => nelderMead((x) => fn(x[0]), [0.5], {maxIter: 500}).x[0],
    ),
  annealing: () =>
    safeOptimizer(
      (fn) =>
        simulatedAnnealing((x) => fn(x[0]), [0.5], {
          maxIter: 2000,
          coolingRate: 0.99,
          stepSize: 0.1,
        }).x[0],
    ),
  de: () =>
    safeOptimizer(
      (fn) =>
        differentialEvolution((x) => fn(x[0]), [0.5], {
          maxIter: 300,
          popSize: 30,
        }).x[0],
    ),
  ags: () =>
    safeOptimizer((fn, min, max) => adaptiveGridSearch(fn, min, max).x),
};

/**
 * Retrieves an optimizer factory by name.
 *
 * @param {string} name Optimizer identifier.
 * @return {function|undefined} The factory, or `undefined` if the name is
 *   unknown (in which case `RKSAVR` falls back to `'brent'`).
 */
export function getOptimizerFactory(name) {
  return OPTIMIZER_REGISTRY[name];
}

/**
 * Registers (or overrides) a custom optimizer factory.
 *
 * Use this to plug a proprietary or experimental optimizer into the
 * registry without modifying the library source. The factory must
 * return a function with the standard RK-SAVR signature
 * `(f, hMin, hMax, [h0]) => number`.
 *
 * @param {string} name Optimizer identifier (used in
 *   `RKSAVR({optimizerType: name})`).
 * @param {function(): function} factory Factory returning the optimizer
 *   function.
 */
export function registerOptimizerFactory(name, factory) {
  OPTIMIZER_REGISTRY[name] = factory;
}
