/**
 * @fileoverview Rough Bergomi (rBergomi) simulator.
 *
 * ## Model
 *
 * The variance process follows
 *
 *     dV_t / V_t = eta * dW_t^perp
 *     I_t        = ∫_0^t sqrt(2H) * (t - s)^{H - 0.5} dW_s^perp
 *     V_t        = xi * exp(eta * I_t - (eta^2 / 2) * t^{2H})
 *
 * where `W^perp` is a Brownian motion correlated with the price Brownian
 * `W` via `dW_t * dW_t^perp = rho dt`. The kernel `K(t) = sqrt(2H) *
 * t^{H - 0.5}` is the Riemann-Liouville fractional kernel of order
 * `H - 0.5 < 0` for `0 < H <= 0.5`.
 *
 * Implementation strategy:
 *
 * 1. Draw `nPaths` pairs of correlated standard normals once via
 *    {@link correlatedGaussian}.
 * 2. For each path, precompute the fractional kernel and accumulate the
 *    running fractional integral `I_t` time-step by time-step via
 *    {@link fractionalIntegral}.
 * 3. Apply the exponential-of-linear formula to obtain the variance path;
 *    the negative `(eta^2 / 2) * t^{2H}` term corrects the drift.
 *
 * Path generation is `O(nPaths * nSteps^2)` due to the cumulative kernel
 * convolution. For very long paths switch to a circulant-embedding FFT
 * approximation (not implemented here).
 *
 * @see Bayer, C., Friz, P., Gatheral, J. (2016). Pricing under rough
 *   volatility. *Quantitative Finance* 16(6), 887-884.
 * @see ../random.js for the stochastic primitives used here.
 */

import {
  correlatedGaussian,
  fractionalKernel,
  fractionalIntegral,
} from '../random.js';

/**
 * Generates `nPaths` rBergomi volatility paths.
 *
 * Returns both the variance paths and the time grid. The Brownian
 * increments are also retained in the `brownians` field so that
 * {@link rBergomiPrice} can drive a price SDE with the same noise
 * realization.
 *
 * @param {Object} params Model parameters.
 * @param {number=} params.nPaths Number of simulation paths (default `1`).
 * @param {number=} params.nSteps Number of time steps (default `252`).
 * @param {number=} params.xi Initial variance level `xi` (default `0.04`).
 * @param {number=} params.eta Volatility-of-volatility (default `2.0`).
 * @param {number=} params.rho Correlation between price and volatility
 *   Brownian motions (default `-0.8`).
 * @param {number=} params.h Hurst parameter; should satisfy
 *   `0 < H <= 0.5` for the rough regime (default `0.1`).
 * @param {number=} params.T Terminal time (default `1.0`).
 * @return {{paths: Array<Float64Array>, times: Array<number>, brownians:
 *   Array<Float64Array>}} Simulated variance paths, time grid, and the
 *   underlying Brownian increments for downstream use.
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
  const driftFactor = ((eta * eta) / 2) * Math.pow(dt, 2 * H);

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
      const Vt =
        xi * Math.exp(eta * It - driftFactor * Math.pow(t * dt, 2 * H));
      path[t] = Math.max(0, Vt);
    }

    paths.push(path);
    brownians.push(dW);
  }

  return {paths, times, brownians};
}

/**
 * Generates log-price (or price) paths under rBergomi variance.
 *
 * Given a previously simulated variance path `V_t` from
 * {@link rBergomi}, the price SDE
 *
 *     dS_t / S_t = exp(V_t^{0.5}) * dW_t + mu dt
 *
 * is integrated in log form (so that the price cannot drift below zero)
 * using the same Brownian realization that was used to build the
 * variance path.
 *
 * @param {Object} params Model parameters. Inherits every rBergomi
 *   parameter from {@link rBergomi} (`xi`, `eta`, `rho`, `h`, `T`) and
 *   adds the price-specific ones below.
 * @param {number=} params.nPaths Number of paths (default `1`).
 * @param {number=} params.nSteps Number of time steps (default `252`).
 * @param {number=} params.mu Drift (default `0`, martingale).
 * @param {number=} params.s0 Initial price (default `100`).
 * @param {number=} params.xi Initial variance (default `0.04`).
 * @param {number=} params.eta Vol-of-vol (default `2.0`).
 * @param {number=} params.rho Correlation (default `-0.8`).
 * @param {number=} params.h Hurst (default `0.1`).
 * @param {number=} params.T Terminal time (default `1.0`).
 * @return {{prices: Array<Float64Array>, volatilities:
 *   Array<Float64Array>, times: Array<number>}} Simulated price paths,
 *   their variance paths, and the shared time grid.
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
