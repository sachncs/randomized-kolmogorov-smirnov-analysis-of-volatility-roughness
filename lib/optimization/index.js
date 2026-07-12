/**
 * @fileoverview Re-exports for the optimization layer.
 *
 * Provides a single import surface for every optimizer shipped with the
 * library plus the registry helpers used internally by `RKSAVR`.
 */

export {brentMinimize} from './brent.js';
export {nelderMead} from './nelderMead.js';
export {simulatedAnnealing} from './simulatedAnnealing.js';
export {differentialEvolution} from './differentialEvolution.js';
export {adaptiveGridSearch} from './adaptiveGridSearch.js';
export {safeOptimizer} from './registry.js';
export {getOptimizerFactory, registerOptimizerFactory} from './registry.js';
