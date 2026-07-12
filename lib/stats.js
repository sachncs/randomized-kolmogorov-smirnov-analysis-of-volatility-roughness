/**
 * @fileoverview Statistical primitives powering the RK-SAVR estimator.
 *
 * This module contains:
 *
 * - `ksDistance` / `ksDistanceRescaled`: two-sample Kolmogorov-Smirnov
 *   statistic with an optional merged-pointer walk.
 * - `shuffle`: an unbiased Fisher-Yates shuffle (used everywhere a random
 *   permutation is needed).
 * - `randomSample`: Floyd's Algorithm R reservoir sampler (O(n) time, O(k)
 *   space).
 * - `blockPermutation`: the paper's block-random permutation primitive,
 *   which decorrelates serial dependence while preserving the marginal
 *   distribution.
 *
 * All routines here are allocation-aware and accept either `Array` or
 * `Float64Array` inputs. They depend only on the seeded PRNG exposed by
 * `prng.js`, so setting a seed before any of these calls makes a pipeline
 * fully deterministic.
 *
 * @see ./rksavr.js for the estimator that consumes these primitives.
 * @see ./prng.js for the seeded random source.
 */

import {random} from './prng.js';

/**
 * Computes the two-sample Kolmogorov-Smirnov distance.
 *
 * Algorithm: a linear merged-pointer walk over the sorted order statistics.
 * As we walk through the sorted union we maintain the empirical CDF values
 * `F_n(x) = (i + 1) / n` and `G_m(x) = j / m` at the current position and
 * record the absolute difference. Sorting first dominates the cost; the
 * walk itself is `O(n + m)` where `n = sample1.length` and
 * `m = sample2.length`.
 *
 * Input validation:
 * - Both samples must be non-empty arrays or `Float64Array`s.
 * - All values must be finite (no `NaN`, `+Infinity`, `-Infinity`).
 *
 * Ties: when values are equal the walk advances both pointers and uses
 * `(i + 1) / n` vs. `(j + 1) / m` for the distance — this matches the
 * standard two-sided statistic.
 *
 * @param {Array<number>|Float64Array} sample1 First empirical sample.
 * @param {Array<number>|Float64Array} sample2 Second empirical sample.
 * @param {boolean} isSorted If `true`, skip sorting both samples. Off by
 *   default; setting this to `true` is the user's responsibility and is
 *   the hot path used inside `rkSAVR`'s prepared-samples loop.
 * @return {number} KS distance `sup_x |F_n(x) - G_m(x)|` in `[0, 1]`.
 * @throws {Error} When either input is not an array/typed array, is empty,
 *   or contains non-finite values.
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

    if (v1 < v2) {
      const dist = Math.abs((i + 1) / n1 - j / n2);
      if (dist > maxDist) maxDist = dist;
      i++;
    } else if (v1 > v2) {
      const dist = Math.abs(i / n1 - (j + 1) / n2);
      if (dist > maxDist) maxDist = dist;
      j++;
    } else {
      // Tied values: advance both pointers and compare the *upper* CDFs.
      const dist = Math.abs((i + 1) / n1 - (j + 1) / n2);
      if (dist > maxDist) maxDist = dist;
      i++;
      j++;
    }
  }

  // Drain the remaining tail in whichever sample still has values.
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
 * Kolmogorov-Smirnov distance for **already sorted** samples that need
 * rescaling.
 *
 * Equivalent to `ksDistance(a, b, true)` but applies the rescaling factors
 * during the merged-pointer walk so no auxiliary allocation is needed.
 * Multiplication by a positive scalar is order-preserving, so the
 * pre-sorting of the inputs is unaffected by the choice of `factorA` and
 * `factorB`.
 *
 * This is the hot path of the RK-SAVR estimator's inner loop:
 * `O(n + m)` per evaluation, no allocations beyond the locals below.
 *
 * @param {Array<number>|Float64Array} sortedA Pre-sorted sample A.
 * @param {Array<number>|Float64Array} sortedB Pre-sorted sample B.
 * @param {number} factorA Positive rescaling factor for A (typically
 *   `a^{-H}`).
 * @param {number} factorB Positive rescaling factor for B.
 * @return {number} KS distance between the rescaled samples in `[0, 1]`.
 * @throws {Error} When either input is not an array/typed array or is empty.
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

  // Pointer walk: at every step both pointers point to the smallest
  // not-yet-consumed value in their respective samples; the CDF values
  // are tracked implicitly through the (i, j) cursor positions.
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
      // Tie case: advance both pointers and compare against the upper CDFs.
      const dist = Math.abs((i + 1) / n1 - (j + 1) / n2);
      if (dist > maxDist) maxDist = dist;
      i++;
      j++;
    }
  }

  // Tail loop: whatever pointers remain, the opposing CDF is constant.
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
 * Unbiased Fisher-Yates shuffle.
 *
 * Returns a new array; the input is never mutated. Uses the seeded PRNG
 * exposed by `prng.js`, so the result is reproducible when a seed is set.
 *
 * Complexity: `O(n)` time, `O(n)` extra memory.
 *
 * @param {Array<*>} array Input array (not modified).
 * @return {Array<*>} Shuffled copy of `array`.
 */
