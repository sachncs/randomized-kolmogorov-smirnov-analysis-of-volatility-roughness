/**
 * Statistical inference for RK-SAVR.
 * Includes asymptotic variance, confidence intervals, Kalman filtering, and CUSUM.
 * Google JS Style Guide compliant.
 */

/**
 * Coefficients for Hartmath approximation of standard normal CDF.
 * @private @const
 */
const NORMAL_CDF_COEFFS = {
  a1: 0.254829592,
  a2: -0.284496736,
  a3: 1.421413741,
  a4: -1.453152027,
  a5: 1.061405429,
  p: 0.3275911,
};

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
 * Computes asymptotic variance based on Proposition 2.9.
 * Var(H_hat) = (2 * pi * e) / (2 * ln(a))^2 * (1/n + 1/m)
 * @param {number} scaleA1 Lower scale.
 * @param {number} scaleA2 Upper scale.
 * @param {number} n Sample size 1.
 * @param {number} m Sample size 2.
 * @return {number} Asymptotic variance.
 */
export function asymptoticVariance(scaleA1, scaleA2, n, m) {
  const lnA = Math.log(scaleA2 / scaleA1);
  if (lnA === 0) return Infinity;
  return (2 * Math.PI * Math.E) / (2 * lnA) ** 2 * (1 / n + 1 / m);
}

/**
 * Computes standard error of H estimate.
 * @param {number} scaleA1 Lower scale.
 * @param {number} scaleA2 Upper scale.
 * @param {number} n Sample size 1.
 * @param {number} m Sample size 2.
 * @return {number} Standard error.
 */
export function standardError(scaleA1, scaleA2, n, m) {
  return Math.sqrt(asymptoticVariance(scaleA1, scaleA2, n, m));
}

/**
 * Constructs confidence interval for H.
 * Uses the asymptotic normality result from Prop 2.9.
 * @param {number} HEstimate Point estimate.
 * @param {number} scaleA1 Lower scale.
 * @param {number} scaleA2 Upper scale.
 * @param {number} n Sample size 1.
 * @param {number} m Sample size 2.
 * @param {number} alpha Significance level (default 0.05).
 * @return {{lower: number, upper: number}} Confidence interval.
 */
export function confidenceInterval(HEstimate, scaleA1, scaleA2, n, m, alpha = 0.05) {
  const se = standardError(scaleA1, scaleA2, n, m);
  // Standard normal critical value for two-sided CI
  const zCrit = normalQuantile(1 - alpha / 2);
  return {
    lower: HEstimate - zCrit * se,
    upper: HEstimate + zCrit * se,
  };
}

/**
 * Bootstrap confidence interval for H.
 * @param {Array<number>} bootstrapDist Bootstrap distribution.
 * @param {number} alpha Significance level.
 * @return {{lower: number, upper: number}} Bootstrap CI.
 */
export function bootstrapCI(bootstrapDist, alpha = 0.05) {
  const sorted = bootstrapDist.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const lowerIdx = Math.floor(n * alpha / 2);
  const upperIdx = Math.floor(n * (1 - alpha / 2));
  return {
    lower: sorted[lowerIdx],
    upper: sorted[upperIdx],
  };
}

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
      // Prediction step
      const xPred = x;
      const pPred = p + q;
      predictions[i] = xPred;

      // Update step
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
 * CUSUM test for detecting structural breaks in H.
 * Cumulative sum of deviations from target.
 * @param {Array<number>} hEstimates Rolling H estimates.
 * @param {number} target Target H value (e.g., 0.5 for H=0.5).
 * @param {number} threshold Detection threshold.
 * @return {Array<{t: number, cusum: number, detected: boolean}>} CUSUM values.
 */
export function cusumTest(hEstimates, target = 0.5, threshold = 3.0) {
  const n = hEstimates.length;
  const result = new Array(n);
  let cusum = 0;

  for (let i = 0; i < n; i++) {
    cusum += hEstimates[i] - target;
    result[i] = {
      t: i,
      cusum,
      detected: Math.abs(cusum) > threshold,
    };
  }

  return result;
}

/**
 * Detects breakpoints in H series using binary segmentation.
 * Minimizes sum of squared errors within segments.
 * @param {Array<number>} hEstimates H estimates over time.
 * @param {Object} opts Options.
 * @param {number} opts.minSegLen Minimum segment length.
 * @param {number} opts.threshold Stopping threshold (change in H).
 * @return {Array<{start: number, end: number, meanH: number}>} Detected segments.
 */
