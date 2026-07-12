/**
 * @fileoverview Nelder-Mead simplex optimizer.
 *
 * Nelder-Mead (1965) maintains a simplex of `n + 1` points in
 * `n`-dimensional space and iteratively replaces the worst vertex with a
 * reflection, expansion, contraction, or full-shrink step. The method is
 * derivative-free, robust to non-smooth objectives, but only linearly
 * convergent; for smooth problems prefer quasi-Newton methods.
 *
 * Coefficients:
 *
 * - `alpha > 0`: reflection (default `1.0`)
 * - `gamma > 1`: expansion (default `2.0`)
 * - `0 < rho < 1`: contraction (default `0.5`)
 * - `0 < sigma < 1`: shrink (default `0.5`)
 */

/**
 * Nelder-Mead minimization over a multidimensional space.
 *
 * Builds an initial simplex by perturbing each axis of `x0` by `1e-4`
 * and then iterates the standard reflection / expansion / contraction /
 * shrink move until either the spread of function values is below `tol`
 * or `maxIter` iterations have been performed.
 *
 * @param {function(Array<number>): number} f Objective function.
 * @param {Array<number>} x0 Initial guess (length determines dimension).
 * @param {Object} opts Algorithm options.
 * @param {number=} opts.maxIter Maximum iterations (default `1000`).
 * @param {number=} opts.tol Convergence tolerance on the spread of `f`
 *   values across the simplex (default `1e-6`).
 * @param {number=} opts.alpha Reflection coefficient (default `1.0`).
 * @param {number=} opts.gamma Expansion coefficient (default `2.0`).
 * @param {number=} opts.rho Contraction coefficient (default `0.5`).
 * @param {number=} opts.sigma Shrink coefficient (default `0.5`).
 * @return {{x: Array<number>, f: number, iter: number}} Best point, its
 *   function value, and the iteration count at termination.
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
    const sorted = simplex
      .map((pt, idx) => ({pt, fVal: fVals[idx]}))
      .sort((a, b) => a.fVal - b.fVal);

    const sortedPts = sorted.map((s) => s.pt);
    const sortedF = sorted.map((s) => s.fVal);

    bestPt = sortedPts[0];
    bestFVal = sortedF[0];

    const xo = sortedPts[n];
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

    const xr = centroid.map((c, i) => c + alpha * (c - xo[i]));
    const fr = f(xr);

    if (fr < sortedF[0]) {
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
      const xc = centroid.map((c, i) => xo[i] + rho * (c - xo[i]));
      const fc = f(xc);
      if (fc < fn) {
        simplex[n] = xc;
        fVals[n] = fc;
      } else {
        const best = sortedPts[0];
        for (let i = 0; i <= n; i++) {
          simplex[i] = simplex[i].map(
            (val, j) => best[j] + sigma * (val - best[j]),
          );
          fVals[i] = f(simplex[i]);
        }
      }
    }

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
