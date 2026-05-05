/**
 * Rough Fractional Stochastic Volatility (rFSV) model.
 *
 * Combines rough volatility with Heston-like dynamics.
 * The roughness comes from the fractional kernel in the volatility process.
 *
 * Model:
 *   dV_t = theta * (mu - V_t) dt + nu * V_t^alpha dW_t^V
 *   with roughness from fractional kernel K(t) = sqrt(2H) * t^{H-0.5}
 *
 * Reference: Gatheral, Jaisson, Rosenbaum (2018)
 * "Volatility is Rough"
 *
 * Google JS Style Guide compliant.
 */

import {generateFGN, randn, randnBatch, fractionalKernel} from '../random.js';

/**
 * Simulates rFSV process.
 * The volatility has both a classical Heston component and a rough component
 * driven by fractional Brownian motion.
 *
 * @param {Object} params Model parameters.
 * @param {number} params.nSteps Number of time steps.
 * @param {number} params.T Terminal time.
 * @param {number} params.h Hurst parameter (roughness).
 * @param {number} params.theta Mean reversion speed.
 * @param {number} params.mu Long-term variance mean.
 * @param {number} params.nu Volatility of volatility.
 * @param {number} params.alpha Diffusion exponent (default 0.5 for square-root).
 * @param {number} params.v0 Initial variance.
 * @return {{volPath: Float64Array, times: Array<number>}}
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
    const volDiffusion = nu * Math.pow(prevVol, alpha) * Math.sqrt(dt) * normals[t];

    // Rough component from fractional noise
    // The roughness term: nu * integral K(t-s) dW_s
    // We use the fGn as the driver for the rough component
    let roughComp = 0;
    for (let j = 0; j < t; j++) {
      roughComp += kernel[t - 1 - j] * fGn[j];
    }
    roughComp *= Math.sqrt(dt);

    volPath[t] = Math.max(1e-6, prevVol + volDrift + volDiffusion + roughComp * nu * 0.1);
  }

  return {volPath, times};
}

/**
 * Generates price path under rFSV.
 * dS_t = vol_t * S_t * dW_t
 *
 * @param {Object} params Model parameters.
 * @param {number} params.drift Drift (default 0).
 * @param {number} params.s0 Initial price (default 100).
 * @param {number} params.nSteps Number of time steps.
 * @param {number} params.T Terminal time.
 * @param {number} params.h Hurst parameter.
 * @param {number} params.theta Mean reversion speed.
 * @param {number} params.mu Long-term mean.
 * @param {number} params.nu Vol of vol.
 * @param {number} params.v0 Initial variance.
 * @return {{prices: Float64Array, volatilities: Float64Array, times: Array<number>}}
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