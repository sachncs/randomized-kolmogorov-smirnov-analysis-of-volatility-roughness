/**
 * Statistical utilities for RK-SAVR.
 * Google JS Style Guide compliant.
 */

/**
 * Computes the Kolmogorov-Smirnov distance between two samples.
 * D = sup_x |F_n(x) - G_m(x)| where F_n and G_m are empirical CDFs.
 * Uses the two-sample KS statistic computation.
 * @param {Array<number>|Float64Array} sample1
 * @param {Array<number>|Float64Array} sample2
 * @param {boolean} isSorted Whether the samples are already sorted.
 * @return {number}
 */
export function ksDistance(sample1, sample2, isSorted = false) {
  if (!sample1 || sample1.length === 0 || !sample2 || sample2.length === 0) {
    throw new Error('ksDistance requires non-empty arrays');
  }
  const s1 = isSorted ? sample1 : sample1.slice().sort((a, b) => a - b);
  const s2 = isSorted ? sample2 : sample2.slice().sort((a, b) => a - b);

  const n1 = s1.length;
  const n2 = s2.length;

  let i = 0;
  let j = 0;
  let maxDist = 0;

  while (i < n1 && j < n2) {
    const v1 = s1[i];
    const v2 = s2[j];

    // Compute CDF values at current positions before advancing
    // F_n(x) = (number of elements <= x) / n
    // When values are equal, both advance (tie case)
    if (v1 < v2) {
      // s1[i] is strictly less than s2[j]
      // F_n = (i+1)/n1, G_m = j/n2
      const dist = Math.abs((i + 1) / n1 - j / n2);
      if (dist > maxDist) maxDist = dist;
      i++;
    } else if (v1 > v2) {
      // s2[j] is strictly less than s1[i]
      // F_n = i/n1, G_m = (j+1)/n2
      const dist = Math.abs(i / n1 - (j + 1) / n2);
      if (dist > maxDist) maxDist = dist;
      j++;
    } else {
      // Tie: both values equal
      // F_n = (i+1)/n1, G_m = (j+1)/n2
      const dist = Math.abs((i + 1) / n1 - (j + 1) / n2);
      if (dist > maxDist) maxDist = dist;
      i++;
      j++;
    }
  }

  // Check remaining elements
  while (i < n1) {
    const dist = Math.abs((i + 1) / n1 - j / n2);
    if (dist > maxDist) maxDist = dist;
    i++;
  }

  while (j < n2) {
    const dist = Math.abs(i / n1 - (j + 1) / n2);
    if (dist > maxDist) maxDist = dist;
    j++;
  }

  return maxDist;
}

/**
 * Computes weighted KS distance with scale weights.
 * @param {Array<Array<number>>} rescaledSamples Array of rescaled samples.
 * @param {Array<number>} weights Weight for each scale.
 * @return {number} Weighted KS distance.
 */
export function weightedKsDistance(rescaledSamples, weights) {
  if (rescaledSamples.length !== weights.length) {
    throw new Error('Samples and weights must have same length');
  }
  const n = rescaledSamples.length;
  let totalDist = 0;
  let weightSum = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = ksDistance(rescaledSamples[i], rescaledSamples[j], true);
      totalDist += weights[i] * weights[j] * dist;
      weightSum += weights[i] * weights[j];
    }
  }

  return weightSum > 0 ? totalDist / weightSum : 0;
}

/**
 * Computes multi-scale scaling profile KS distances.
 * @param {Array<number>} baseSample Base sample at scale a1.
 * @param {Array<Array<number>>} scaledSamples Array of samples at different scales.
 * @param {Array<number>} scales Array of scale values.
 * @param {number} H Hurst parameter.
 * @return {Array<number>} Array of KS distances for each scale.
 */
