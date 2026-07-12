/**
 * @fileoverview Math helpers backing the inference layer.
 *
 * Provides an internal `normalQuantile` (inverse standard-normal CDF)
 * implemented with the Wichura/Beasley-Springer-Malkin rational
 * approximation. Used by `confidenceInterval` to convert the configured
 * alpha into a two-sided `z` critical value.
 *
 * This module is `@private` — it is consumed only by sibling inference
 * modules and is not re-exported from `inference.js`.
 */

/**
 * Coefficients for the Beasley-Springer-Malkin rational approximation of
 * the inverse standard normal CDF. Used piecewise for `p in [pLow, 1 -
 * pLow]` (central region) and tail rational functions for the extremes.
 *
 * The standard deviation may be `c/d` constants at the tails is adapted
 * from Peter Acklam's algorithm.
 *
 * @private
 * @const
 */
const NORMAL_QUANTILE_COEFFS = {
  a: [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ],
  b: [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ],
  c: [
    -7.784894002430293e-3, -3.223967580011372e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ],
  d: [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ],
  pLow: 0.02425,
};

/**
 * Inverse standard normal CDF (quantile function).
 *
 * Implementation: piecewise rational approximation due to Beasley &
 * Springer (1977) / Acklam (2010). The central region
 * `p in [pLow, 1 - pLow]` uses a degree-5/4 rational function of
 * `r2 = (p - 0.5)^2`; the tails use a degree-3/3 rational function of
 * `q = sqrt(-2 ln p)` (or `q = sqrt(-2 ln (1 - p))` for the upper tail).
 *
 * - `p <= 0` returns `-Infinity`.
 * - `p >= 1` returns `Infinity`.
 * - `p === 0.5` returns exactly `0`.
 *
 * Numerical accuracy is `~1e-9` across the open interval `(0, 1)`.
 *
 * @param {number} p Probability in `[0, 1]`.
 * @return {number} Quantile `Phi^{-1}(p)`.
 */
export function normalQuantile(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  const {a, b, c, d, pLow} = NORMAL_QUANTILE_COEFFS;
  const pHigh = 1 - pLow;

  let q;
  let r;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    r =
      q -
      (((c[0] * q + c[1]) * q + c[2]) * q + c[3]) /
        (((d[0] * q + d[1]) * q + d[2]) * q + d[3]);
  } else if (p <= pHigh) {
    q = p - 0.5;
    const r2 = q * q;
    const num = a[0] * r2 + a[1];
    const num2 = num * r2 + a[2];
    const num3 = num2 * r2 + a[3];
    const num4 = num3 * r2 + a[4];
    const num5 = num4 * r2 + a[5];
    const numerator = num5 * q;
    const den = b[0] * r2 + b[1];
    const den2 = den * r2 + b[2];
    const den3 = den2 * r2 + b[3];
    const den4 = den3 * r2 + b[4];
    const den5 = den4 * r2 + 1.0;
    r = numerator / den5;
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    r =
      q -
      (((c[0] * q + c[1]) * q + c[2]) * q + c[3]) /
        (((d[0] * q + d[1]) * q + d[2]) * q + d[3]);
  }

  return r;
}
