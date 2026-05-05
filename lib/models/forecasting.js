/**
 * H-Forecasting module for predicting future volatility roughness.
 * Includes ARFIMA models and simple neural network approaches.
 *
 * Google JS Style Guide compliant.
 */

/**
 * ARFIMA(p, d, q) model for fractional differencing.
 *
 * The ARFIMA model combines autoregressive (AR) and moving average (MA)
 * terms with fractional differencing (d) to capture long-memory processes.
 *
 * @param {Object} opts Model parameters.
 * @param {number} opts.p AR order.
 * @param {number} opts.d Differencing parameter (fractional).
 * @param {number} opts.q MA order.
 * @param {number} opts.window Window size for rolling forecasts.
 * @return {function(Array<number>): number} Forecasting function.
 */
export function arfima(opts = {}) {
  const p = opts.p || 1;
  const d = opts.d || 0.3;
  const q = opts.q || 1;
  const windowSize = opts.window || 100;

  return function forecast(hHistory) {
    const n = hHistory.length;
    if (n < windowSize) {
      return hHistory.reduce((a, b) => a + b, 0) / n;
    }

    const recent = hHistory.slice(n - windowSize);
    const diffSeries = fractionalDifference(recent, d);
    const diffLen = diffSeries.length;

    let prediction = 0;

    // AR component
    for (let i = 0; i < Math.min(p, 3); i++) {
      const idx = diffLen - 1 - i;
      if (idx >= 0 && idx < diffLen) {
        prediction += 0.3 * diffSeries[idx];
      }
    }

    // MA component (simple lag-based)
    for (let i = 0; i < Math.min(q, 3); i++) {
      const idx = diffLen - 1 - i;
      if (idx >= 0 && idx < diffLen) {
        prediction += 0.1 * (recent[idx] - prediction);
      }
    }

    return Math.max(0.01, Math.min(0.99, prediction));
  };
}

/**
 * Computes fractional difference of a series.
 * (1-L)^d X_t = sum_{k=0}^{infty} binomial(d, k) (-1)^k X_{t-k}
 *
 * @param {Array<number>} data Input series.
 * @param {number} d Differencing parameter.
 * @param {number} lag Maximum lag for approximation.
 * @return {Array<number>} Fractionally differenced series.
 */
const _binomialCache = new Map();
const _binomialCacheKeys = [];
const MAX_BINOMIAL_CACHE = 100;

function getBinomialCoeffs(d, lag) {
  const key = `${d}:${lag}`;
  let coeffs = _binomialCache.get(key);
  if (!coeffs) {
    coeffs = new Float64Array(lag + 1);
    coeffs[0] = 1;
    for (let k = 1; k <= lag; k++) {
      coeffs[k] = coeffs[k - 1] * (d - k + 1) / k;
    }
    if (_binomialCache.size >= MAX_BINOMIAL_CACHE && _binomialCacheKeys.length > 0) {
      const oldest = _binomialCacheKeys.shift();
      _binomialCache.delete(oldest);
    }
    _binomialCache.set(key, coeffs);
    _binomialCacheKeys.push(key);
  }
  return coeffs;
}

function fractionalDifference(data, d, lag = 50) {
  const n = data.length;
  const result = new Array(n);

  // Precompute binomial coefficients (cached for repeated calls)
  const coeffs = getBinomialCoeffs(d, lag);

  for (let t = 0; t < n; t++) {
    let sum = 0;
    let sign = 1;
    for (let k = 0; k <= Math.min(t, lag); k++) {
      sum += sign * coeffs[k] * data[t - k];
      sign = -sign;
    }
    result[t] = sum;
  }

  return result;
}

