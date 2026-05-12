/**
 * Filtering utilities for RK-SAVR.
 */

/**
 * Kalman filter for state-space modeling of H(t).
 * Simple 1D Kalman filter for tracking H over time.
 * State: x_t = H_t (Hurst parameter)
 * Transition: H_t = H_{t-1} + w_t, w_t ~ N(0, q)
 * Observation: z_t = H_t + v_t, v_t ~ N(0, r)
 * @param {Array<number>} observations Array of H estimates.
 * @param {Object} opts Filter options.
 * @param {number} opts.q Process noise variance.
 * @param {number} opts.r Measurement noise variance.
 * @return {{filtered: Array<number>, predictions: Array<number>}} Filtered and predicted states.
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
 * Constancy test for H(t) using likelihood ratio on Kalman filter process noise.
 * Tests H0: q = 0 (constant H) vs H1: q > 0 (time-varying H).
 *
 * @param {Array<number>} observations Array of H estimates.
 * @param {Object} opts Filter options.
 * @param {number} opts.q Process noise variance under H1.
 * @param {number} opts.r Measurement noise variance.
 * @return {{lrStat: number, pValue: number, constant: boolean}} Test result.
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
 * Computes log-likelihood of observations under a 1D Kalman filter.
 * @private
 * @param {Array<number>} observations
 * @param {number} q
 * @param {number} r
 * @return {number} Log-likelihood value.
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
 * Standard normal CDF approximation.
 * @private
 * @param {number} x Input value.
 * @return {number} CDF value.
 */
function _normalCdf(x) {
  // Abramowitz and Stegun approximation
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
