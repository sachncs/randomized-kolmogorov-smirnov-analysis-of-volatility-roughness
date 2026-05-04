/**
 * Fractional Ornstein-Uhlenbeck (fOU) process.
 * Mean-reverting process driven by fractional Brownian motion.
 *
 * dX_t = theta * (mu - X_t) dt + sigma * dB_t^H
 * where B^H is fractional Brownian motion with Hurst H.
 *
 * For H = 0.5, this reduces to the classical OU process.
 * For H != 0.5, the driving noise has memory.
 *
 * Google JS Style Guide compliant.
 */

import {generateFGN, randn} from '../random.js';

/**
 * Generates fOU sample paths using Euler-Maruyama discretization.
 * For H = 0.5, uses exact discretization.
 *
 * @param {Object} params Model parameters.
 * @param {number} params.nSteps Number of time steps.
 * @param {number} params.T Terminal time.
 * @param {number} params.theta Mean reversion speed.
 * @param {number} params.mu Long-term mean.
 * @param {number} params.sigma Volatility of the fBM driver.
 * @param {number} params.h Hurst parameter (default 0.5 for standard OU).
 * @param {number} params.x0 Initial value.
 * @return {{path: Float64Array, times: Array<number>}}
 */
export function fOU(params = {}) {
  const nSteps = params.nSteps || 252;
  const T = params.T || 1.0;
  const dt = T / nSteps;
  const theta = params.theta || 1.0;
  const mu = params.mu || 0.0;
  const sigma = params.sigma || 1.0;
  const H = params.h !== undefined ? params.h : 0.5;
  const x0 = params.x0 || 0.0;

  const times = new Array(nSteps + 1);
  times[0] = 0;
  for (let t = 1; t <= nSteps; t++) {
    times[t] = t * dt;
  }

  const path = new Float64Array(nSteps + 1);
  path[0] = x0;

  if (H === 0.5) {
    // Exact discretization for standard OU
    const decay = Math.exp(-theta * dt);
    const normConst = sigma * Math.sqrt((1 - decay * decay) / (2 * theta));

    for (let t = 1; t <= nSteps; t++) {
      path[t] = mu + (path[t - 1] - mu) * decay + normConst * randn();
    }
  } else {
    // Euler-Maruyama for fractional OU
    // Generate fractional Gaussian noise
    const fGn = generateFGN(nSteps, H);
    const sqrtDt = Math.sqrt(dt);

    for (let t = 1; t <= nSteps; t++) {
      const drift = theta * (mu - path[t - 1]) * dt;
      const diffusion = sigma * fGn[t - 1] * sqrtDt;
      path[t] = path[t - 1] + drift + diffusion;
    }
  }

  return {path, times};
}

/**
 * Alternative fOU using exact Riemann-Liouville integral representation.
 * More accurate but slower for long time series.
 *
 * @param {Object} params Model parameters.
 * @param {number} params.nSteps Number of time steps.
 * @param {number} params.T Terminal time.
 * @param {number} params.theta Mean reversion speed.
 * @param {number} params.mu Long-term mean.
 * @param {number} params.sigma Volatility.
 * @param {number} params.h Hurst parameter.
 * @param {number} params.x0 Initial value.
 * @return {{path: Float64Array, times: Array<number>}}
 */
export function exactOU(params = {}) {
  const nSteps = params.nSteps || 252;
  const T = params.T || 1.0;
  const dt = T / nSteps;
  const theta = params.theta || 1.0;
  const mu = params.mu || 0.0;
  const sigma = params.sigma || 1.0;
  const H = params.h !== undefined ? params.h : 0.5;
  const x0 = params.x0 || 0.0;

  const times = new Array(nSteps + 1);
  times[0] = 0;
  for (let t = 1; t <= nSteps; t++) {
    times[t] = t * dt;
  }

  const path = new Float64Array(nSteps + 1);
  path[0] = x0;

  if (H === 0.5) {
    const decay = Math.exp(-theta * dt);
    const normConst = sigma * Math.sqrt((1 - decay * decay) / (2 * theta));
    for (let t = 1; t <= nSteps; t++) {
      path[t] = mu + (path[t - 1] - mu) * decay + normConst * randn();
    }
  } else {
    // Precompute kernel for fractional integral
    const kernel = new Float64Array(nSteps);
    const coeff = Math.sqrt(2 * H);
    for (let i = 0; i < nSteps; i++) {
      const t = (i + 1) * dt;
      kernel[i] = coeff * Math.pow(t, H - 0.5);
    }

    // Generate fBM increments
    const fGn = generateFGN(nSteps, H);

    for (let t = 1; t <= nSteps; t++) {
      const drift = theta * (mu - path[t - 1]) * dt;

      // Fractional integral: sum_{j=0}^{t-1} K(t-j) * dW_j
      let fracInt = 0;
      for (let j = 0; j < t; j++) {
        fracInt += kernel[t - 1 - j] * fGn[j];
      }
      fracInt *= Math.sqrt(dt);

      path[t] = path[t - 1] + drift + sigma * fracInt;
    }
  }

  return {path, times};
}