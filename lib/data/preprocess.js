/**
 * Preprocessing pipeline for realized volatility and log-transformation.
 * Pure JavaScript implementation matching the paper's data preparation.
 */

/**
 * Computes 5-minute realized volatility from intraday log-returns.
 * RV = sum_i (r_i)^2 where r_i = log(P_{t_i}) - log(P_{t_{i-1}})
 *
 * @param {Array<number>} prices Price series (chronological order).
 * @param {number} interval Number of observations per 5-min bucket (default 1 if prices are already 5-min).
 * @return {Array<number>} Realized volatility series.
 */
export function computeRV(prices, interval = 1) {
  if (!Array.isArray(prices)) throw new Error('prices must be an array');
  if (prices.length < 2) throw new Error('prices must have at least 2 points');
  if (prices.some((p) => p <= 0 || !Number.isFinite(p))) {
    throw new Error('prices must be positive finite numbers');
  }
  if (interval <= 0 || !Number.isInteger(interval))
    throw new Error('interval must be a positive integer');

  const logPrices = prices.map((p) => Math.log(p));
  const returns = [];
  for (let i = 1; i < logPrices.length; i++) {
    returns.push(logPrices[i] - logPrices[i - 1]);
  }

  const rv = [];
  for (let i = 0; i < returns.length; i += interval) {
    let sumSq = 0;
    const end = Math.min(i + interval, returns.length);
    for (let j = i; j < end; j++) {
      sumSq += returns[j] * returns[j];
    }
    rv.push(sumSq);
  }

  return rv;
}

/**
 * Computes 5-minute RV from OHLC bars using the Parkinson estimator.
 * More efficient than tick-based RV when only OHLC is available.
 *
 * @param {Array<{open: number, high: number, low: number, close: number}>} bars OHLC bars.
 * @return {Array<number>} RV estimates.
 */
export function computeRVParkinson(bars) {
  if (!Array.isArray(bars)) throw new Error('bars must be an array');
  if (bars.length === 0) return [];

  const rv = [];
  for (const bar of bars) {
    if (
      bar.high <= 0 ||
      bar.low <= 0 ||
      !Number.isFinite(bar.high) ||
      !Number.isFinite(bar.low)
    ) {
      throw new Error('OHLC bars must have positive finite high/low values');
    }
    const hl = Math.log(bar.high / bar.low);
    rv.push((hl * hl) / (4 * Math.log(2)));
  }
  return rv;
}

/**
 * Computes daily realized volatility from intraday 5-minute RVs.
 * Aggregates intraday RVs into a single daily RV figure.
 *
 * @param {Array<number>} intradayRVs Array of 5-minute RVs for one trading day.
 * @return {number} Daily realized volatility.
 */
export function aggregateDailyRV(intradayRVs) {
  if (!Array.isArray(intradayRVs))
    throw new Error('intradayRVs must be an array');
  if (intradayRVs.length === 0) return 0;
  return intradayRVs.reduce((a, b) => a + b, 0);
}

/**
 * Applies log-transformation to a volatility series.
 * The paper uses log-volatility: X_t = log(sqrt(RV_t))
 *
 * @param {Array<number>} rv Realized volatility series.
 * @return {Array<number>} Log-volatility series.
 */
export function logTransform(rv) {
  if (!Array.isArray(rv)) throw new Error('rv must be an array');
  if (rv.some((v) => v <= 0 || !Number.isFinite(v))) {
    throw new Error('rv must contain positive finite values');
  }
  return rv.map((v) => 0.5 * Math.log(v));
}

/**
 * Removes the mean (centers) a time series.
 *
 * @param {Array<number>} series Input series.
 * @return {Array<number>} Centered series.
 */
export function centerSeries(series) {
  if (!Array.isArray(series) || series.length === 0) return [];
  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  return series.map((v) => v - mean);
}

/**
 * Standardizes a time series to zero mean and unit variance.
 *
 * @param {Array<number>} series Input series.
 * @return {Array<number>} Standardized series.
 */
export function standardizeSeries(series) {
  if (!Array.isArray(series) || series.length < 2) {
    throw new Error('series must have at least 2 points');
  }
  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  const variance =
    series.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / series.length;
  if (variance === 0) throw new Error('series has zero variance');
  const std = Math.sqrt(variance);
  return series.map((v) => (v - mean) / std);
}

/**
 * Full preprocessing pipeline: prices -> RV -> log-vol -> center.
 *
 * @param {Array<number>} prices Price series.
 * @param {Object} opts Options.
 * @param {number} opts.interval Aggregation interval.
 * @param {boolean} opts.center Whether to center the series.
 * @return {Array<number>} Preprocessed log-volatility series.
 */
export function preprocessPipeline(prices, opts = {}) {
  const rv = computeRV(prices, opts.interval || 1);
  const logVol = logTransform(rv);
  if (opts.center) {
    return centerSeries(logVol);
  }
  return logVol;
}

/**
 * Splits a series into train/test sets.
 *
 * @param {Array<number>} series Input series.
 * @param {number} trainRatio Proportion for training (default 0.8).
 * @return {{train: Array<number>, test: Array<number>}} Split data.
 */
export function trainTestSplit(series, trainRatio = 0.8) {
  if (!Array.isArray(series)) throw new Error('series must be an array');
  if (trainRatio <= 0 || trainRatio >= 1)
    throw new Error('trainRatio must be in (0, 1)');
  const splitIdx = Math.floor(series.length * trainRatio);
  return {
    train: series.slice(0, splitIdx),
    test: series.slice(splitIdx),
  };
}

/**
 * Creates overlapping windows from a series.
 *
 * @param {Array<number>} series Input series.
 * @param {number} windowSize Window length.
 * @param {number} step Step size.
 * @return {Array<Array<number>>} Array of windows.
 */
export function createWindows(series, windowSize, step = 1) {
  if (!Array.isArray(series)) throw new Error('series must be an array');
  if (windowSize <= 0) throw new Error('windowSize must be positive');
  if (step <= 0) throw new Error('step must be positive');

  const windows = [];
  for (let i = 0; i + windowSize <= series.length; i += step) {
    windows.push(series.slice(i, i + windowSize));
  }
  return windows;
}
