/**
 * Statistical utilities for RK-SAVR.
 * Google JS Style Guide compliant.
 */

import {random} from './prng.js';

/**
 * Computes the Kolmogorov-Smirnov distance between two samples.
 * D = sup_x |F_n(x) - G_m(x)| where F_n and G_m are empirical CDFs.
 * Uses the two-sample KS statistic computation.
 * @param {Array<number>|Float64Array} sample1
 * @param {Array<number>|Float64Array} sample2
 * @param {boolean} isSorted Whether the samples are already sorted.
 * @return {number} KS distance in [0, 1].
 */
export function ksDistance(sample1, sample2, isSorted = false) {
  if (!Array.isArray(sample1) && !(sample1 instanceof Float64Array)) {
    throw new Error('sample1 must be an array');
  }
  if (!Array.isArray(sample2) && !(sample2 instanceof Float64Array)) {
    throw new Error('sample2 must be an array');
  }
  if (sample1.length === 0 || sample2.length === 0) {
    throw new Error('ksDistance requires non-empty arrays');
  }
  if (
    sample1.some((v) => !Number.isFinite(v)) ||
    sample2.some((v) => !Number.isFinite(v))
  ) {
    throw new Error('ksDistance requires finite values');
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
 * Computes KS distance between two pre-sorted samples after rescaling by positive factors.
 * Avoids array allocation by applying factors during the pointer walk.
 * Multiplication by a positive scalar preserves ordering, so no re-sorting is needed.
 *
 * @param {Array<number>|Float64Array} sortedA Pre-sorted sample A.
 * @param {Array<number>|Float64Array} sortedB Pre-sorted sample B.
 * @param {number} factorA Positive rescaling factor for A.
 * @param {number} factorB Positive rescaling factor for B.
 * @return {number} KS distance between rescaled samples.
 */
export function ksDistanceRescaled(sortedA, sortedB, factorA, factorB) {
  if (!Array.isArray(sortedA) && !(sortedA instanceof Float64Array)) {
    throw new Error('sortedA must be an array');
  }
  if (!Array.isArray(sortedB) && !(sortedB instanceof Float64Array)) {
    throw new Error('sortedB must be an array');
  }
  if (sortedA.length === 0 || sortedB.length === 0) {
    throw new Error('ksDistanceRescaled requires non-empty arrays');
  }

  const n1 = sortedA.length;
  const n2 = sortedB.length;

  let i = 0;
  let j = 0;
  let maxDist = 0;

  while (i < n1 && j < n2) {
    const va = sortedA[i] * factorA;
    const vb = sortedB[j] * factorB;

    if (va < vb) {
      const dist = Math.abs((i + 1) / n1 - j / n2);
      if (dist > maxDist) maxDist = dist;
      i++;
    } else if (va > vb) {
      const dist = Math.abs(i / n1 - (j + 1) / n2);
      if (dist > maxDist) maxDist = dist;
      j++;
    } else {
      const dist = Math.abs((i + 1) / n1 - (j + 1) / n2);
      if (dist > maxDist) maxDist = dist;
      i++;
      j++;
    }
  }

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
 * Fisher-Yates shuffle.
 * Fisher-Yates shuffle.
 * @param {Array<*>} array Input array.
 * @return {Array<*>} Shuffled array.
 */
export function shuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
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
/**
 * Block random permutation for decorrelating serial dependence.
 * Partitions data into blocks of length blockSize, shuffles the blocks,
 * and optionally applies a random phase offset to the starting index.
 * Preserves marginal distributions while stripping away autocorrelation.
 *
 * @param {Array<*>} data Input array.
 * @param {number} blockSize Block length.
 * @param {boolean} randomPhase Whether to apply a random starting phase.
 * @return {Array<*>} Permuted array.
 */
export function blockPermutation(data, blockSize, randomPhase = false) {
  if (!Array.isArray(data) && !(data instanceof Float64Array)) {
    throw new Error('data must be an array');
  }
  if (blockSize <= 0 || blockSize > data.length) {
    throw new Error('blockSize must be positive and not exceed data length');
  }

  const n = data.length;
  let offset = 0;
  if (randomPhase) {
    offset = Math.floor(random() * blockSize);
  }

  // Extract blocks starting from offset, including prefix as first block if offset > 0
  const blocks = [];
  if (offset > 0) {
    blocks.push(data.slice(0, offset));
  }
  for (let i = offset; i < n; i += blockSize) {
    blocks.push(data.slice(i, Math.min(i + blockSize, n)));
  }

  // Fisher-Yates shuffle on blocks
  for (let i = blocks.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = blocks[i];
    blocks[i] = blocks[j];
    blocks[j] = tmp;
  }

  // Flatten
  const result = [];
  for (const block of blocks) {
    for (const item of block) {
      result.push(item);
    }
  }

  return result;
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
    const j = Math.floor(random() * (i + 1));
    if (j < n) {
      result[j] = array[i];
    }
  }

  return result;
}
