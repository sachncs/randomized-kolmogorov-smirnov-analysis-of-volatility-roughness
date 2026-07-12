/**
 * @fileoverview Adaptive grid search with Brent refinement.
 *
 * A coarse-to-fine 1D optimizer: it lays down a uniform grid, finds the
 * current best point, tightens the search interval around it by a
 * factor of two, then refines the grid `refineIters` times. After the
 * grid stage the result is polished with {@link brentMinimize} so the
 * returned `x` is precise to the requested `tol`.
 */

import {brentMinimize} from './brent.js';

/**
 * Adaptive grid search with Brent refinement for 1D minimization.
 *
 * Algorithm:
 *
 * 1. Initialize with the midpoint of `[min, max]`.
 * 2. Repeat `refineIters` times:
 *    - Sample `gridSize` evenly spaced points across `[a, b]`.
 *    - Track the best point.
 *    - Shrink `[a, b]` to `[best - 2*step, best + 2*step]` clamped to the
 *      original interval.
 *    - Stop early if `[a, b]` shrinks below `tol`.
 * 3. Polish the local minimum with Brent's method using `bestX` as the
 *    initial guess.
 *
 * The Brent refinement makes the function value at the returned `x`
 * accurate to machine epsilon in nearly all cases.
 *
 * @param {function(number): number} f Objective function (1D).
 * @param {number} min Lower bound.
 * @param {number} max Upper bound.
 * @param {Object} opts Algorithm options.
 * @param {number=} opts.gridSize Number of coarse-grid points per
 *   refinement (default `50`).
 * @param {number=} opts.refineIters Number of refinement rounds
 *   (default `3`).
 * @param {number=} opts.tol Convergence tolerance (default `1e-7`).
 * @return {{x: number, f: number}} Best point and its objective value.
 * @throws {Error} When `gridSize <= 1`.
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

    // Shrink the bracket to ~4 grid cells around the current best.
    const newA = Math.max(a, bestX - step * 2);
    const newB = Math.min(b, bestX + step * 2);
    a = newA;
    b = newB;

    if (b - a < tol) break;
  }

  return brentMinimize(f, a, bestX, b, tol);
}
