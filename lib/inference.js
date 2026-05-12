/**
 * Statistical inference for RK-SAVR.
 * Re-exports from focused submodules for backward compatibility.
 */

import {random} from './prng.js';

export {
  asymptoticVariance,
  standardError,
  confidenceInterval,
} from './inference/asymptotic.js';

export {kalmanFilter, constancyTest} from './inference/filtering.js';

/**
 * Computes the asymptotic critical value for the two-sample KS test.
 * D_alpha = sqrt(-0.5 * ln(alpha/2)) * sqrt((n+m)/(n*m))
 *
 * @param {number} n Sample size 1.
 * @param {number} m Sample size 2.
 * @param {number} alpha Significance level (default 0.05).
 * @return {number} Critical value.
 */
export function ksCriticalValue(n, m, alpha = 0.05) {
  if (n <= 0 || m <= 0) throw new Error('Sample sizes must be positive');
  if (alpha <= 0 || alpha >= 1) throw new Error('alpha must be in (0,1)');
  const factor = Math.sqrt(-0.5 * Math.log(alpha / 2));
  const nmFactor = Math.sqrt((n + m) / (n * m));
  return factor * nmFactor;
}

/**
 * Approximate p-value for the two-sample KS statistic D.
 * Uses the asymptotic Kolmogorov distribution approximation.
 *
 * @param {number} D Observed KS distance.
 * @param {number} n Sample size 1.
 * @param {number} m Sample size 2.
 * @return {number} Approximate p-value.
 */
export function ksPvalue(D, n, m) {
  if (D < 0) return 1;
  const nm = (n * m) / (n + m);
  const lambda = (Math.sqrt(nm) + 0.12 + 0.11 / Math.sqrt(nm)) * D;
  // Asymptotic survival function: Q(lambda) = 2 * sum_{j=1}^{inf} (-1)^{j-1} exp(-2 j^2 lambda^2)
  // Truncated to first 3 terms for numerical stability
  let sum = 0;
  for (let j = 1; j <= 3; j++) {
    const sign = j % 2 === 1 ? 1 : -1;
    sum += sign * Math.exp(-2 * j * j * lambda * lambda);
  }
  return Math.max(0, Math.min(1, 2 * sum));
}

/**
 * Significance test for the minimized KS distance after H estimation.
 * Compares the minimized KS statistic D against the asymptotic critical value.
 *
 * @param {number} D Minimized KS distance from the estimator.
 * @param {number} n Sample size at scale A1.
 * @param {number} m Sample size at scale A2.
 * @param {number} alpha Significance level (default 0.05).
 * @return {{significant: boolean, pValue: number, D: number, criticalValue: number}} Test result.
 */
export function significanceTest(D, n, m, alpha = 0.05) {
  if (!Number.isFinite(D) || D < 0)
    throw new Error('D must be a non-negative finite number');
  const criticalValue = ksCriticalValue(n, m, alpha);
  const pValue = ksPvalue(D, n, m);
  return {
    significant: pValue < alpha,
    pValue,
    D,
    criticalValue,
  };
}

/**
 * CUSUM test for detecting structural breaks in H(t) series.
 *
 * @param {Array<number>} hHistory Array of H estimates.
 * @param {number} targetH Target H under null hypothesis.
 * @param {number} threshold Threshold for alarm (default 3.0).
 * @return {{breakDetected: boolean, maxCusum: number, breakIndex: number}} Result.
 */
export function cusumTest(hHistory, targetH, threshold = 3.0) {
  const n = hHistory.length;
  if (n === 0) throw new Error('hHistory must be non-empty');

  const residuals = hHistory.map((h) => h - targetH);
  const meanRes = residuals.reduce((a, b) => a + b, 0) / n;
  const stdRes = Math.sqrt(
    residuals.map((r) => (r - meanRes) ** 2).reduce((a, b) => a + b, 0) / n,
  );

  if (stdRes === 0) {
    return {breakDetected: false, maxCusum: 0, breakIndex: -1};
  }

  const standardized = residuals.map((r) => (r - meanRes) / stdRes);
  let cusum = 0;
  let maxCusum = 0;
  let breakIndex = -1;

  for (let i = 0; i < n; i++) {
    cusum += standardized[i];
    cusum = Math.max(0, cusum);
    if (cusum > maxCusum) {
      maxCusum = cusum;
      breakIndex = i;
    }
  }

  return {
    breakDetected: maxCusum > threshold,
    maxCusum,
    breakIndex,
  };
}

/**
 * Detects breakpoints in a time series of H estimates using
 * a sliding window CUSUM approach.
 *
 * @param {Array<number>} hHistory Array of H estimates.
 * @param {number} windowSize Sliding window size.
 * @param {number} threshold CUSUM threshold.
 * @return {Array<{index: number, H_before: number, H_after: number}>} Detected breakpoints.
 */
export function detectBreakpoints(hHistory, windowSize = 50, threshold = 3.0) {
  const breakpoints = [];
  for (let i = windowSize; i < hHistory.length - windowSize; i++) {
    const before = hHistory.slice(i - windowSize, i);
    const after = hHistory.slice(i, i + windowSize);
    const meanBefore = before.reduce((a, b) => a + b, 0) / before.length;
    const meanAfter = after.reduce((a, b) => a + b, 0) / after.length;
    const stdBefore = Math.sqrt(
      before.map((x) => (x - meanBefore) ** 2).reduce((a, b) => a + b, 0) /
        before.length,
    );

    if (stdBefore === 0) continue;

    const cusumResult = cusumTest(after, meanBefore, threshold);
    if (cusumResult.breakDetected) {
      breakpoints.push({
        index: i,
        H_before: meanBefore,
        H_after: meanAfter,
      });
    }
  }
  return breakpoints;
}

/**
 * Bootstrap confidence interval for H estimate.
 *
 * @param {function(Array<number>): number} estimator Function that estimates H from a window.
 * @param {Array<number>} window Data window.
 * @param {number} nBoot Number of bootstrap samples.
 * @param {number} alpha Significance level.
 * @return {{lower: number, upper: number, pointEstimate: number}} CI.
 */
export function bootstrapCI(estimator, window, nBoot = 1000, alpha = 0.05) {
  if (!window || window.length === 0)
    throw new Error('window must be non-empty');
  const pointEstimate = estimator(window);
  const bootEstimates = [];

  for (let b = 0; b < nBoot; b++) {
    // Resample with replacement
    const sample = [];
    for (let i = 0; i < window.length; i++) {
      const idx = Math.floor(random() * window.length);
      sample.push(window[idx]);
    }
    try {
      bootEstimates.push(estimator(sample));
    } catch (_err) {
      // Skip failed bootstrap iterations
    }
  }

  bootEstimates.sort((a, b) => a - b);
  const lowerIdx = Math.floor((alpha / 2) * bootEstimates.length);
  const upperIdx = Math.floor((1 - alpha / 2) * bootEstimates.length);

  return {
    lower: bootEstimates[lowerIdx] || pointEstimate,
    upper: bootEstimates[upperIdx] || pointEstimate,
    pointEstimate,
  };
}
