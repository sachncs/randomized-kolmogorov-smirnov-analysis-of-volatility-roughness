/**
 * @fileoverview Asymptotic-variance-based inference for RK-SAVR.
 *
 * Implements the standard-error and confidence-interval calculations that
 * flow from **Proposition 2.9** in the RK-SAVR paper. The asymptotic
 * variance formula
 *
 *     Var(H_hat) = (2 * pi * e) / (ln a2/a1)^2 * (1/sqrt(n) + 1/sqrt(m))^2
 *
 * assumes an i.i.d. (after block-permutation) sample and Gaussian tails,
 * and is exact up to lower-order terms. As a consequence:
 *
 * - The estimator is consistent at rate `O(1/sqrt(n) + 1/sqrt(m))`.
 * - Doubling the sample sizes halves the asymptotic standard error.
 * - Widening the scale ratio `a2/a1` shrinks the variance quadratically.
 *
 * For guidance on when the asymptotic approximation is appropriate, see
 * the paper's discussion around Proposition 2.9.
 */

import {normalQuantile} from './math.js';

/**
 * Asymptotic variance of the RK-SAVR estimator.
 *
 * Implements
 *
 *     Var(H_hat) = (2 * pi * e) / (ln(a2/a1))^2 * (1/sqrt(n) + 1/sqrt(m))^2.
 *
 * When `a1 == a2` (log ratio zero) the variance is degenerate and the
 * function returns `Infinity` rather than dividing by zero; callers that
 * intend to compute a SE/CI should reject equal scales up-front.
 *
 * @param {number} scaleA1 Lower scale `a_1`.
 * @param {number} scaleA2 Upper scale `a_2`.
 * @param {number} n Sample size at `a_1`.
 * @param {number} m Sample size at `a_2`.
 * @return {number} Non-negative asymptotic variance (`Infinity` if the
 *   scales coincide).
 */
export function asymptoticVariance(scaleA1, scaleA2, n, m) {
  const lnA = Math.log(scaleA2 / scaleA1);
  if (lnA === 0) return Infinity;
  return (
    ((2 * Math.PI * Math.E) / lnA ** 2) *
    (1 / Math.sqrt(n) + 1 / Math.sqrt(m)) ** 2
  );
}

/**
 * Asymptotic standard error: square root of the asymptotic variance.
 *
 * Thin convenience wrapper. The standard error has units of "Hurst" and
 * can be read against the `hMin`/`hMax` bounds the estimator was
 * configured with.
 *
 * @param {number} scaleA1 Lower scale `a_1`.
 * @param {number} scaleA2 Upper scale `a_2`.
 * @param {number} n Sample size at `a_1`.
 * @param {number} m Sample size at `a_2`.
 * @return {number} Non-negative standard error (`Infinity` for degenerate
 *   scale choices).
 */
export function standardError(scaleA1, scaleA2, n, m) {
  return Math.sqrt(asymptoticVariance(scaleA1, scaleA2, n, m));
}

/**
 * Two-sided asymptotic confidence interval for `H`.
 *
 * Combines the asymptotic standard error with the standard-normal
 * critical value `z_{1 - alpha/2}` (computed by the internal
 * `normalQuantile`) to produce
 *
 *     CI = H_hat +/- z * SE.
 *
 * Note: this CI is **not** clipped to `[0, 1]`. For practical reporting
 * users may want to clamp to `[hMin, hMax]`.
 *
 * @param {number} hEstimate Point estimate of `H`.
 * @param {number} scaleA1 Lower scale `a_1`.
 * @param {number} scaleA2 Upper scale `a_2`.
 * @param {number} n Sample size at `a_1`.
 * @param {number} m Sample size at `a_2`.
 * @param {number} alpha Significance level (default `0.05`).
 * @return {{lower: number, upper: number}} Confidence interval bounds.
 */
export function confidenceInterval(
  hEstimate,
  scaleA1,
  scaleA2,
  n,
  m,
  alpha = 0.05,
) {
  const se = standardError(scaleA1, scaleA2, n, m);
  const zCrit = normalQuantile(1 - alpha / 2);
  return {
    lower: hEstimate - zCrit * se,
    upper: hEstimate + zCrit * se,
  };
}
