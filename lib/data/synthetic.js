/**
 * @fileoverview Synthetic data generators for volatility experiments.
 *
 * The generators here produce *ground-truth* log-volatility series with a
 * configurable Hurst parameter. Two flavours mimic stylized VIX- and
 * SPX-RV-like dynamics; a third generator produces intraday price paths
 * for realized-variance pipelines.
 *
 * When `opts.seed` is provided the PRNG is temporarily seeded so the
 * series is reproducible; the previous global seed is restored when the
 * generator returns.
 */

import {generateFBM} from '../random.js';
import {setSeed, resetSeed, random} from '../prng.js';

/**
 * Synthetic VIX-style daily log-volatility.
 *
 * Generates an fBM with the requested `h` and maps it to a log-volatility
 * level around `2.0` (i.e. `sqrt(RV) ~ 20%`) by adding a small drift
 * term and Gaussian observation noise:
 *
 *     X_t = 2.0 + drift * (fbm[t] / sqrt(n)) + 0.5 * fbm[t] + noise
 *
 * Default tuning matches the empirical VIX roughness (`h ~ 0.1`) and
 * annualized log-vol mean.
 *
 * @param {number} nDays Number of trading days.
 * @param {number} h Hurst parameter (default `0.1`).
 * @param {Object} opts Generation options.
 * @param {number=} opts.seed PRNG seed for reproducibility.
 * @param {number=} opts.noiseStd Observation-noise standard deviation
 *   (default `0.05`).
 * @param {number=} opts.drift Log-volatility drift (default `0.02`).
 * @return {Array<number>} Daily log-volatility series. Empty when
 *   `nDays <= 0`.
 * @throws {Error} When `h` is out of `(0, 1)`.
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
 * Synthetic S&P 500 realized-volatility style daily log-volatility.
 *
 * Same construction as {@link generateVIXLogVol} but with a smoother
 * default Hurst (`h = 0.14`), a smaller drift, and a less volatile
 * observation-noise level. Empirically these choices match the rough
 * regime typically reported for SPX RV.
 *
 * @param {number} nDays Number of trading days.
 * @param {number} h Hurst parameter (default `0.14`).
 * @param {Object} opts Generation options.
 * @param {number=} opts.seed PRNG seed.
 * @param {number=} opts.noiseStd Observation-noise standard deviation
 *   (default `0.03`).
 * @param {number=} opts.drift Log-volatility drift (default `0.015`).
 * @return {Array<number>} Daily log-volatility series. Empty when
 *   `nDays <= 0`.
 * @throws {Error} When `h` is out of `(0, 1)`.
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
 * Generates synthetic intraday 5-minute prices useful for testing
 * realized-variance pipelines.
 *
 * For every (re-)sampled day the generator draws an fBM with the
 * requested `h`, exponentiates it into a volatility factor, and steps a
 * log-return process
 *
 *     S_{i+1} = S_i * exp(drift + vol_i * z_i * sqrt(dt))
 *
 * with `drift` set to the per-5-minute-bar annualized drift. The result
 * is a `nDays` x `nIntraday` array of prices suitable for feeding into
 * {@link computeRV}.
 *
 * @param {number=} nIntraday Number of 5-minute bars per day
 *   (default `78`, the typical US-equities count).
 * @param {number=} nDays Number of days to simulate (default `1`).
 * @param {number} h Hurst parameter.
 * @param {Object} opts Generation options.
 * @param {number=} opts.seed PRNG seed for reproducibility.
 * @param {number=} opts.drift Annualized drift (default `0.05`).
 * @return {Array<Array<number>>} Array of daily price arrays.
 * @throws {Error} When `nIntraday <= 0`, `nDays <= 0`, or `h` is out of
 *   `(0, 1)`.
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
 * Serializes a `{date, value}` series as a CSV string.
 *
 * Dates that are `Date` instances are formatted as their ISO yyyy-mm-dd
 * prefix; everything else is stringified verbatim. Empty series
 * produces a header-only CSV.
 *
 * @param {Array<Object>} series Time series with `date` and `value`
 *   fields.
 * @param {string=} dateHeader Header for the date column (default
 *   `"date"`).
 * @param {string=} valueHeader Header for the value column (default
 *   `"value"`).
 * @return {string} CSV-encoded content joined with `\n`.
 * @throws {Error} When `series` is not an array.
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