export function detectBreakpoints(hEstimates, opts = {}) {
  const minSegLen = opts.minSegLen || 20;
  const threshold = opts.threshold || 0.05;

  const breakpoints = [];
  let start = 0;
  const n = hEstimates.length;

  while (start < n - minSegLen) {
    let bestBreak = -1;
    let bestCost = Infinity;

    const end = n;

    for (let t = start + minSegLen; t < end - minSegLen; t++) {
      // Compute cost of splitting at t
      let sum1 = 0;
      let sumSq1 = 0;
      let count1 = 0;
      for (let i = start; i < t; i++) {
        sum1 += hEstimates[i];
        sumSq1 += hEstimates[i] * hEstimates[i];
        count1++;
      }
      const var1 = (sumSq1 - sum1 * sum1 / count1) / count1;

      let sum2 = 0;
      let sumSq2 = 0;
      let count2 = 0;
      for (let i = t; i < end; i++) {
        sum2 += hEstimates[i];
        sumSq2 += hEstimates[i] * hEstimates[i];
        count2++;
      }
      const var2 = (sumSq2 - sum2 * sum2 / count2) / count2;

      const cost = var1 * count1 + var2 * count2;
      if (cost < bestCost) {
        bestCost = cost;
        bestBreak = t;
      }
    }

    if (bestBreak === -1 || Math.abs(hEstimates[bestBreak] - hEstimates[start]) < threshold) {
      break;
    }

    let segSum = 0;
    for (let i = start; i < bestBreak; i++) {
      segSum += hEstimates[i];
    }

    breakpoints.push({
      start,
      end: bestBreak,
      meanH: segSum / (bestBreak - start),
    });

    start = bestBreak;
  }

  if (start < n) {
    let segSum = 0;
    for (let i = start; i < n; i++) {
      segSum += hEstimates[i];
    }
    breakpoints.push({
      start,
      end: n,
      meanH: segSum / (n - start),
    });
  }

  return breakpoints;
}

/**
 * Constancy test using running window variance ratio.
 * Tests whether H is constant over time.
 * @param {Array<number>} hEstimates H estimates.
 * @param {number} windowSize Window size for constancy check.
 * @param {number} alpha Significance level.
 * @return {{isConstant: boolean, pValue: number, statistic: number}} Test result.
 */
export function constancyTest(hEstimates, windowSize = 50, alpha = 0.05) {
  const n = hEstimates.length;
  if (n < windowSize * 2) {
    return {isConstant: true, pValue: 1.0, statistic: 0};
  }

  // Compute running variances using Welford's algorithm
  const variances = [];
  for (let i = 0; i <= n - windowSize; i++) {
    let sum = 0;
    let sumSq = 0;
    for (let j = i; j < i + windowSize; j++) {
      sum += hEstimates[j];
      sumSq += hEstimates[j] * hEstimates[j];
    }
    const variance = (sumSq - sum * sum / windowSize) / windowSize;
    variances.push(variance);
  }

  // Overall variance and between-window variance
  const m = variances.length;
  let overallVar = 0;
  for (const v of variances) {
    overallVar += v;
  }
  overallVar /= m;

  let betweenVar = 0;
  for (const v of variances) {
    const diff = v - overallVar;
    betweenVar += diff * diff;
  }
  betweenVar /= m;

  // F-test like statistic
  const statistic = betweenVar / (overallVar + 1e-10);
  const pValue = 1 - normalCDF(statistic);

  return {
    isConstant: pValue > alpha,
    pValue,
    statistic,
  };
}

/**
 * Standard normal CDF using Hartmath approximation.
 * @param {number} x Input.
 * @return {number} Standard normal CDF at x.
 */
function normalCDF(x) {
  const {a1, a2, a3, a4, a5, p} = NORMAL_CDF_COEFFS;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return 0.5 * (1.0 + sign * y);
}

/**
 * Inverse standard normal CDF (quantile function).
 * @param {number} p Probability.
 * @return {number} Quantile.
 */
function normalQuantile(p) {
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
    r = numerator / den4;
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    r = q - (((c[0] * q + c[1]) * q + c[2]) * q + c[3]) /
        (((d[0] * q + d[1]) * q + d[2]) * q + d[3]);
  }

  return r;
}