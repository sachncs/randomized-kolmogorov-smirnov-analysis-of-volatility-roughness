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
