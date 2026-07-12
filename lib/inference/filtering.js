/**
 * @fileoverview Filtering utilities for H(t) series.
 *
 * Provides:
 *
 * - `kalmanFilter`: a one-dimensional Kalman filter that smooths a series
 *   of `H` estimates under a simple random-walk state-space model.
 * - `constancyTest`: a likelihood-ratio test of whether `H` is constant
 *   over time (`q = 0`) against the alternative that it varies (`q > 0`).
 *
 * The state-space model assumed throughout is
 *
 *     x_t = x_{t-1} + w_t,  w_t ~ N(0, q)
 *     z_t = x_t + v_t,      v_t ~ N(0, r)
 *
 * where `x_t` is the latent Hurst exponent at time `t` and `z_t` is the
 * estimated value. The process-noise variance `q` and the observation-
 * noise variance `r` are user-specified.
 */

/**
 * One-dimensional Kalman filter for H(t) smoothing.
 *
 * State: `x_t = H_t`. Transition: `H_t = H_{t-1} + w_t`, `w_t ~ N(0, q)`.
 * Observation: `z_t = H_t + v_t`, `v_t ~ N(0, r)`.
 *
 * The filter is seeded with the first observation (`x_0 = z_0`) and a
 * unit prior covariance. Each subsequent step performs:
 *
 * 1. **Predict:** `xPred = x`, `pPred = p + q`.
 * 2. **Update:** `K = pPred / (pPred + r)`, `x = xPred + K * (z - xPred)`,
 *    `p = (1 - K) * pPred`.
 *
 * The result captures both the one-step-ahead predictions (before
 * incorporating the observation) and the filtered states (after).
 *
 * @param {Array<number>} observations Time-ordered `H` estimates.
 * @param {Object} opts Filter options.
 * @param {number=} opts.q Process noise variance (default `0.01`).
 * @param {number=} opts.r Measurement noise variance (default `0.1`).
 * @return {{filtered: Array<number>, predictions: Array<number>}}
 *   Filtered and one-step-predicted states, each of length `n`.
 */
export function kalmanFilter(observations, opts = {}) {
  const q = opts.q || 0.01;
  const r = opts.r || 0.1;

  const n = observations.length;
  const filtered = new Array(n);
  const predictions = new Array(n);

  let x = observations[0];
  let p = 1.0;

  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const xPred = x;
      const pPred = p + q;
      predictions[i] = xPred;

      const z = observations[i];
      const k = pPred / (pPred + r);
      x = xPred + k * (z - xPred);
      p = (1 - k) * pPred;
    } else {
      predictions[i] = x;
    }
    filtered[i] = x;
  }

  return {filtered, predictions};
}

/**
 * Constancy test for `H(t)` based on a Kalman-filter likelihood ratio.
 *
 * Tests the null hypothesis `H0: q = 0` (constant Hurst exponent) against
 * the alternative `H1: q > 0` (time-varying). Both branches run the same
 * 1D Kalman filter; the test statistic is the likelihood-ratio
 *
 *     LR = 2 * (ll(q = q1) - ll(q = 0))
 *
 * which, under `H0`, is asymptotically `chi-squared` with one degree of
 * freedom. The p-value is computed via the standard survival-function
 * identity `P(chi2_1 > x) = 2 * (1 - Phi(sqrt(x)))`.
 *
 * Notes:
 *
 * - The constant-vs-time-varying decision uses a fixed `alpha = 0.05`
 *   cut-off on `pValue`.
 * - The test is most powerful when `n` is large and `q1` is well-chosen;
 *   in practice, sweep over a grid of `q1` values for robustness.
 *
 * @param {Array<number>} observations Time-ordered `H` estimates.
 * @param {Object} opts Filter options.
 * @param {number=} opts.q Process-noise variance under `H1` (default
 *   `0.01`).
 * @param {number=} opts.r Measurement-noise variance (default `0.1`).
 * @return {{lrStat: number, pValue: number, constant: boolean}} Test
 *   bundle; `constant = true` when the null is **not** rejected at the
 *   5% level.
 */
export function constancyTest(observations, opts = {}) {
  const q1 = opts.q || 0.01;
  const r = opts.r || 0.1;

  // Log-likelihood under q > 0 (time-varying)
  const ll1 = _kalmanLogLikelihood(observations, q1, r);

  // Log-likelihood under q = 0 (constant)
  const ll0 = _kalmanLogLikelihood(observations, 0, r);

  const lrStat = 2 * (ll1 - ll0);
  // Under H0, LR ~ chi-square(1)
  // p-value using approximation: P(chi2_1 > x) = 2 * (1 - Phi(sqrt(x)))
  const pValue = 2 * (1 - _normalCdf(Math.sqrt(Math.max(0, lrStat))));
  const constant = pValue > 0.05;

  return {lrStat, pValue, constant};
}

/**
 * Log-likelihood of the observations under a 1D Kalman filter.
 *
 * Each time-step contributes `log N(innovation; 0, pPred + r)` to the
 * total log-likelihood. For `t = 0` there is no innovation, so we log the
 * marginal density of `z_0` under `N(x_0, r)`.
 *
 * @private
 * @param {Array<number>} observations Time-ordered `H` estimates.
 * @param {number} q Process-noise variance.
 * @param {number} r Measurement-noise variance.
 * @return {number} Total log-likelihood (or `-Infinity` for empty input).
 */
function _kalmanLogLikelihood(observations, q, r) {
  const n = observations.length;
  if (n === 0) return -Infinity;

  let x = observations[0];
  let p = 1.0;
  let logLikelihood = 0;

  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const xPred = x;
      const pPred = p + q;
      const z = observations[i];
      const innovation = z - xPred;
      const innovationVar = pPred + r;
      logLikelihood +=
        -0.5 *
        (Math.log(2 * Math.PI * innovationVar) +
          (innovation * innovation) / innovationVar);
      const k = pPred / innovationVar;
      x = xPred + k * innovation;
      p = (1 - k) * pPred;
    } else {
      logLikelihood += -0.5 * Math.log(2 * Math.PI * r);
    }
  }

  return logLikelihood;
}

/**
 * Standard normal CDF via the Abramowitz & Stegun rational
 * approximation. Error is bounded at `~7.5e-8` over the whole real line.
 *
 * @private
 * @param {number} x Input value (any real number).
 * @return {number} `P(Z <= x)` for `Z ~ N(0, 1)`, in `[0, 1]`.
 */
function _normalCdf(x) {
  // Abramowitz and Stegun 7.1.26 — accurate to ~7.5e-8.
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}
