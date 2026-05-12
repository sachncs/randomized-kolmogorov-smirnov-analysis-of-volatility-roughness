/**
 * Synthetic data generators for VIX and S&P 500 style experiments.
 * Produces realistic-looking volatility data with known roughness properties.
 */

import {generateFBM} from '../random.js';
import {setSeed, resetSeed, random} from '../prng.js';

/**
 * Generates synthetic VIX-style daily log-volatility.
 * Uses fractional Brownian motion with H ~ 0.1 and realistic drift/noise.
 * This ensures the generated series has the exact target Hurst parameter
 * for estimator validation.
 *
 * @param {number} nDays Number of trading days.
 * @param {number} h Hurst parameter (default 0.1 for VIX).
 * @param {Object} opts Options.
 * @param {number} opts.seed PRNG seed for reproducibility.
 * @param {number} opts.noiseStd Observation noise standard deviation.
 * @param {number} opts.drift Log-volatility drift.
 * @return {Array<number>} Daily log-volatility series.
 */
export function generateVIXLogVol(nDays, h = 0.1, opts = {}) {
  if (nDays <= 0) return [];
  if (h <= 0 || h >= 1) throw new Error('h must be in (0, 1)');

  if (opts.seed !== undefined) setSeed(opts.seed);

  const fbm = generateFBM(nDays, h);
  const noiseStd = opts.noiseStd || 0.05;
  const drift = opts.drift || 0.02;

  // VIX log-vol: mean ~ 2.0 (vol ~ 20%), with rough fBM component
  const logVol = fbm.map((v) => {
    const noise = (random() * 2 - 1) * noiseStd;
    return 2.0 + drift * (v / Math.sqrt(nDays)) + v * 0.5 + noise;
  });

  if (opts.seed !== undefined) resetSeed();
  return logVol;
}

/**
 * Generates synthetic S&P 500 realized volatility style data.
 * Uses fractional Brownian motion with H ~ 0.14 (empirical estimate from paper).
 *
 * @param {number} nDays Number of trading days.
 * @param {number} h Hurst parameter (default 0.14 for SPX RV).
 * @param {Object} opts Options.
 * @param {number} opts.seed PRNG seed.
 * @param {number} opts.noiseStd Observation noise.
 * @param {number} opts.drift Log-volatility drift.
 * @return {Array<number>} Daily log-volatility series.
 */
export function generateSPXLogVol(nDays, h = 0.14, opts = {}) {
  if (nDays <= 0) return [];
  if (h <= 0 || h >= 1) throw new Error('h must be in (0, 1)');

  if (opts.seed !== undefined) setSeed(opts.seed);

  const fbm = generateFBM(nDays, h);
  const noiseStd = opts.noiseStd || 0.03;
  const drift = opts.drift || 0.015;

  // SPX log-vol: mean ~ 1.5 (vol ~ 15%), slightly smoother than VIX
  const logVol = fbm.map((v) => {
    const noise = (random() * 2 - 1) * noiseStd;
    return 1.5 + drift * (v / Math.sqrt(nDays)) + v * 0.4 + noise;
  });

  if (opts.seed !== undefined) resetSeed();
  return logVol;
}

/**
 * Generates synthetic intraday 5-minute prices for RV computation testing.
 * Uses a simple rough volatility + Brownian motion model.
 *
 * @param {number} nIntraday Number of 5-minute intervals per day (default 78 for US equities).
 * @param {number} nDays Number of trading days.
 * @param {number} h Hurst parameter.
 * @param {Object} opts Options.
 * @param {number} opts.seed PRNG seed.
 * @param {number} opts.drift Annualized drift.
 * @return {Array<Array<number>>} Array of daily price arrays.
 */
export function generateIntradayPrices(
  nIntraday = 78,
  nDays = 1,
  h = 0.1,
  opts = {},
) {
  if (nIntraday <= 0 || nDays <= 0) return [];
  if (h <= 0 || h >= 1) throw new Error('h must be in (0, 1)');

  if (opts.seed !== undefined) setSeed(opts.seed);

  const dt = 1 / (252 * nIntraday); // Daily fraction per 5-min bar
  const drift = (opts.drift || 0.05) * dt;
  const days = [];

  for (let d = 0; d < nDays; d++) {
    const fbm = generateFBM(nIntraday, h);
    const prices = [100]; // Start price
    for (let i = 1; i < nIntraday; i++) {
      const vol = Math.exp(fbm[i] * 0.5);
      const ret = drift + vol * (random() * 2 - 1) * Math.sqrt(dt);
      prices.push(prices[i - 1] * Math.exp(ret));
    }
    days.push(prices);
  }

  if (opts.seed !== undefined) resetSeed();
  return days;
}

/**
 * Exports a series as CSV string.
 *
 * @param {Array<Object>} series Time series with date and value fields.
 * @param {string} dateHeader Header for date column.
 * @param {string} valueHeader Header for value column.
 * @return {string} CSV string.
 */
export function seriesToCSV(
  series,
  dateHeader = 'date',
  valueHeader = 'value',
) {
  if (!Array.isArray(series)) throw new Error('series must be an array');
  const lines = [`${dateHeader},${valueHeader}`];
  for (const point of series) {
    const dateStr =
      point.date instanceof Date
        ? point.date.toISOString().split('T')[0]
        : String(point.date);
    lines.push(`${dateStr},${point.value}`);
  }
  return lines.join('\n');
}
