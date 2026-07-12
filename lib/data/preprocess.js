/**
 * @fileoverview Preprocessing pipeline for realized volatility and
 * log-transformation matching the RK-SAVR paper's data preparation.
 *
 * The pipeline follows the canonical sequence:
 *
 *   prices -> log-returns -> squared returns -> (optionally)
 *     aggregate within a fixed window -> log-volatility
 *
 * All routines are pure functions: no module-level state, no
 * I/O, no copies of the input array beyond what the algorithm
 * naturally requires.
 */

/**
 * Computes per-bucket realized variance from a price series.
 *
 * The realized variance is the sum of squared log-returns within each
 * non-overlapping bucket of `interval` observations:
 *
 *     RV_k = sum_{i in bucket k} (log P_i - log P_{i-1})^2
 *
 * With `interval = 1` the function emits one RV per log-return
 * directly, which is the canonical "5-minute RV" form when prices are
 * already sampled at 5-minute intervals.
 *
 * @param {Array<number>} prices Chronological price series (strictly
 *   positive, finite).
 * @param {number=} interval Bucket size (default `1`; must be a
 *   positive integer).
 * @return {Array<number>} Realized-variance series.
 * @throws {Error} When `prices` is missing, has fewer than two
 *   elements, contains non-finite or non-positive values, or
 *   `interval` is not a positive integer.
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
 * Parkinson (1980) high-low RV estimator from OHLC bars.
 *
 * For each bar the within-period variance is approximated by
 *
 *     sigma^2 ~= (log(H/L))^2 / (4 * ln 2)
 *
 * which is `1/(4 ln 2) ~ 0.36` of the log-range-squared. Parkinson is
 * strictly less efficient than tick-based RV but only requires four
 * numbers per bar.
 *
 * @param {Array<{open: number, high: number, low: number, close: number}>}
 *   bars OHLC bars.
 * @return {Array<number>} One Parkinson variance estimate per bar.
 * @throws {Error} When `bars` is not an array or any bar has
 *   non-positive/non-finite `high`/`low` values.
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
 * Aggregates intraday (5-minute) realized variances into a single daily
 * value via plain summation.
 *
 * This is the standard "sum of squared returns" daily RV used in
 * financial econometrics. It assumes the input is already free of
 * overnight gaps.
 *
 * @param {Array<number>} intradayRVs Sequence of 5-minute RVs.
 * @return {number} Sum of the intraday RVs (zero for an empty input).
 * @throws {Error} When `intradayRVs` is not an array.
 */
export function aggregateDailyRV(intradayRVs) {
  if (!Array.isArray(intradayRVs))
    throw new Error('intradayRVs must be an array');
  if (intradayRVs.length === 0) return 0;
  return intradayRVs.reduce((a, b) => a + b, 0);
}

/**
 * Maps realized variance to the log-volatility series consumed by
 * RK-SAVR.
 *
 * The transformation is
 *
 *     X_t = 0.5 * log(RV_t)
 *
 * i.e. `log(sqrt(RV))`. This converts multiplicative variance dynamics
 * into a roughly additive (and therefore more stationary) signal, on
 * top of which the self-similarity property exploited by RK-SAVR is
 * expressed.
 *
 * @param {Array<number>} rv Realized-variance series.
 * @return {Array<number>} Log-volatility series.
 * @throws {Error} When `rv` is not an array or contains non-positive
 *   / non-finite values.
 */
export function logTransform(rv) {
  if (!Array.isArray(rv)) throw new Error('rv must be an array');
  if (rv.some((v) => v <= 0 || !Number.isFinite(v))) {
    throw new Error('rv must contain positive finite values');
  }
  return rv.map((v) => 0.5 * Math.log(v));
}

/**
 * Subtracts the arithmetic mean from every element.
 *
 * Useful as a final step in the preprocessing pipeline when the user
 * wants the series to mean-zero (which can stabilize variance-reducing
 * permutations inside `RKSAVR`).
 *
 * @param {Array<number>} series Input series.
 * @return {Array<number>} New array of length `series.length` with the
 *   mean subtracted. Empty input yields `[]`.
 */
export function centerSeries(series) {
  if (!Array.isArray(series) || series.length === 0) return [];
  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  return series.map((v) => v - mean);
}

/**
 * Standardizes a time series to zero mean and unit variance.
 *
 * Divides each centered value by the population standard deviation.
 * A constant series has zero variance and triggers an explicit error
 * rather than silently producing `NaN`s.
 *
 * @param {Array<number>} series Input series (needs at least two
 *   points).
 * @return {Array<number>} Standardized copy of `series`.
 * @throws {Error} When `series` has fewer than two elements or
 *   population variance zero.
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
 * Bundled preprocessing pipeline: `prices -> RV -> log-vol -> (optional)
 * centering`.
 *
 * Equivalent to running {@link computeRV} + {@link logTransform} +
 * (optionally) {@link centerSeries}, but more compact for callers who
 * want the canonical transformation.
 *
 * @param {Array<number>} prices Chronological price series.
 * @param {Object} opts Pipeline options.
 * @param {number=} opts.interval RV aggregation interval (default `1`).
 * @param {boolean=} opts.center When `true`, subtract the mean from the
 *   log-volatility series at the end (default `false`).
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
 * Splits a series into contiguous training and test arrays.
 *
 * The split point is `floor(series.length * trainRatio)` so the training
 * set is the leftmost prefix of the series; this preserves temporal
 * ordering, which is what RK-SAVR forecasters and validation scripts
 * typically need.
 *
 * @param {Array<number>} series Input series.
 * @param {number=} trainRatio Training fraction in `(0, 1)` (default
 *   `0.8`).
 * @return {{train: Array<number>, test: Array<number>}} Train/test
 *   arrays.
 * @throws {Error} When `series` is not an array or `trainRatio` is out
 *   of range.
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
 * Builds overlapping windows from a single time series.
 *
 * The i-th window is `series.slice(i, i + windowSize)` for `i = 0, step,
 * 2*step, ...` until no full window fits. Used by offline batch
 * evaluation pipelines that want to score the estimator on every
 * available segment of the series.
 *
 * @param {Array<number>} series Input series.
 * @param {number} windowSize Window length (positive integer).
 * @param {number=} step Stride between consecutive windows (default
 *   `1`).
 * @return {Array<Array<number>>} One entry per non-truncated window.
 * @throws {Error} When `series` is not an array or `windowSize`/`step`
 *   are non-positive.
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
