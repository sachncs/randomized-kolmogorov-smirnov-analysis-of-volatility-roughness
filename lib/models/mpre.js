/**
 * Multifractional Process with Random Exponent (MPRE).
 *
 * A generalization of fBM where H(t) is itself a stochastic process.
 * X_t = B_{H(t)}(t) where H(t) varies slowly over time and B is fBM.
 *
 * Reference: Bianchi, P. et al.
 * "Multifractional processes with random exponent"
 *
 * Google JS Style Guide compliant.
 */

import {randn} from '../random.js';

/**
 * Generates MPRE sample paths using approximation.
 * H evolves as an Ornstein-Uhlenbeck process.
 * The path is approximated using the local Hölder exponent at each point.
 *
 * @param {Object} params Model parameters.
 * @param {number} params.nSteps Number of time steps.
 * @param {number} params.T Terminal time.
 * @param {number} params.hMin Minimum H (default 0.05).
 * @param {number} params.hMax Maximum H (default 0.95).
 * @param {number} params.h0 Initial H (default 0.1).
 * @param {Object} params.hProcess Options for H process dynamics.
 * @param {number} params.hProcess.theta OU speed.
 * @param {number} params.hProcess.mu OU mean.
 * @param {number} params.hProcess.sigma OU volatility.
 * @param {number} params.x0 Initial value.
 * @return {{path: Float64Array, hPath: Float64Array, times: Array<number>}}
 */
export function mpre(params = {}) {
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
 * MPRE with continuous H evolution using exact fractional representation.
 * More accurate but O(n^2) - use for short series only.
 *
 * @param {Object} params Model parameters.
 * @param {number} params.nSteps Number of time steps.
 * @param {number} params.T Terminal time.
 * @param {number} params.hMin Minimum H.
 * @param {number} params.hMax Maximum H.
 * @param {number} params.h0 Initial H.
 * @param {Object} params.hProcess H process dynamics.
 * @param {number} params.x0 Initial value.
 * @return {{path: Float64Array, hPath: Float64Array, times: Array<number>}}
 */
export function mpreExact(params = {}) {
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

  // Precompute kernels for each time step
  // K_{H(t)}(u) = c(H) * u^{H(t)-0.5}
  for (let t = 1; t <= nSteps; t++) {
    let increment = 0;

    for (let j = 0; j < t; j++) {
      const avgH = (hPath[t] + hPath[j]) / 2;
      const u = (t - j) * dt;
      const kernel = Math.sqrt(2 * avgH) * Math.pow(u, avgH - 0.5);
      increment += kernel * randn();
    }
    increment *= Math.sqrt(dt);

    path[t] = path[t - 1] + increment;
  }

  return {path, hPath, times};
}