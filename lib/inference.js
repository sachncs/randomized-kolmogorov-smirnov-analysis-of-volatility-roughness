/**
 * @fileoverview Statistical inference facade for RK-SAVR.
 *
 * Re-exports the focused submodule APIs and adds two families of utility
 * functions that historically lived alongside the estimator:
 *
 * - Kolmogorov-Smirnov critical value, p-value, and significance test for
 *   the minimized KS distance returned by `RKSAVR.estimateSingle`.
 * - CUSUM-based structural break detection for series of H estimates
 *   (e.g. from `RKSAVR.rolling`).
 * - A bootstrap confidence interval that wraps any user-supplied estimator
 *   and resamples from the original window with replacement.
 *
 * The module depends on the seeded `random()` dispatcher in `prng.js`,
 * so bootstrap samples are reproducible across runs.
 *
 * @see ./inference/asymptotic.js for the analytical-variance / CI helpers.
 * @see ./inference/filtering.js for the Kalman filter and constancy test.
 */

import {random} from './prng.js';

export {
  asymptoticVariance,
  standardError,
  confidenceInterval,
} from './inference/asymptotic.js';

export {kalmanFilter, constancyTest} from './inference/filtering.js';

/**
 * Two-sample Kolmogorov-Smirnov asymptotic critical value.
 *
 * Implements the classical asymptotic formula
 *
 *     D_alpha = sqrt(-0.5 * ln(alpha/2)) * sqrt((n + m) / (n * m))
 *
 * which is `O(1)` in `n, m` and accurate for moderately large samples.
 *
 * @param {number} n First sample size.
 * @param {number} m Second sample size.
 * @param {number} alpha Significance level (default `0.05`).
 * @return {number} Critical value `D_alpha`.
 * @throws {Error} When `n`, `m` are non-positive or `alpha` is outside
 *   the open interval `(0, 1)`.
 */
export function ksCriticalValue(n, m, alpha = 0.05) {
  if (n <= 0 || m <= 0) throw new Error('Sample sizes must be positive');
  if (alpha <= 0 || alpha >= 1) throw new Error('alpha must be in (0,1)');
  const factor = Math.sqrt(-0.5 * Math.log(alpha / 2));
  const nmFactor = Math.sqrt((n + m) / (n * m));
  return factor * nmFactor;
}

/**
 * Approximate two-sample KS p-value via the asymptotic Kolmogorov
 * distribution.
 *
 * Uses the truncated series
 *     Q(lambda) ~ 2 * sum_{j=1..J} (-1)^{j-1} * exp(-2 * j^2 * lambda^2)
 * with `J = 3` terms. The `lambda` correction
 *
 *     lambda = (sqrt(nm) + 0.12 + 0.11 / sqrt(nm)) * D
 *
 * matches the standard asymptotic accuracy improvement recommended by
 * numerical-statistics references.
 *
 * @param {number} D Observed KS distance.
 * @param {number} n First sample size.
 * @param {number} m Second sample size.
 * @return {number} Approximate p-value in `[0, 1]`. Returns `1` when
 *   `D < 0` (defensive guard against invalid negative inputs).
 */
export function ksPvalue(D, n, m) {
  if (D < 0) return 1;
  const nm = (n * m) / (n + m);
  const lambda = (Math.sqrt(nm) + 0.12 + 0.11 / Math.sqrt(nm)) * D;
  let sum = 0;
  for (let j = 1; j <= 3; j++) {
    const sign = j % 2 === 1 ? 1 : -1;
    sum += sign * Math.exp(-2 * j * j * lambda * lambda);
  }
  return Math.max(0, Math.min(1, 2 * sum));
}

