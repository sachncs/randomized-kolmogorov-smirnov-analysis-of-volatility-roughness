/**
 * Rough Bergomi (rBergomi) model implementation.
 * Two-factor rough volatility model with async coupling.
 *
 * Reference: Bayer, Friz, Gatheral (2016)
 * "Roughing it up: Connecting rough volatility with option pricing"
 *
 * The model:
 *   dV_t = eta * V_t * dW_t^perp
 *   I_t = integral_0^t K(t-s) dW_s^perp
 *   V_t = xi_t * exp(eta * I_t - (eta^2/2) * t^{2H})
 *   where K(t) = sqrt(2H) * t^{H-0.5} for H in (0, 0.5]
 *
 * Google JS Style Guide compliant.
 */

import {
  correlatedGaussian,
  fractionalKernel,
  fractionalIntegral,
} from '../random.js';

/**
 * Generates rough Bergomi volatility paths.
 * The variance process follows:
 *   V_t = xi * exp(eta * I_t - (eta^2/2) * t^{2H})
 * where I_t is the Riemann-Liouville fractional integral of W^perp.
 *
 * @param {Object} params Model parameters.
 * @param {number} params.nPaths Number of simulation paths.
 * @param {number} params.nSteps Number of time steps.
 * @param {number} params.xi Initial volatility level (xi_0).
 * @param {number} params.eta Volatility of volatility.
 * @param {number} params.rho Correlation between Brownian motions (-1 to 1).
 * @param {number} params.h Hurst parameter (0 < H <= 0.5 for rough).
 * @param {number} params.T Terminal time.
 * @return {{paths: Array<Float64Array>, times: Array<number>}}
 */
export function rBergomi(params = {}) {
  const nPaths = params.nPaths || 1;
  const nSteps = params.nSteps || 252;
  const xi = params.xi || 0.04;
  const eta = params.eta || 2.0;
  const rho = params.rho !== undefined ? params.rho : -0.8;
  const H = params.h || 0.1;
  const T = params.T || 1.0;
  const dt = T / nSteps;

  // Precompute the fractional kernel K(t) = sqrt(2H) * t^{H-0.5}
  const kernel = fractionalKernel(H, nSteps, dt);

  const times = new Array(nSteps + 1);
  times[0] = 0;
  for (let t = 1; t <= nSteps; t++) {
    times[t] = t * dt;
  }

  // Precompute the drift adjustment factor
  const driftFactor = (eta * eta / 2) * Math.pow(dt, 2 * H);

  const paths = [];
  const brownians = [];

  for (let p = 0; p < nPaths; p++) {
    const path = new Float64Array(nSteps + 1);
    path[0] = xi;

    // Generate correlated Brownian increments
    const [dW, dWperp] = correlatedGaussian(nSteps, rho);

    // Precompute squared increments for efficiency
    const dWsqrt = new Float64Array(nSteps);
    const dWperpsqrt = new Float64Array(nSteps);
    for (let t = 0; t < nSteps; t++) {
      dWsqrt[t] = dW[t] * Math.sqrt(dt);
      dWperpsqrt[t] = dWperp[t] * Math.sqrt(dt);
    }

    // Compute the fractional integral I_t = sum_{j=0}^{t-1} K(t-j) * dW_perp_j
    const I = new Float64Array(nSteps + 1);
    I[0] = 0;

    for (let t = 1; t <= nSteps; t++) {
      I[t] = fractionalIntegral(dWperp, kernel, t);
    }

    // Compute variance process
    for (let t = 1; t <= nSteps; t++) {
      const It = I[t];
      const Vt = xi * Math.exp(eta * It - driftFactor * Math.pow(t * dt, 2 * H));
      path[t] = Math.max(0, Vt);
    }

    paths.push(path);
    brownians.push(dW);
  }

  return {paths, times, brownians};
}

/**
 * Generates log-price paths under rough volatility.
 * SDE: dS_t = vol_t * S_t * dW_t
 * where vol_t = sqrt(V_t) from rBergomi.
 *
 * @param {Object} params Model parameters.
 * @param {number} params.nPaths Number of paths.
 * @param {number} params.nSteps Number of time steps.
 * @param {number} params.mu Drift (default 0 for martingale).
 * @param {number} params.s0 Initial price (default 100).
 * @param {number} params.xi Initial volatility.
 * @param {number} params.eta Vol of vol.
 * @param {number} params.rho Correlation.
 * @param {number} params.h Hurst parameter.
 * @param {number} params.T Terminal time.
 * @return {{prices: Array<Float64Array>, volatilities: Array<Float64Array>, times: Array<number>}}
 */
export function rBergomiPrice(params = {}) {
  const nPaths = params.nPaths || 1;
  const nSteps = params.nSteps || 252;
  const mu = params.mu || 0;
  const s0 = params.s0 || 100;
  const T = params.T || 1.0;

  const volResult = rBergomi({
    nPaths,
    nSteps,
    xi: params.xi,
    eta: params.eta,
    rho: params.rho,
    h: params.h,
    T,
  });

  const paths = volResult.paths;
  const times = volResult.times;
  const brownians = volResult.brownians;
  const dt = T / nSteps;

  const prices = [];
  const volatilities = [];

  for (let p = 0; p < nPaths; p++) {
    const volPath = paths[p];
    const dW = brownians[p];
    const pricePath = new Float64Array(nSteps + 1);
    pricePath[0] = s0;

    for (let t = 0; t < nSteps; t++) {
      const vol = Math.sqrt(volPath[t + 1]);
      const dWsqrt = dW[t] * Math.sqrt(dt);
      pricePath[t + 1] = pricePath[t] * Math.exp(mu * dt + vol * dWsqrt);
    }

    prices.push(pricePath);
    volatilities.push(volPath);
  }

  return {
    prices,
    volatilities,
    times,
  };
}