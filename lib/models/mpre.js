/**
 * @fileoverview Multifractional Process with Random Exponent (mPRE).
 *
 * A generalization of fractional Brownian motion in which the local
 * Hölder exponent `H(t)` is itself a stochastic process
 *
 *     X_t = B_{H(t)}(t),
 *
 * sampled here by driving `H(t)` with an Ornstein-Uhlenbeck mean-reverting
 * process bounded between `hMin` and `hMax`. Two simulators are
 * shipped:
 *
 * - `mPRE`: an `O(n)` local-Holder approximation that uses the
 *   conditional variance `dt^{2 * H_avg}` of an fBm increment.
 * - `mPREExact`: an `O(n^2)` exact Riemann-Liouville integration with a
 *   time-varying exponent at every lag.
 *
 * The local-Holder approximation is the practical default for paths of
 * more than a few hundred steps; it is accurate to first order in `dt`
 * and avoids the obvious `O(n^2)` cost of the exact variant.
 */

import {randn} from '../random.js';

/**
 * Simulates an MPRE path using the local-Holder approximation.
 *
 * The process generates two trajectories sharing the same time grid:
 *
 * - `hPath`: a mean-reverting OU process in `[hMin, hMax]`.
 * - `path`: the cumulative sum of `sqrt(dt^{2 H_avg}) * randn()` where
 *   `H_avg = (hPath[t] + hPath[t - 1]) / 2`.
 *
 * The variance of each increment is therefore time-varying, which models
 * the rough/smooth regime changes that motivate the model.
 *
 * @param {Object} params Model parameters.
 * @param {number=} params.nSteps Number of time steps (default `252`).
 * @param {number=} params.T Terminal time (default `1.0`).
 * @param {number=} params.hMin Lower clamp on `H(t)` (default `0.05`).
 * @param {number=} params.hMax Upper clamp on `H(t)` (default `0.95`).
 * @param {number=} params.h0 Initial `H` (default `0.1`).
 * @param {Object=} params.hProcess OU options for `H(t)`.
 * @param {number=} params.hProcess.theta Mean-reversion speed
 *   (default `1.0`).
 * @param {number=} params.hProcess.mu Long-term mean (default `0.2`).
 * @param {number=} params.hProcess.sigma Diffusion scale (default
 *   `0.1`).
 * @param {number=} params.x0 Initial value of the path (default `0`).
 * @return {{path: Float64Array, hPath: Float64Array, times:
 *   Array<number>}} Simulated path, latent `H(t)` path, and time grid.
 */
export function mPRE(params = {}) {
  const nSteps = params.nSteps || 252;
  const T = params.T || 1.0;
  const dt = T / nSteps;
  const hMin = params.hMin || 0.05;
  const hMax = params.hMax || 0.95;
  const h0 = params.h0 || 0.1;
  const x0 = params.x0 || 0.0;

  const hProcess = params.hProcess || {};
  const hTheta = hProcess.theta || 1.0;
  const hMu = hProcess.mu || 0.2;
  const hSigma = hProcess.sigma || 0.1;

  const times = new Array(nSteps + 1);
  times[0] = 0;
  for (let t = 1; t <= nSteps; t++) {
    times[t] = t * dt;
  }

  // Generate H path using Ornstein-Uhlenbeck
  const hPath = new Float64Array(nSteps + 1);
  hPath[0] = h0;

  const decay = Math.exp(-hTheta * dt);
  const hNoiseScale = hSigma * Math.sqrt((1 - decay * decay) / (2 * hTheta));

  for (let t = 1; t <= nSteps; t++) {
    const noise = randn();
    hPath[t] = hMu + (hPath[t - 1] - hMu) * decay + hNoiseScale * noise;
    hPath[t] = Math.max(hMin, Math.min(hMax, hPath[t]));
  }

  // Generate MPRE path using local approximation
  // X_t - X_{t-1} ~ N(0, dt^{2 * H_avg})
  const path = new Float64Array(nSteps + 1);
  path[0] = x0;

  for (let t = 1; t <= nSteps; t++) {
    const H = hPath[t];
    const prevH = hPath[t - 1];
    const avgH = (H + prevH) / 2;
    const variance = Math.pow(dt, 2 * avgH);
    path[t] = path[t - 1] + Math.sqrt(variance) * randn();
  }

  return {path, hPath, times};
}

