/**
 * @fileoverview Random number generation utilities for RK-SAVR.
 *
 * This module centralizes every stochastic primitive that other parts of
 * the library depend on:
 *
 * - `randn` / `randnBatch`: scalar or vector draws from the standard normal
 *   via the Box-Muller polar method.
 * - `correlatedGaussian`: pairs of correlated standard normals (used by the
 *   rBergomi simulator).
 * - `generateFGN`: fractional Gaussian noise via **Hosking's method** —
 *   exact at any `H in (0, 1)` but `O(n^2)`.
 * - `generateFBM`: fractional Brownian motion obtained by cumulative
 *   summation of fGN.
 * - `fractionalKernel` / `fractionalIntegral`: the Riemann-Liouville kernel
 *   and integral that drive the rough-volatility simulators.
 *
 * All routines route their randomness through `prng.js`, so calling
 * `setSeed(seed)` before any of them makes the whole pipeline
 * reproducible.
 *
 * ## References
 *
 * - Box, G. E. P., & Muller, M. E. (1958). A note on the generation of
 *   random normal deviates.
 * - Hosking, J. R. M. (1984). Modeling persistence in hydrological time
 *   series using fractional differencing. *Water Resources Research*.
 * - Mandelbrot, B., & Van Ness, J. W. (1968). Fractional Brownian motions,
 *   fractional noises and applications. *SIAM Review*.
 *
 * @see ./prng.js for the seeded mulberry32 generator used here.
 * @see ./models/rbergomi.js for the rBergomi simulator that consumes
 *   `correlatedGaussian` and `fractionalKernel`.
 */

import {random} from './prng.js';

/**
 * Draws a single standard normal via Box-Muller.
 *
 * The polar variant is implemented by guarding against degenerate
 * `u === 0` draws from `random()`. One Box-Muller pair yields two
 * independent standard normals; this routine keeps the cosine component
 * and discards the sine. Use {@link correlatedGaussian} if you need both
 * halves, or call `randn` twice with distinct `random()` outputs.
 *
 * @return {number} A standard normal random variable.
 */
export function randn() {
  let u = 0;
  let v = 0;
  // Guard against the (1 in 2^53) chance of `random()` returning exactly 0,
  // which would break the Box-Muller transform with `log(0) = -Infinity`.
  while (u === 0) u = random();
  while (v === 0) v = random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Pre-allocates a `Float64Array` of standard normals.
 *
 * Useful when an inner loop needs a contiguous buffer of normals; the
 * allocation is amortized across a single batch draw, whereas repeated
 * {@link randn} calls would each allocate internally.
 *
 * @param {number} n Number of samples (`n >= 0`).
 * @return {Float64Array} Buffer of `n` independent standard normals.
 */
export function randnBatch(n) {
  const result = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = randn();
  }
  return result;
}

/**
 * Generates two correlated standard-normal streams via Cholesky.
 *
 * Mathematically the model is `(Z1, Z2)` with unit marginals and
 * `Corr(Z1, Z2) = rho`. Implementation: draw an i.i.d. Box-Muller pair
 * `(z1, z2)`; set `Z1 = z1`; set `Z2 = rho * z1 + sqrt(1 - rho^2) * z2`.
 * Both `Z1` and `Z2` have unit variance and exactly correlation `rho`.
 *
 * Important: `rho` must be **strictly** in `(-1, 1)`; the implementation
 * silently clamps `1 - rho^2` to zero via `Math.max(0, ...)` so the
 * endpoints collapse to the trivial deterministic case.
 *
 * @param {number} n Number of samples.
 * @param {number} rho Target correlation in `(-1, 1)`.
 * @return {Array<Float64Array>} `[Z1, Z2]` of length `n`.
 */
export function correlatedGaussian(n, rho) {
  const Z1 = new Float64Array(n);
  const Z2 = new Float64Array(n);
  const sqrt1Rho2 = Math.sqrt(Math.max(0, 1 - rho * rho));

  for (let i = 0; i < n; i++) {
    // One (u1, u2) Box-Muller pair yields two independent normals.
    const u1 = random();
    const u2 = random();
    const z1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    const z2 = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
    Z1[i] = z1;
    Z2[i] = rho * z1 + sqrt1Rho2 * z2;
  }

  return [Z1, Z2];
}

/**
 * Fractional Gaussian Noise via Hosking's method.
 *
 * Hosking's method is an exact `O(n^2)` Cholesky-style recursion that
 * generates samples from the autocovariance
 *     `gamma(k) = 0.5 (|k+1|^{2H} - 2|k|^{2H} + |k-1|^{2H})`.
 *
 * It uses `O(n)` recursion updates to compute the conditional mean and
 * variance `(phi, v)` incrementally, so the per-step cost is `O(k)` and
 * the total `O(n^2)`. This is fine for the scales used in the paper
 * (a few hundred to a few thousand samples) but dominates for `n >> 1e4`.
 *
 * Assumptions:
 * - `n > 0` and `H in (0, 1)`.
 * - The result is mean-zero (the recursion conditions on `x_0 ~ N(0, 1)`).
 *
 * @param {number} n Length of the desired sample.
 * @param {number} H Hurst parameter; must satisfy `0 < H < 1`.
 * @return {Float64Array} A contiguous fGN sample of length `n`.
 * @throws {Error} When `n` is not a positive finite integer or `H` is out of range.
 */