/**
 * Significance test for the minimized KS distance returned by the
 * RK-SAVR estimator.
 *
 * Two views are returned:
 *
 * - `pValue` from {@link ksPvalue}, comparable against any `alpha`.
 * - `criticalValue` from {@link ksCriticalValue} at the same `alpha`.
 *
 * Interpretation: under the null of self-similarity at the estimated
 * `H`, the minimized KS distance should be roughly equal to the
 * critical value. A `significant` result means the null is rejected at
 * the chosen `alpha` level — i.e. the rescaled samples do **not**
 * appear identically distributed and the user should treat the
 * estimate with caution.
 *
 * @param {number} D Minimized KS distance from `RKSAVR.estimateSingle`
 *   or `estimateSingleWithDiagnostics`.
 * @param {number} n Sample size at scale `a_1`.
 * @param {number} m Sample size at scale `a_2`.
 * @param {number} alpha Significance level (default `0.05`).
 * @return {{significant: boolean, pValue: number, D: number, criticalValue: number}}
 *   Test result bundle.
 * @throws {Error} When `D` is non-finite or negative.
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
 * Cumulative Sum (CUSUM) test for structural breaks in `H(t)` series.
 *
 * This is a one-sided upper CUSUM on the standardized residuals
 * `r_i = (h_i - targetH) / sigma` (where `sigma` is the empirical
 * standard deviation of the residuals). A break is flagged when the
 * CUSUM exceeds `threshold`. The break index is the point of maximum
 * CUSUM value.
 *
 * When the residual series has zero variance (a degenerate history),
 * returns `breakDetected: false` instead of dividing by zero.
 *
 * @param {Array<number>} hHistory Time-ordered series of `H` estimates.
 * @param {number} targetH Target value of `H` under the null of structural
 *   stability (typically the mean of the series).
 * @param {number} threshold Alarm threshold (default `3.0`).
 * @return {{breakDetected: boolean, maxCusum: number, breakIndex: number}}
 *   Test result; `breakIndex = -1` when no break is detected.
 * @throws {Error} When `hHistory` is empty.
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
 * Detects breakpoints in a series of H estimates via a sliding-window
 * CUSUM.
 *
 * At every index `i` (with sufficient room on either side) two windows of
 * length `windowSize` are compared: `[i - windowSize, i)` and
 * `[i, i + windowSize)`. The "after" window is fed into
 * {@link cusumTest} with the "before" mean as the target. A breakpoint is
 * recorded whenever the CUSUM flags a significant shift at the same
 * `threshold`.
 *
 * Windows whose `before` sample has zero variance are skipped to avoid
 * a divide-by-zero in the standardization step.
 *
 * @param {Array<number>} hHistory Time-ordered series of `H` estimates.
 * @param {number} windowSize Sliding window size (default `50`).
 * @param {number} threshold CUSUM threshold (default `3.0`).
 * @return {Array<{index: number, H_before: number, H_after: number}>}
 *   Detected breakpoints in chronological order; empty if none.
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

    // Defensive: a flat "before" window has no information to standardize
    // against, so skip rather than emit a meaningless breakpoint.
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
 * Nonparametric bootstrap confidence interval for an arbitrary
 * `H` estimator.
 *
 * Procedure:
 *
 * 1. Evaluate the estimator on the full window to obtain `pointEstimate`.
 * 2. Draw `nBoot` IID samples **with replacement** from the window. Each
 *    bootstrap sample has the same length as the original.
 * 3. Run the estimator on each bootstrap sample; failed iterations are
 *    silently discarded.
 * 4. Sort the successful bootstrap estimates and read the
 *    `(alpha/2, 1 - alpha/2)` percentile pair.
 *
 * Notes:
 * - The percentile bounds are returned as `lower`/`upper`. When the
 *   bootstrap set is empty (very small `nBoot` with a fragile estimator)
 *   the bounds collapse to `pointEstimate` so the CI is well-defined.
 *
 * @param {function(Array<number>): number} estimator Function that
 *   returns `H` from a window.
 * @param {Array<number>} window Data window.
 * @param {number} nBoot Bootstrap iterations (default `1000`).
 * @param {number} alpha Significance level (default `0.05`).
 * @return {{lower: number, upper: number, pointEstimate: number}}
 *   Centile bootstrap CI.
 * @throws {Error} When `window` is empty.
 */
export function bootstrapCI(estimator, window, nBoot = 1000, alpha = 0.05) {
  if (!window || window.length === 0)
    throw new Error('window must be non-empty');
  const pointEstimate = estimator(window);
  const bootEstimates = [];

  for (let b = 0; b < nBoot; b++) {
    // Resample with replacement via the seeded `random()` dispatcher.
    const sample = [];
    for (let i = 0; i < window.length; i++) {
      const idx = Math.floor(random() * window.length);
      sample.push(window[idx]);
    }
    try {
      bootEstimates.push(estimator(sample));
    } catch (_err) {
      // Discard failed bootstrap iterations without aborting the whole
      // loop; the centile-based CI degrades gracefully when some
      // iterations fail.
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
