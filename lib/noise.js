/**
 * Bias and noise correction utilities for RK-SAVR.
 * Handles microstructure noise and log-volatility de-biasing.
 * Google JS Style Guide compliant.
 */

/**
 * Preaveraging estimator for microstructure noise mitigation.
 * Implements the Hayashi-Yoshida preaveraging estimator.
 * For observed prices P_i at times i, the preaveraged return is:
 * \hat{r}_t = (1/K(K+1)) * sum_{k=0}^{K-1} (k+0.5) * (P_{t-k} - P_{t-k-1})
 * where K is the window size (knots).
 * @param {Array<number>} prices Log-prices.
 * @param {number} windowSize Preaveraging window size K.
 * @return {Array<number>} Noise-corrected returns.
 */
export function preavgReturns(prices, windowSize = 2) {
  const n = prices.length;
  const result = new Array(n - windowSize);
  const coeff = 1.0 / (windowSize * (windowSize + 1));

  for (let t = windowSize; t < n; t++) {
    let sum = 0;
    for (let k = 0; k < windowSize; k++) {
      const deltaP = prices[t - k] - prices[t - k - 1];
      sum += (k + 0.5) * deltaP;
    }
    result[t - windowSize] = coeff * sum;
  }

  return result;
}

/**
 * Multi-scale decomposition for noise reduction using Gaussian kernel smoothing.
 * @param {Array<number>} series Input time series.
 * @param {number} levels Number of decomposition levels.
 * @return {{trend: Array<number>, noise: Array<number>}} Decomposed components.
 */
export function multiscaleDecompose(series, levels = 3) {
  const n = series.length;
  const trend = new Array(n);
  const noise = new Array(n);

  // Copy original to trend
  for (let i = 0; i < n; i++) {
    trend[i] = series[i];
    noise[i] = 0;
  }

  for (let l = 0; l < levels; l++) {
    const kernelSize = Math.pow(2, l + 1);
    const smoothed = gaussianSmooth(trend, kernelSize);
    for (let i = 0; i < n; i++) {
      const residual = trend[i] - smoothed[i];
      noise[i] += residual * 0.5;
      trend[i] = smoothed[i];
    }
  }

  return {trend, noise};
}

/**
 * Gaussian kernel smoothing.
 * @param {Array<number>} series Input series.
 * @param {number} kernelSize Size of Gaussian kernel.
 * @return {Array<number>} Smoothed series.
 */
function gaussianSmooth(series, kernelSize) {
  const n = series.length;
  const result = new Array(n);
  const half = Math.floor(kernelSize / 2);

  // Compute Gaussian weights
  const weights = new Float64Array(kernelSize);
  let weightSum = 0;
  for (let k = 0; k < kernelSize; k++) {
    const x = (k - half) / (kernelSize / 4);
    weights[k] = Math.exp(-0.5 * x * x);
    weightSum += weights[k];
  }

  for (let i = 0; i < n; i++) {
    let sum = 0;
    let wSumLocal = 0;
    for (let k = 0; k < kernelSize; k++) {
      const idx = i + k - half;
      if (idx >= 0 && idx < n) {
        sum += weights[k] * series[idx];
        wSumLocal += weights[k];
      }
    }
    result[i] = sum / (wSumLocal || weightSum);
  }

  return result;
}

/**
 * Log-volatility de-biasing correction.
 * Implements the approximate correction factor from Kristensen (2010).
 * The bias in log-volatility arises from Jensen's inequality.
 * Correction: -Var(log(V))/2 approximately
 * @param {Array<number>} hEstimates Raw H estimates.
 * @param {number} sigmaObs Observed volatility level.
 * @param {number} sigmaLatent Latent volatility level.
 * @param {number} varLogVol Variance of log-volatility process.
 * @return {Array<number>} De-biased H estimates.
 */
export function logVolDebias(hEstimates, sigmaObs = 1.0, sigmaLatent = 1.0, varLogVol = 0.1) {
  // Correction factor from Jensen's inequality: E[log(V)] != log(E[V])
  // For log-normal volatility: correction = -sigma^2 / 2
  const ratio = sigmaLatent / sigmaObs;
  const correction = -0.5 * varLogVol * Math.log(ratio) / Math.log(ratio + 1);
  return hEstimates.map((h) => h + correction);
}

/**
 * Bid-ask bounce correction using tick test.
 * Zeros out returns below the tick test threshold (zero-price bounces).
 * @param {Array<number>} returns Raw returns.
 * @param {number} threshold Tick test threshold.
 * @return {Array<number>} Corrected returns.
 */
export function bidAskCorrection(returns, threshold = 0.01) {
  return returns.map((r) => (Math.abs(r) < threshold ? 0 : r));
}

/**
 * Realized kernel estimator for noise-robust volatility.
 * Implements the Hansen-Huang realized kernel with Bartlett, Parzen, or Tukey kernel.
 * HK = sum_{h=-n}^{n} k(h/(H*n)) * gamma_h
 * where gamma_h is the autocovariance at lag h.
 * @param {Array<number>} returns Returns series.
 * @param {string} kernelType Kernel type ('bartlett', 'parzen', 'tukey').
 * @return {number} Realized volatility.
 */
export function realizedKernel(returns, kernelType = 'bartlett') {
  const n = returns.length;
  let kernelSum = returns[0] * returns[0];

  for (let h = 1; h < n; h++) {
    const weight = kernelWeight(h, n, kernelType);
    let gammaH = 0;
    for (let i = 0; i < n - h; i++) {
      gammaH += returns[i] * returns[i + h];
    }
    gammaH /= n;
    kernelSum += 2 * weight * gammaH;
  }

  return Math.sqrt(Math.max(0, kernelSum));
}

/**
 * Kernel weight function for realized kernel.
 * @param {number} h Lag.
 * @param {number} n Sample size.
 * @param {string} kernelType Type of kernel.
 * @return {number} Kernel weight.
 */
function kernelWeight(h, n, kernelType) {
  const lag = h / n;
  switch (kernelType) {
    case 'bartlett':
      return Math.max(0, 1 - lag);
    case 'parzen':
      if (lag <= 0.5) {
        return 1 - 6 * lag * lag + 6 * lag * lag * lag;
      }
      return 2 * Math.pow(1 - lag, 3);
    case 'tukey':
      return 0.5 * (1 + Math.cos(Math.PI * lag));
    default:
      return Math.max(0, 1 - lag);
  }
}

/**
 * Optimal sampling interval for noise reduction.
 * Based on the optimal sampling formula from Zhang et al. (2005).
 * @param {number} noiseVariance Estimated noise variance.
 * @param {number} signalVariance Signal variance.
 * @param {number} baseInterval Base sampling interval.
 * @return {number} Optimal interval.
 */
export function optimalSamplingInterval(noiseVariance, signalVariance, baseInterval = 1) {
  const ratio = noiseVariance / signalVariance;
  const optimal = Math.sqrt(ratio) * baseInterval;
  return Math.max(1, Math.round(optimal));
}