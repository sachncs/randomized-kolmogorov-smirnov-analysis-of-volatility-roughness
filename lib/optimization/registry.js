/**
 * Optimizer registry for mapping names to factory functions.
 */

import {brentMinimize} from './brent.js';
import {nelderMead} from './nelderMead.js';
import {simulatedAnnealing} from './simulatedAnnealing.js';
import {differentialEvolution} from './differentialEvolution.js';
import {adaptiveGridSearch} from './adaptiveGridSearch.js';

/**
 * Wraps an optimizer so that failures return NaN instead of throwing.
 * @param {function} opt Optimizer function.
 * @return {function} Safe optimizer.
 */
export function safeOptimizer(opt) {
  return function (...args) {
    try {
      return opt(...args);
    } catch (err) {
      return NaN;
    }
  };
}

/**
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
