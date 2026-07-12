/**
 * @fileoverview Differential evolution global optimizer.
 *
 * Differential evolution (Storn & Price, 1997) maintains a population of
 * candidate solutions and produces each new generation by taking a
 * *trial vector* from three randomly chosen other members
 *
 *     v_i = a + fScale * (b - c)
 *
 * and crossing it with the current member using a per-coordinate
 * Bernoulli crossover with probability `cr`. The trial replaces the
 * current member when it scores better. Method strengths:
 *
 * - Parallelizable: each candidate can be evaluated independently.
 * - Self-adapting: no gradient required.
 * - Robust on multimodal objectives.
 *
 * The implementation uses the canonical `rand / 1 / bin` strategy and
 * clamps trials to `[lb, ub]`.
 */

import {shuffle} from '../stats.js';
import {random} from '../prng.js';

/**
 * Differential-evolution minimization over an arbitrary-dimensional
 * space.
 *
 * The initial population is drawn uniformly inside `[lb, ub]`. Each
 * member produces one trial per generation; the trial survives to the
 * next generation only when its objective is strictly better.
 *
 * @param {function(Array<number>): number} f Objective function.
 * @param {Array<number>} x0 Initial guess; used only to size the search
 *   space and the lower-bound default (`x0[i]` is ignored otherwise).
 * @param {Object} opts Algorithm options.
 * @param {number=} opts.maxIter Maximum generations (default `500`).
 * @param {number=} opts.popSize Population size (default `max(20, 10 *
 *   dim)`).
 * @param {number=} opts.cr Crossover probability (default `0.7`).
 * @param {number=} opts.f Differential scale factor `F` (default `0.8`).
 * @param {Array<number>=} opts.lb Per-dimension lower bounds (default
 *   `-5` for every dimension).
 * @param {Array<number>=} opts.ub Per-dimension upper bounds (default
 *   `5` for every dimension).
 * @return {{x: Array<number>, f: number}} Best point found and its
 *   objective value.
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
      // Build the *complement* index list (everyone except `i`) and
      // shuffle it so we can pick three distinct bases for the mutation.
      const indices = [];
      for (let k = 0; k < popSize; k++) {
        if (k !== i) indices.push(k);
      }
      const shuffled = shuffle(indices);
      const a = population[shuffled[0]];
      const b = population[shuffled[1]];
      const c = population[shuffled[2]];

      const trial = [...population[i]];
      // jRand guarantees at least one coordinate comes from the mutant.
      const jRand = Math.floor(random() * dim);

      for (let j = 0; j < dim; j++) {
        if (j === jRand || random() < cr) {
          trial[j] = a[j] + fScale * (b[j] - c[j]);
          // Clamp into the feasible box; the bounds `[lb, ub]` are the
          // simplest hard-constraint strategy and match the paper's tests.
          if (trial[j] < lb[j]) trial[j] = lb[j];
          if (trial[j] > ub[j]) trial[j] = ub[j];
        }
      }

      const trialValue = f(trial);
      const currentValue = fVals[i];

      // Greedy one-to-one selection: the trial replaces the parent only
      // when it scores strictly better on the objective.
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
