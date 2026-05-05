/**
 * Asymptotic statistical inference for RK-SAVR.
 */

import {normalQuantile} from './math.js';

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
  const zCrit = normalQuantile(1 - alpha / 2);
  return {
    lower: HEstimate - zCrit * se,
    upper: HEstimate + zCrit * se,
  };
}