export function scalingProfile(baseSample, scaledSamples, scales, H) {
  const rescaledBase = baseSample.map((z) => Math.pow(scales[0], -H) * z);
  const distances = [];

  for (let i = 1; i < scaledSamples.length; i++) {
    const rescaled = scaledSamples[i].map((z) => Math.pow(scales[i], -H) * z);
    distances.push(ksDistance(rescaledBase, rescaled, true));
  }

  return distances;
}

/**
 * Fisher-Yates shuffle.
 * @param {Array<*>} array Input array.
 * @return {Array<*>} Shuffled array.
 */
export function shuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Floyd's reservoir sampling for random sampling without replacement.
 * More efficient than Set-based collision detection.
 * @param {Array<*>} array Input array.
 * @param {number} n Number of elements to sample.
 * @return {Array<*>} Random sample.
 */
export function randomSample(array, n) {
  const len = array.length;
  if (n >= len) return shuffle(array);
  if (n <= 0) return [];

  // Use Floyd's algorithm for reservoir sampling
  const result = array.slice(0, n);

  for (let i = n; i < len; i++) {
    const j = Math.floor(Math.random() * (i + 1));
    if (j < n) {
      result[j] = array[i];
    }
  }

  return result;
}

/**
 * Computes empirical CDF values.
 * @param {Array<number>} sortedSample Sorted sample.
 * @return {Array<number>} CDF values.
 */
export function empiricalCdf(sortedSample) {
  const n = sortedSample.length;
  return sortedSample.map((_, i) => (i + 1) / n);
}

/**
 * Computes quantile function (inverse CDF).
 * @param {Array<number>} sortedSample Sorted sample.
 * @param {Array<number>} probabilities Probability levels.
 * @return {Array<number>} Quantile values.
 */
export function quantileFunction(sortedSample, probabilities) {
  const n = sortedSample.length;
  return probabilities.map((p) => {
    const idx = Math.min(Math.ceil(p * n) - 1, n - 1);
    return sortedSample[Math.max(0, idx)];
  });
}

/**
 * Bootstrap resampling for confidence intervals.
 * @param {Array<number>} data Input data.
 * @param {number} nBoot Number of bootstrap samples.
 * @param {function(Array<number>): number} statisticFn Function to compute statistic.
 * @return {Array<number>} Bootstrap distribution of statistic.
 */
export function bootstrap(data, nBoot, statisticFn) {
  const result = new Array(nBoot);
  for (let i = 0; i < nBoot; i++) {
    const sample = randomSample(data, data.length).sort((a, b) => a - b);
    result[i] = statisticFn(sample);
  }
  return result;
}

/**
 * Welford's online algorithm for computing running variance.
 * @param {Array<number>} values Input values.
 * @return {{mean: number, variance: number}} Statistics.
 */
export function welfordVariance(values) {
  let count = 0;
  let mean = 0;
  let m2 = 0;

  for (const x of values) {
    count++;
    const delta = x - mean;
    mean += delta / count;
    const delta2 = x - mean;
    m2 += delta * delta2;
  }

  const variance = count > 1 ? m2 / count : 0;
  return {mean, variance};
}

/**
 * Running window variance using Welford's algorithm.
 * @param {Array<number>} values Input values.
 * @param {number} windowSize Window size.
 * @return {Array<number>} Running variances.
 */
export function runningVariance(values, windowSize) {
  const n = values.length;
  if (n < windowSize) return [];

  const result = new Array(n - windowSize + 1);

  // Initialize with first window
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < windowSize; i++) {
    sum += values[i];
    sumSq += values[i] * values[i];
  }
  result[0] = (sumSq - sum * sum / windowSize) / windowSize;

  // Slide window
  for (let i = windowSize; i < n; i++) {
    sum += values[i] - values[i - windowSize];
    sumSq += values[i] * values[i] - values[i - windowSize] * values[i - windowSize];
    result[i - windowSize + 1] = (sumSq - sum * sum / windowSize) / windowSize;
  }

  return result;
}