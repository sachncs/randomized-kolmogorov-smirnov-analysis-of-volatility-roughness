/**
 * @fileoverview Fractional Ornstein-Uhlenbeck (fOU) simulator.
 *
 * Mean-reverting process driven by fractional Brownian motion:
 *
 *     dX_t = theta * (mu - X_t) dt + sigma * dB^H_t
 *
 * where `B^H` is fractional Brownian motion with Hurst parameter `H`.
 *
 * - For `H = 0.5` the driver reduces to ordinary Brownian motion and
 *   the simulator switches to an exact discretization (the Vasicek
 *   recursion).
 * - For `H != 0.5` we fall back to Euler-Maruyama using a pre-generated
 *   fGN sample; this introduces `O(sqrt(dt))` bias but is adequate for
 *   path generation at the typical sample sizes used here.
 *
 * The `exactOU` companion uses a fully consistent fractional integral
 * discretization that is more accurate but `O(n^2)` per path.
 */

import {generateFGN, randn} from '../random.js';

/**
 * Simulates an fOU path using Euler-Maruyama (or exact Vasicek when
 * `H = 0.5`).
 *
 * The exact Vasicek recursion for `H = 0.5` is
 *
 *     X_{t+1} = mu + (X_t - mu) * exp(-theta * dt)
 *                      + sigma * sqrt((1 - exp(-2 theta dt)) / (2 theta))
 *                        * Z_{t+1}
 *
 * which avoids the bias introduced by naive EM for the standard OU
 * process.
 *
 * @param {Object} params Model parameters.
 * @param {number=} params.nSteps Number of time steps (default `252`).
 * @param {number=} params.T Terminal time (default `1.0`).
 * @param {number=} params.theta Mean-reversion speed (default `1.0`).
 * @param {number=} params.mu Long-term mean (default `0.0`).
 * @param {number=} params.sigma Diffusion scale (default `1.0`).
 * @param {number=} params.h Hurst parameter (default `0.5`).
 * @param {number=} params.x0 Initial value (default `0.0`).
 * @return {{path: Float64Array, times: Array<number>}} Simulated path
 *   and time grid.
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
 * "Exact" Riemann-Liouville fractional-integral fOU simulator.
 *
 * Replaces the Euler-Maruyama diffusion of {@link fOU} with an exact
 * Riemann-Liouville integral of the Brownian increments against a
 * precomputed kernel
 *
 *     K(i) = sqrt(2H) * (i * dt)^{H - 0.5}
 *
 * Path update becomes
 *
 *     X_{t+1} = X_t + theta * (mu - X_t) * dt + sigma * sqrt(dt) * I_{t+1}
 *     I_{t+1} = sum_{j <= t} K(t - j) * dW_j
 *
 * The integral is `O(t)` per step and the entire path is `O(n^2)` in
 * `nSteps`, so this is reserved for short series or experiments that
 * need to isolate discretization error.
 *
 * @param {Object} params Same shape as {@link fOU}.
 * @param {number=} params.nSteps Number of time steps (default `252`).
 * @param {number=} params.T Terminal time (default `1.0`).
 * @param {number=} params.theta Mean-reversion speed (default `1.0`).
 * @param {number=} params.mu Long-term mean (default `0.0`).
 * @param {number=} params.sigma Diffusion scale (default `1.0`).
 * @param {number=} params.h Hurst parameter (default `0.5`).
 * @param {number=} params.x0 Initial value (default `0.0`).
 * @return {{path: Float64Array, times: Array<number>}} Simulated path
 *   and time grid.
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
