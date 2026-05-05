/**
 * Normal distribution math utilities.
 * @private
 */

/**
 * Coefficients for rational approximation of inverse standard normal CDF.
 * @private @const
 */
const NORMAL_QUANTILE_COEFFS = {
  a: [
    -3.969683028665376e+01,
    2.209460984245205e+02,
    -2.759285104469687e+02,
    1.383577518672690e+02,
    -3.066479806614716e+01,
    2.506628277459239e+00,
  ],
  b: [
    -5.447609879822406e+01,
    1.615858368580409e+02,
    -1.556989798598866e+02,
    6.680131188771972e+01,
    -1.328068155288572e+01,
  ],
  c: [
    -7.784894002430293e-03,
    -3.223967580011372e-01,
    -2.400758277161838e+00,
    -2.549732539343734e+00,
    4.374664141464968e+00,
    2.938163982698783e+00,
  ],
  d: [
    7.784695709041462e-03,
    3.224671290700398e-01,
    2.445134137142996e+00,
    3.754408661907416e+00,
  ],
  pLow: 0.02425,
};

/**
 * Inverse standard normal CDF (quantile function).
 * @param {number} p Probability.
 * @return {number} Quantile.
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
    r = q - (((c[0] * q + c[1]) * q + c[2]) * q + c[3]) /
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
    r = q - (((c[0] * q + c[1]) * q + c[2]) * q + c[3]) /
        (((d[0] * q + d[1]) * q + d[2]) * q + d[3]);
  }

  return r;
}