export function shuffle(array) {
  const arr = array.slice();
  // Walk from right to left; for each position swap with a uniformly drawn
  // earlier position. This is the textbook Knuth shuffle: every permutation
  // is equally likely.
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Block random permutation for decorrelating serial dependence.
 *
 * Conceptually this is the paper's "preserves marginals, kills short-range
 * autocorrelation" operation:
 *
 * 1. (Optional) shift the starting index by a uniform `[-0, blockSize)`
 *    offset so two calls with the same seed still produce different
 *    alignments.
 * 2. Slice the resulting series into blocks of length `blockSize` (the
 *    first block may be shorter than `blockSize` when a phase offset was
 *    applied).
 * 3. Apply a Fisher-Yates shuffle to the block list.
 * 4. Concatenate the shuffled blocks back into a single sequence.
 *
 * Picking `blockSize` is the user's responsibility: it should be larger than
 * the dominant autocorrelation length in `data`. Too small and serial
 * dependence survives; too large and the number of blocks — and therefore
 * the effective randomization — shrinks.
 *
 * @param {Array<*>} data Input array (not modified).
 * @param {number} blockSize Block length; must satisfy `0 < blockSize <= data.length`.
 * @param {boolean} randomPhase Whether to apply a random starting phase
 *   offset.
 * @return {Array<*>} Permuted array containing exactly the same elements as
 *   `data`.
 * @throws {Error} When `data` is not array-like or `blockSize` is out of range.
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

  // Extract blocks starting from offset, including prefix as first block if
  // offset > 0 so the permutation is always a true rearrangement of the
  // entire input.
  const blocks = [];
  if (offset > 0) {
    blocks.push(data.slice(0, offset));
  }
  for (let i = offset; i < n; i += blockSize) {
    blocks.push(data.slice(i, Math.min(i + blockSize, n)));
  }

  // Shuffle the blocks themselves (not their contents).
  for (let i = blocks.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = blocks[i];
    blocks[i] = blocks[j];
    blocks[j] = tmp;
  }

  // Flatten back into a single contiguous array.
  const result = [];
  for (const block of blocks) {
    for (const item of block) {
      result.push(item);
    }
  }

  return result;
}

/**
 * Floyd's Algorithm R reservoir sampler.
 *
 * Streams over the input producing a uniformly random sample of size `n`
 * **without replacement**. Equivalent to `shuffle(array).slice(0, n)` but
 * uses only `O(n)` auxiliary memory and a single pass through `array`,
 * which matters when sampling from very large arrays (e.g. millions of
 * increments).
 *
 * Edge cases:
 * - `n >= array.length`: returns a shuffled full copy of `array`.
 * - `n <= 0`: returns an empty array.
 *
 * @param {Array<*>} array Input array.
 * @param {number} n Number of elements to sample.
 * @return {Array<*>} Random sample of size `min(n, array.length)`.
 */
export function randomSample(array, n) {
  const len = array.length;
  if (n >= len) return shuffle(array);
  if (n <= 0) return [];

  // Algorithm R: seed the reservoir with the first n elements, then for
  // each later index `i` swap it (with probability `n / (i + 1)`) into a
  // uniformly chosen reservoir slot.
  const result = array.slice(0, n);

  for (let i = n; i < len; i++) {
    const j = Math.floor(random() * (i + 1));
    if (j < n) {
      result[j] = array[i];
    }
  }

  return result;
}
