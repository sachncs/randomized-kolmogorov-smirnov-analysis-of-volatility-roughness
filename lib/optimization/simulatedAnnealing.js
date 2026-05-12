/**
 * Simulated Annealing optimization.
 */

import {random} from '../prng.js';

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
 * @return {{x: Array<number>, f: number}} Best point and function value.
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
