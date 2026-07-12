/**
 * @fileoverview Rough Fractional Stochastic Volatility (rFSV) simulator.
 *
 * Combines a Heston-style drift/diffusion
 *
 *     dV_t = theta * (mu - V_t) dt + nu * V_t^alpha * dW^V_t
 *
 * with an additive roughness term driven by the fractional kernel
 * `K(t) = sqrt(2H) * t^{H - 0.5}`. The mean-reversion (`theta`) targets
 * the long-run variance `mu` and the diffusion exponent `alpha = 0.5`
 * recovers the classical square-root process.
 *
 * The discretization uses an Euler-Maruyama step for the Heston
 * component plus a small additive roughness shock; the resulting path is
 * floored at `1e-6` so that `V_t` stays strictly positive.
 *
 * @see Gatheral, J., Jaisson, T., Rosenbaum, M. (2018). Volatility is
 *   rough. *Quantitative Finance* 18(6), 933-949.
 */

import {generateFGN, randn, randnBatch, fractionalKernel} from '../random.js';

/**
 * Simulates a single rFSV variance path.
 *
 * The Euler-Maruyama step writes
 *
 *     V_t = V_{t-1} + theta * (mu - V_{t-1}) * dt
 *                 + nu * V_{t-1}^alpha * sqrt(dt) * Z_t
 *                 + roughness contribution
 *
 * where the roughness term is `nu * 0.1 * sqrt(dt) * ∑_{j<t} K(t-j) * fGn_j`.
 * The constant `0.1` is a small multiplier that prevents the rough term
 * from dominating the path at typical calibration scales.
 *
 * Path values are floored at `1e-6` for numerical robustness.
 *
 * @param {Object} params Model parameters.
 * @param {number=} params.nSteps Number of time steps (default `252`).
 * @param {number=} params.T Terminal time (default `1.0`).
 * @param {number=} params.h Hurst parameter (default `0.1`).
 * @param {number=} params.theta Mean-reversion speed (default `2.0`).
 * @param {number=} params.mu Long-term variance mean (default `0.04`).
 * @param {number=} params.nu Vol-of-vol (default `0.5`).
 * @param {number=} params.alpha Diffusion exponent (default `0.5`,
 *   matching the Heston square-root form).
 * @param {number=} params.v0 Initial variance (default `0.04`).
 * @return {{volPath: Float64Array, times: Array<number>}} Simulated
 *   variance path and time grid.
 */
export function rFSV(params = {}) {
  const nSteps = params.nSteps || 252;
  const T = params.T || 1.0;
  const dt = T / nSteps;
  const H = params.h || 0.1;
  const theta = params.theta || 2.0;
  const mu = params.mu || 0.04;
  const nu = params.nu || 0.5;
  const alpha = params.alpha !== undefined ? params.alpha : 0.5;
  const v0 = params.v0 || 0.04;

  // Precompute the fractional kernel for roughness
  const kernel = fractionalKernel(H, nSteps, dt);

  const times = new Array(nSteps + 1);
  times[0] = 0;
  for (let t = 1; t <= nSteps; t++) {
    times[t] = t * dt;
  }

  const volPath = new Float64Array(nSteps + 1);
  volPath[0] = v0;

  // Generate fractional Gaussian noise for the rough component
  const fGn = generateFGN(nSteps + 1, H);
  // Standard normal for the diffusion
  const normals = randnBatch(nSteps + 1);

  for (let t = 1; t <= nSteps; t++) {
    const prevVol = volPath[t - 1];
    const volDrift = theta * (mu - prevVol) * dt;
    const volDiffusion =
      nu * Math.pow(prevVol, alpha) * Math.sqrt(dt) * normals[t];

    // Rough component from fractional noise
    // The roughness term: nu * integral K(t-s) dW_s
    // We use the fGn as the driver for the rough component
    let roughComp = 0;
    for (let j = 0; j < t; j++) {
      roughComp += kernel[t - 1 - j] * fGn[j];
    }
    roughComp *= Math.sqrt(dt);

    volPath[t] = Math.max(
      1e-6,
      prevVol + volDrift + volDiffusion + roughComp * nu * 0.1,
    );
  }

  return {volPath, times};
}

/**
 * Generates an arithmetic-Brownian-motion price path under an
 * independently simulated rFSV variance.
 *
 * Steps:
 *
 * 1. Call {@link rFSV} to obtain a variance trajectory.
 * 2. Iterate the SDE
 *
 *        dS_t = vol_t * S_t * (drift * dt + dW_t * sqrt(dt))
 *
 *    using freshly drawn normals (no correlation with the variance
 *    driver — the `Price` flavor assumes independent drivers, which is a
 *    convenient simplification for offline testing).
 *
 * Note that this routine generates an *independent* noise realization
 * from the one used inside {@link rFSV}; the paper-faithful correlated
 * version would require regenerating the drivers with shared Brownian
 * motion. For experiments that demand correlation, use
 * {@link rBergomiPrice} instead.
 *
 * @param {Object} params Model parameters.
 * @param {number=} params.drift Drift (default `0`).
 * @param {number=} params.s0 Initial price (default `100`).
 * @param {number=} params.nSteps Number of time steps (default `252`).
 * @param {number=} params.T Terminal time (default `1.0`).
 * @param {number=} params.h Hurst parameter (default `0.1`).
 * @param {number=} params.theta Mean-reversion speed (default `2.0`).
 * @param {number=} params.mu Long-term variance mean (default `0.04`).
 * @param {number=} params.nu Vol-of-vol (default `0.5`).
 * @param {number=} params.v0 Initial variance (default `0.04`).
 * @return {{prices: Float64Array, volatilities: Float64Array, times:
 *   Array<number>}} Simulated price, the underlying variance path, and
 *   the shared time grid.
 */
export function rFSVPrice(params = {}) {
  const volResult = rFSV({
    nSteps: params.nSteps || 252,
    T: params.T || 1.0,
    h: params.h || 0.1,
    theta: params.theta || 2.0,
    mu: params.mu !== undefined ? params.mu : 0.04,
    nu: params.nu || 0.5,
    v0: params.v0 || 0.04,
  });

  const nSteps = params.nSteps || 252;
  const T = params.T || 1.0;
  const dt = T / nSteps;
  const s0 = params.s0 || 100;
  const drift = params.drift !== undefined ? params.drift : 0;

  const prices = new Float64Array(nSteps + 1);
  prices[0] = s0;

  const {volPath, times} = volResult;

  for (let t = 0; t < nSteps; t++) {
    const vol = Math.sqrt(volPath[t + 1]);
    const z = randn();
    const dS = vol * prices[t] * (drift * dt + z * Math.sqrt(dt));
    prices[t + 1] = prices[t] + dS;
  }

  return {
    prices,
    volatilities: volPath,
    times,
  };
}