/**
 * "Exact" MPRE simulator using a time-varying Riemann-Liouville kernel.
 *
 * Each lag `(t, j)` evaluates the kernel
 *
 *     K_{H(t)}(t - j) = sqrt(2 * (H(t) + H(j)) / 2) * ((t - j) * dt)^{H(t)/2 + H(j)/2 - 1}
 *
 * where the exponent is built from the average of the endpoint Holder
 * values. The path accumulates the corresponding weighted Brownian
 * increments, so every lag of every step is `O(t)` and the full path is
 * `O(n^2)`. The kernel is **not** cached across time-steps — the
 * `H(t)`-dependence makes caching ineffective.
 *
 * @param {Object} params Same shape as {@link mPRE}.
 * @param {number=} params.nSteps Number of time steps (default `252`).
 * @param {number=} params.T Terminal time (default `1.0`).
 * @param {number=} params.hMin Lower clamp on `H(t)` (default `0.05`).
 * @param {number=} params.hMax Upper clamp on `H(t)` (default `0.95`).
 * @param {number=} params.h0 Initial `H` (default `0.1`).
 * @param {Object=} params.hProcess OU options for `H(t)`.
 * @param {number=} params.x0 Initial value of the path (default `0`).
 * @return {{path: Float64Array, hPath: Float64Array, times:
 *   Array<number>}} Simulated path, latent `H(t)` path, and time grid.
 */
export function mPREExact(params = {}) {
  const nSteps = params.nSteps || 252;
  const T = params.T || 1.0;
  const dt = T / nSteps;
  const hMin = params.hMin || 0.05;
  const hMax = params.hMax || 0.95;
  const h0 = params.h0 || 0.1;

  const hProcess = params.hProcess || {};
  const hTheta = hProcess.theta || 1.0;
  const hMu = hProcess.mu || 0.2;
  const hSigma = hProcess.sigma || 0.1;

  const times = new Array(nSteps + 1);
  times[0] = 0;
  for (let t = 1; t <= nSteps; t++) {
    times[t] = t * dt;
  }

  // Generate H path
  const hPath = new Float64Array(nSteps + 1);
  hPath[0] = h0;

  const decay = Math.exp(-hTheta * dt);
  const hNoiseScale = hSigma * Math.sqrt((1 - decay * decay) / (2 * hTheta));

  for (let t = 1; t <= nSteps; t++) {
    const noise = randn();
    hPath[t] = hMu + (hPath[t - 1] - hMu) * decay + hNoiseScale * noise;
    hPath[t] = Math.max(hMin, Math.min(hMax, hPath[t]));
  }

  // Generate path using time-varying fractional kernel
  const path = new Float64Array(nSteps + 1);
  path[0] = 0;

  // Pre-generate Brownian increments for the fractional integral
  const dW = new Float64Array(nSteps);
  for (let i = 0; i < nSteps; i++) {
    dW[i] = randn();
  }

  // Precompute kernels for each time step
  // K_{H(t)}(u) = c(H) * u^{H(t)-0.5}
  for (let t = 1; t <= nSteps; t++) {
    let increment = 0;

    for (let j = 0; j < t; j++) {
      const avgH = (hPath[t] + hPath[j]) / 2;
      const u = (t - j) * dt;
      const kernel = Math.sqrt(2 * avgH) * Math.pow(u, avgH - 0.5);
      increment += kernel * dW[j];
    }
    increment *= Math.sqrt(dt);

    path[t] = path[t - 1] + increment;
  }

  return {path, hPath, times};
}
