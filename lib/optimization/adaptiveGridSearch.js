/**
 * Adaptive Grid Search optimization with Brent refinement.
 */

import {brentMinimize} from './brent.js';

/**
 * Adaptive Grid Search with Brent refinement.
 * @param {function(number): number} f Objective function (1D).
 * @param {number} min Lower bound.
 * @param {number} max Upper bound.
 * @param {Object} opts Options.
 * @param {number} opts.gridSize Coarse grid points (default 50).
 * @param {number} opts.refineIters Refinement iterations (default 3).
 * @param {number} opts.tol Convergence tolerance (default 1e-7).
 * @return {{x: number, f: number}} Best point and function value.
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
