/**
 * Microstructure noise correction utilities for RK-SAVR.
 * Implements preaveraging, realized kernels, and log-volatility de-biasing.
 */

/**
 * Preaveraging of returns to reduce microstructure noise.
 * Computes local averages of returns over a sliding window,
 * then differences these averages to obtain noise-robust returns.
 *
 * @param {Array<number>} prices Price series.
 * @param {number} windowSize Preaveraging window (default 2).
 * @return {Array<number>} Preaveraged returns.
 */
export function preavgReturns(prices, windowSize = 2) {
  if (!prices || prices.length < windowSize + 1) {
    throw new Error('prices array too short for preaveraging window');
  }

  const n = prices.length;
  const returns = [];
  for (let i = 1; i < n; i++) {
    returns.push(Math.log(prices[i] / prices[i - 1]));
  }

  const avgReturns = [];
  for (let i = 0; i <= returns.length - windowSize; i++) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += returns[i + j];
    }
    avgReturns.push(sum / windowSize);
  }

  // Differences of averaged returns
  const result = [];
  for (let i = 1; i < avgReturns.length; i++) {
    result.push(avgReturns[i] - avgReturns[i - 1]);
  }

  return result;
}

/**
 * Realized kernel volatility estimator with Bartlett or other kernels.
 *
 * @param {Array<number>} returns Return series.
 * @param {string} kernelType Kernel type: 'bartlett', 'parzen', 'tukey-hanning'.
 * @param {number} bandwidth Maximum lag (default auto).
 * @return {number} Realized kernel estimate.
 */
export function realizedKernel(
  returns,
  kernelType = 'bartlett',
  bandwidth = null,
) {
  if (!returns || returns.length === 0)
    throw new Error('returns must be non-empty');

  const n = returns.length;
  const h = bandwidth || Math.floor(Math.pow(n, 0.6));
  const gamma = [];

  for (let k = 0; k <= h; k++) {
    let sum = 0;
    for (let i = k; i < n; i++) {
      sum += returns[i] * returns[i - k];
    }
    gamma.push(sum);
  }

  let rv = gamma[0];
  for (let k = 1; k <= h; k++) {
    const w = _kernelWeight(kernelType, k, h);
    rv += 2 * w * gamma[k];
  }

  return Math.max(0, rv);
}

/**
 * Kernel weight function.
 * @private
 * @param {string} type Kernel type.
 * @param {number} k Lag index.
 * @param {number} h Bandwidth.
 * @return {number} Weight value.
 */
function _kernelWeight(type, k, h) {
  const x = k / h;
  switch (type) {
    case 'bartlett':
      return 1 - x;
    case 'parzen':
      if (x <= 0.5) return 1 - 6 * x * x + 6 * x * x * x;
      return 2 * Math.pow(1 - x, 3);
    case 'tukey-hanning':
      return 0.5 * (1 + Math.cos(Math.PI * x));
    default:
      return 1 - x;
  }
}

/**
 * De-biases log-volatility H estimates by correcting for
 * observational noise in the volatility proxy.
 *
 * @param {Array<number>} rawHEstimates Raw H estimates.
 * @param {number} sigmaObs Observed volatility standard deviation.
 * @param {number} sigmaLatent Latent volatility standard deviation.
 * @return {Array<number>} De-biased H estimates.
 */
export function logVolDebias(rawHEstimates, sigmaObs, sigmaLatent) {
  if (!rawHEstimates || rawHEstimates.length === 0) return [];
  if (sigmaLatent <= 0) throw new Error('sigmaLatent must be positive');

  const noiseRatio = sigmaObs / sigmaLatent;
  // Heuristic: roughness is attenuated by noise; add small positive correction
  const correction = Math.log(noiseRatio) * 0.01;

  return rawHEstimates.map((h) => {
    const debiased = h + correction;
    return Math.max(0.01, Math.min(0.99, debiased));
  });
}