export function generateFGN(n, H) {
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('n must be a positive finite integer');
  }
  if (!Number.isFinite(H) || H <= 0 || H >= 1) {
    throw new Error('H must satisfy 0 < H < 1');
  }

  // Theoretical autocovariance of fGN: gamma(k) = 0.5 (|k+1|^{2H} -
  // 2|k|^{2H} + |k-1|^{2H}). Used to build the Cholesky recursion.
  const autocov = (k) => {
    const absK = Math.abs(k);
    return (
      0.5 *
      (Math.pow(absK + 1, 2 * H) -
        2 * Math.pow(absK, 2 * H) +
        Math.pow(Math.abs(absK - 1), 2 * H))
    );
  };

  const x = new Float64Array(n);
  const phi = new Float64Array(n);
  const psi = new Float64Array(n);

  x[0] = randn();
  let v = 1.0;

  const r = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    r[i] = autocov(i);
  }

  phi[0] = 0;

  for (let i = 1; i < n; i++) {
    // Hosking's recursion: derive the next AR coefficient, update the
    // innovation variance `v`, and rescale the previous `phi` vector via
    // the Levinson-Durbin-style identity psi_j = phi_j - phi_i * phi_{i-1-j}.
    let num = r[i];
    for (let j = 0; j < i - 1; j++) {
      num -= phi[j] * r[i - 1 - j];
    }
    const nextPhi = num / v;

    for (let j = 0; j < i - 1; j++) {
      psi[j] = phi[j] - nextPhi * phi[i - 2 - j];
    }
    for (let j = 0; j < i - 1; j++) {
      phi[j] = psi[j];
    }
    phi[i - 1] = nextPhi;

    // Innovation variance shrinks by (1 - phi_i^2); guard against tiny
    // negative drift from floating-point noise via Math.max(0, ...).
    v *= 1 - nextPhi * nextPhi;

    let mean = 0;
    for (let j = 0; j < i; j++) {
      mean += phi[j] * x[i - 1 - j];
    }
    x[i] = mean + Math.sqrt(Math.max(0, v)) * randn();
  }

  return x;
}

/**
 * Fractional Brownian Motion by cumulative summation of fGN.
 *
 * The implementation delegates the heavy lifting to {@link generateFGN}
 * and then performs a single `O(n)` cumulative-sum pass. The first sample
 * is fixed at 0 (the standard convention for `fBM(0) = 0`), so paths
 * always start at the origin.
 *
 * For non-zero means, simply add a constant afterwards — `fGn` is
 * mean-zero by construction.
 *
 * @param {number} n Length of the path.
 * @param {number} H Hurst parameter; must satisfy `0 < H < 1`.
 * @return {Float64Array} fBm path of length `n` (`Float64Array(0)` when `n <= 0`).
 * @throws {Error} When `H` is out of range (propagated from `generateFGN`).
 */
export function generateFBM(n, H) {
  if (n <= 0) return new Float64Array(0);

  const fgn = generateFGN(n, H);
  const fbm = new Float64Array(n);
  fbm[0] = 0;

  for (let i = 1; i < n; i++) {
    fbm[i] = fbm[i - 1] + fgn[i - 1];
  }

  return fbm;
}

/**
 * Precomputes the Riemann-Liouville fractional kernel used by the
 * rough-volatility simulators.
 *
 * Mathematically `K(t) = sqrt(2 H) * t^{H - 0.5}` for `t > 0`. The result is
 * a length-`nSteps` array where entry `i` corresponds to `t = (i + 1) * dt`.
 *
 * Reusing a precomputed kernel for every path avoids the O(n^2) cost of
 * re-evaluating the power function per integration step.
 *
 * @param {number} H Hurst parameter.
 * @param {number} nSteps Number of time steps covered by the kernel.
 * @param {number} dt Per-step time increment.
 * @return {Float64Array} Kernel values of length `nSteps`.
 */
export function fractionalKernel(H, nSteps, dt) {
  const kernel = new Float64Array(nSteps);
  const coeff = Math.sqrt(2 * H);
  for (let i = 0; i < nSteps; i++) {
    const t = (i + 1) * dt;
    kernel[i] = coeff * Math.pow(t, H - 0.5);
  }
  return kernel;
}

/**
 * Computes a single time-step of the Riemann-Liouville fractional integral.
 *
 * Given precomputed Brownian increments `dW` and a kernel from
 * {@link fractionalKernel}, returns
 *     `I_t = sum_{j=0}^{t-1} K(t - j) * dW_j`.
 *
 * Used inside the rBergomi path generator and the exact `fOU` driver.
 *
 * Complexity: `O(t)` per call, so building a full path is `O(n^2)`. This
 * is acceptable for paths up to a few hundred steps; for long simulations
 * switch to a circulant-embedding FFT approximation (not implemented here).
 *
 * @param {Float64Array} dW Brownian increments.
 * @param {Float64Array} kernel Precomputed kernel of length `>= t`.
 * @param {number} t Current time index (exclusive upper bound).
 * @return {number} Fractional integral value at time `t`.
 */
export function fractionalIntegral(dW, kernel, t) {
  let sum = 0;
  for (let j = 0; j < t; j++) {
    sum += kernel[t - 1 - j] * dW[j];
  }
  return sum;
}
