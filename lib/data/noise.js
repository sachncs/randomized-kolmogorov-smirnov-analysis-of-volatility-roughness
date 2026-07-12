/**
 * @fileoverview Microstructure-noise correction utilities for RK-SAVR.
 *
 * Implements three practical denoisers commonly applied to
 * high-frequency financial data:
 *
 * - {@link preavgReturns}: Jacod et al. (2009) pre-averaging returns.
 * - {@link realizedKernel}: Barndorff-Nielsen et al. (2008) realized
 *   kernel with optional kernel choice (Bartlett, Parzen, Tukey-Hanning).
 * - {@link logVolDebias}: a small heuristic that nudges raw H estimates
 *   upwards to compensate for noise attenuation of the roughness
 *   measure.
 *
 * These routines are designed to be **offline**; they expect the full
 * price/return series in memory and never stream.
 */

/**
 * Preaveraging of log-returns.
 *
 * Implementation of the Jacod et al. (2009) preaveraging estimator
 * (simplified single-bar variant):
 *
 * 1. Compute log-returns `r_t = log(P_t / P_{t-1})`.
 * 2. For each `i`, average the `windowSize` consecutive returns ending at
 *    `i` (`g_avg[i] = mean(r_{i - windowSize + 1}, ..., r_i)`).
 * 3. The "preaveraged return" is the first-difference sequence
 *    `g_avg[i] - g_avg[i - 1]`. This cancellation attenuates
 *    microstructure noise by `1/sqrt(windowSize)` while preserving the
 *    drift and diffusion up to `O(1 / windowSize)`.
 *
 * Note: the result has length `prices.length - windowSize - 1`; for
 * very short series the function throws rather than returning a few
 * noisy points.
 *
 * @param {Array<number>} prices Price series.
 * @param {number=} windowSize Preaveraging window (default `2`).
 * @return {Array<number>} Preaveraged-returns series.
 * @throws {Error} When `prices` has fewer than `windowSize + 1`
 *   elements.
 */
export function preavgReturns(prices, windowSize = 2) {
  if (!prices || prices.length < windowSize + 1) {
    throw new Error('prices array too short for preaveraging window');
  }

  const n = prices.length;
  const returns = [];
  for (let i = 1; i < n; i++) {
    returns.push(Math.log(prices[i] / prices[i - 1]));
  }

  const avgReturns = [];
  for (let i = 0; i <= returns.length - windowSize; i++) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += returns[i + j];
    }
    avgReturns.push(sum / windowSize);
  }

  // Differences of averaged returns
  const result = [];
  for (let i = 1; i < avgReturns.length; i++) {
    result.push(avgReturns[i] - avgReturns[i - 1]);
  }

  return result;
}

/**
 * Realized-kernel variance estimator with pluggable kernels.
 *
 * Given `n` returns, the estimator forms the autocorrelation sequence
 *
 *     gamma_k = sum_{i=k+1}^{n} r_i * r_{i - k},  k = 0..h
 *
 * and combines them through a weighted sum
 *
 *     RV_K = gamma_0 + 2 * sum_{k=1..h} w_k * gamma_k
 *
 * with weights `w_k` provided by the chosen kernel. The default
 * `bandwidth` is `floor(n^0.6)`, a rule-of-thumb that matches the
 * optimal scaling under i.i.d. microstructure noise.
 *
 * Kernels shipped:
 *
 * - `bartlett`: `w_k = 1 - k / h` (default).
 * - `parzen`: the standard piecewise-cubic Parzen kernel.
 * - `tukey-hanning`: `0.5 (1 + cos(pi k / h))`.
 *
 * Any unknown kernel name falls back to Bartlett.
 *
 * @param {Array<number>} returns Log-return series.
 * @param {string=} kernelType One of `"bartlett"`, `"parzen"`,
 *   `"tukey-hanning"` (default `"bartlett"`).
 * @param {number=} bandwidth Optional explicit bandwidth; defaults to
 *   `floor(n^0.6)`.
 * @return {number} Realized-kernel variance (clamped to be
 *   non-negative).
 * @throws {Error} When `returns` is empty.
 */
export function realizedKernel(
  returns,
  kernelType = 'bartlett',
  bandwidth = null,
) {
  if (!returns || returns.length === 0)
    throw new Error('returns must be non-empty');

  const n = returns.length;
  const h = bandwidth || Math.floor(Math.pow(n, 0.6));
  const gamma = [];

  for (let k = 0; k <= h; k++) {
    let sum = 0;
    for (let i = k; i < n; i++) {
      sum += returns[i] * returns[i - k];
    }
    gamma.push(sum);
  }

  let rv = gamma[0];
  for (let k = 1; k <= h; k++) {
    const w = _kernelWeight(kernelType, k, h);
    rv += 2 * w * gamma[k];
  }

  return Math.max(0, rv);
}

/**
 * Kernel weight function used by {@link realizedKernel}.
 *
 * @private
 * @param {string} type Kernel identifier (`"bartlett"`, `"parzen"`,
 *   `"tukey-hanning"`).
 * @param {number} k Lag index (`k >= 0`).
 * @param {number} h Bandwidth (`h > 0`).
 * @return {number} Weight for the `k`-th autocorrelation lag.
 */
function _kernelWeight(type, k, h) {
  const x = k / h;
  switch (type) {
    case 'bartlett':
      return 1 - x;
    case 'parzen':
      if (x <= 0.5) return 1 - 6 * x * x + 6 * x * x * x;
      return 2 * Math.pow(1 - x, 3);
    case 'tukey-hanning':
      return 0.5 * (1 + Math.cos(Math.PI * x));
    default:
      return 1 - x;
  }
}

/**
 * Heuristic de-biasing of log-volatility H estimates.
 *
 * Microstructure noise inflates the variance of the log-volatility proxy
 * relative to the latent signal, which in turn attenuates the
 * observed roughness. This routine adds a small correction
 *
 *     h_debias = h + 0.01 * log(sigmaObs / sigmaLatent)
 *
 * and clamps the result to `[0.01, 0.99]`. It is intentionally
 * conservative — the user is expected to validate the calibration
 * against a trust sample before relying on it for production.
 *
 * @param {Array<number>} rawHEstimates Raw H estimates from
 *   `RKSAVR.estimate` or `rolling`.
 * @param {number} sigmaObs Standard deviation of the observed log-vol
 *   series.
 * @param {number} sigmaLatent Standard deviation of the latent
 *   (denoised) log-vol series.
 * @return {Array<number>} De-biased H estimates.
 * @throws {Error} When `sigmaLatent <= 0`.
 */
export function logVolDebias(rawHEstimates, sigmaObs, sigmaLatent) {
  if (!rawHEstimates || rawHEstimates.length === 0) return [];
  if (sigmaLatent <= 0) throw new Error('sigmaLatent must be positive');

  const noiseRatio = sigmaObs / sigmaLatent;
  // Heuristic: roughness is attenuated by noise; add small positive correction
  const correction = Math.log(noiseRatio) * 0.01;

  return rawHEstimates.map((h) => {
    const debiased = h + correction;
    return Math.max(0.01, Math.min(0.99, debiased));
  });
}
