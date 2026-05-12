/**
 * Differential Evolution optimization.
 */

import {shuffle} from '../stats.js';
import {random} from '../prng.js';

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
 * @return {{x: Array<number>, f: number}} Best point and function value.
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
