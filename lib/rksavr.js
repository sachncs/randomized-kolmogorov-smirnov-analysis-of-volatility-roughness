/**
 * RK-SAVR Modular Core.
 * Implements Randomized Kolmogorov-Smirnov Analysis of Volatility Roughness.
 * Google JS Style Guide compliant.
 */

import {ksDistance, randomSample} from './stats.js';
import {
  brentMinimize,
  nelderMead,
  simulatedAnnealing,
  differentialEvolution,
  adaptiveGridSearch,
} from './optimization.js';

/**
 * Default Sampler: Random selection.
 */
const defaultSampler = (data, n) => randomSample(data, n);

/**
 * Optimizer registry mapping name to factory function.
 * Factory receives no arguments and returns an optimizer function.
 * @private @const
 */
const OPTIMIZER_REGISTRY = {
  'brent': () => (fn, min, guess) => brentMinimize(fn, min, guess[0] || 0.5, 1.0, 1e-5).x,
  'nelder-mead': () => (fn) => nelderMead((x) => fn(x[0]), [0.5], {maxIter: 500}).x[0],
  'annealing': () => (fn) => simulatedAnnealing(
      (x) => fn(x[0]), [0.5], {maxIter: 2000, coolingRate: 0.99, stepSize: 0.1}).x[0],
  'de': () => (fn) => differentialEvolution(
      (x) => fn(x[0]), [0.5], {maxIter: 300, popSize: 30}).x[0],
  'ags': () => (fn, min, guess) => adaptiveGridSearch(fn, min, guess).x,
};

/**
 * Vectorized KS objective for multi-scale analysis.
 * Pre-sorted samples, rescale only.
 * @param {Array<Float64Array>} sortedSamples Pre-sorted samples at different scales.
 * @param {Array<number>} scales Array of scale values.
 * @param {number} H Hurst parameter.
 * @return {number} Mean KS distance across all scale pairs.
 */
const vectorizedKsObjective = (sortedSamples, scales, H) => {
  const n = sortedSamples.length;
  let totalDist = 0;
  let count = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      totalDist += computeScalePairDistance(sortedSamples, scales, i, j, H);
      count++;
    }
  }
  return count > 0 ? totalDist / count : 0;
};

/**
 * Computes KS distance between a pair of rescaled samples.
 * @param {Array<Float64Array>} sortedSamples Pre-sorted samples.
 * @param {Array<number>} scales Scale values.
 * @param {number} i First sample index.
 * @param {number} j Second sample index.
 * @param {number} H Hurst parameter.
 * @return {number} KS distance between rescaled samples.
 */
const computeScalePairDistance = (sortedSamples, scales, i, j, H) => {
  const rescaledI = sortedSamples[i].map(
      (z) => Math.pow(scales[i], -H) * z,
  );
  const rescaledJ = sortedSamples[j].map(
      (z) => Math.pow(scales[j], -H) * z,
  );
  return ksDistance(rescaledI, rescaledJ, true);
};

/**
 * Weighted KS objective with scale weights.
 * @param {Array<Float64Array>} sortedSamples Pre-sorted samples.
 * @param {Array<number>} scales Scale values.
 * @param {Array<number>} weights Scale weights.
 * @param {number} H Hurst parameter.
 * @return {number} Weighted KS distance.
 */
const weightedKsObjective = (sortedSamples, scales, weights, H) => {
  const n = sortedSamples.length;
  let totalDist = 0;
  let weightSum = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = computeScalePairDistance(sortedSamples, scales, i, j, H);
      totalDist += weights[i] * weights[j] * dist;
      weightSum += weights[i] * weights[j];
    }
  }

  return weightSum > 0 ? totalDist / weightSum : 0;
};

/**
 * RK-SAVR Estimator class.
 * Estimates Hurst parameter (H) for rough volatility models.
 * H must satisfy 0 < H < 1.
 */
export class RKSAVR {
  /**
   * @param {Object} config Configuration options.
   * @param {number} config.scaleA1 Lower scale (default 1).
   * @param {number} config.scaleA2 Upper scale (default 50).
   * @param {Array<number>=} config.scales Array of scale values for multi-scale analysis.
   * @param {number} config.sampleSize Sample size per scale (default 500).
   * @param {number} config.iterations Number of variance-reduction iterations (default 16).
   * @param {function=} config.sampler Custom sampler function.
   * @param {Array<number>=} config.weights Scale weights for weighted estimation.
   * @param {string} config.optimizerType Optimizer: 'brent', 'nelder-mead', 'annealing', 'de', 'ags' (default 'brent').
   * The valid range for the estimated H is 0 < H < 1.
   */
  constructor(config = {}) {
    this.scaleA1 = config.scaleA1 !== undefined ? config.scaleA1 : 1;
    this.scaleA2 = config.scaleA2 !== undefined ? config.scaleA2 : 50;
    this.scales = config.scales || null;
    this.sampleSize = config.sampleSize !== undefined ? config.sampleSize : 500;
    this.iterations = config.iterations !== undefined ? config.iterations : 16;
    this.sampler = config.sampler || defaultSampler;
    this.weights = config.weights || null;
    this.optimizerType = config.optimizerType || 'brent';

    this._optimizer = this._initOptimizer();
  }

  /**
   * Registers a custom optimizer in the global registry.
   * @param {string} name Optimizer identifier.
   * @param {function(): function} factory Returns the optimizer function.
   */
  static registerOptimizer(name, factory) {
    OPTIMIZER_REGISTRY[name] = factory;
  }

  /**
   * Initializes optimizer based on optimizerType.
   * @private
   * @return {function} Optimizer function.
   */
  _initOptimizer() {
    const factory = OPTIMIZER_REGISTRY[this.optimizerType] ||
        OPTIMIZER_REGISTRY['brent'];
    return factory();
  }

  /**
   * Computes increments for a series at given scale.
   * @param {Array<number>|Float64Array} series Input series.
   * @param {number} scale Scale value.
   * @return {Float64Array} Increment array.
   */
  static getIncrements(series, scale) {
    const len = series.length;
    const result = new Float64Array(len - scale);
    for (let i = 0; i < len - scale; i++) {
      result[i] = series[i + scale] - series[i];
    }
    return result;
  }

  /**
   * Precomputes all increments for a set of scales in a single pass.
   * @param {Array<number>|Float64Array} series Input series.
   * @param {Array<number>} scales Array of scale values.
   * @return {Map<number, Float64Array>} Map from scale to increment array.
   */
  static getIncrementsMulti(series, scales) {
    const result = new Map();
    const len = series.length;
    const maxScale = Math.max(...scales);

    for (const scale of scales) {
      result.set(scale, new Float64Array(len - scale));
    }

    for (let i = 0; i < len - maxScale; i++) {
      const val = series[i];
      for (const scale of scales) {
        if (i + scale < len) {
          result.get(scale)[i] = series[i + scale] - val;
        }
      }
    }

    return result;
  }

  /**
   * Single estimation of H.
   * @param {Array<number>} window Data window.
   * @param {Object} opts Override options.
   * @return {number} Estimated H.
   */
  /**
   * Internal estimation that returns both H and the prepared samples.
   * @param {Array<number>} window Data window.
   * @param {Object} opts Override options.
   * @return {{H: number, sortedSamples: Array<Float64Array>, scaleValues: Array<number>}}
   * @private
   */
  _estimateSingleRaw(window, opts = {}) {
    if (!window || window.length === 0) {
      throw new Error('window must be a non-empty array');
    }

    const scales = opts.scales || this.scales;
    const sampleSize = opts.sampleSize || this.sampleSize;
    const sampler = opts.sampler || this.sampler;
    const weights = opts.weights || this.weights;
    const optimizer = this._optimizer;

    let sortedSamples;
    let scaleValues;

    if (scales && scales.length > 0) {
      scaleValues = scales;
      const incMap = RKSAVR.getIncrementsMulti(window, scales);
      sortedSamples = scales.map((scale) => {
        const inc = incMap.get(scale);
        return sampler(inc, sampleSize).sort((a, b) => a - b);
      });
    } else {
      scaleValues = [this.scaleA1, this.scaleA2];
      const inc1 = RKSAVR.getIncrements(window, this.scaleA1);
      const inc2 = RKSAVR.getIncrements(window, this.scaleA2);
      sortedSamples = [
        sampler(inc1, sampleSize).sort((a, b) => a - b),
        sampler(inc2, sampleSize).sort((a, b) => a - b),
      ];
    }

    let fn;
    if (scaleValues.length > 2 && weights) {
      fn = (H) => weightedKsObjective(sortedSamples, scaleValues, weights, H);
    } else if (scaleValues.length > 2) {
      fn = (H) => vectorizedKsObjective(sortedSamples, scaleValues, H);
    } else {
      fn = (H) => computeScalePairDistance(sortedSamples, scaleValues, 0, 1, H);
    }

    const H = optimizer(fn, 0.0001, [0.5]);
    return {H, sortedSamples, scaleValues};
  }

  estimateSingle(window, opts = {}) {
    return this._estimateSingleRaw(window, opts).H;
  }

  /**
   * Estimate H with variance reduction.
   * @param {Array<number>} window Data window.
   * @param {Object} opts Options.
   * @return {number} Averaged H estimate.
   */
  estimate(window, opts = {}) {
    let sum = 0;
    const k = (opts && opts.iterations) || this.iterations;
    for (let i = 0; i < k; i++) {
      sum += this.estimateSingle(window, opts);
    }
    return sum / k;
  }

  /**
   * Rolling estimation with progress callback.
   * @param {Array<number>} series Time series data.
   * @param {number} windowSize Window size.
   * @param {number} step Step size.
   * @param {function(number): void=} onProgress Progress callback.
   * @return {Array<{t: number, H: number}>} Rolling estimates.
   */
  rolling(series, windowSize, step = 1, onProgress) {
    const results = [];
    const total = Math.floor((series.length - windowSize) / step) + 1;
    let count = 0;

    for (let t = 0; t <= series.length - windowSize; t += step) {
      const window = series.slice(t, t + windowSize);
      const H = this.estimate(window);
      results.push({t, H});

      count++;
      if (onProgress) onProgress(count / total);
    }
    return results;
  }

  /**
   * Multi-scale rolling estimation.
   * @param {Array<number>} series Time series data.
   * @param {number} windowSize Window size.
   * @param {Array<number>} scales Array of scales.
   * @param {Array<number>} weights Optional weights for each scale.
   * @param {number} step Step size.
   * @param {function(number): void=} onProgress Progress callback.
   * @return {Array<{t: number, H: number, profile: Array<number>}>} Rolling estimates.
   */
  rollingMultiScale(series, windowSize, scales, weights = null, step = 1, onProgress) {
    const results = [];
    const total = Math.floor((series.length - windowSize) / step) + 1;
    let count = 0;

    const multiConfig = {scales, weights};

    for (let t = 0; t <= series.length - windowSize; t += step) {
      const window = series.slice(t, t + windowSize);
      const {H, sortedSamples} = this._estimateSingleRaw(window, multiConfig);

      const profile = [];
      for (let i = 0; i < sortedSamples.length; i++) {
        for (let j = i + 1; j < sortedSamples.length; j++) {
          const dist = computeScalePairDistance(sortedSamples, scales, i, j, H);
          profile.push(dist);
        }
      }

      results.push({t, H, profile});
      count++;
      if (onProgress) onProgress(count / total);
    }
    return results;
  }

  /**
   * Batch estimation for parallel processing.
   * @param {Array<Array<number>>} windows Array of windows.
   * @return {Array<number>} Array of H estimates.
   */
  estimateBatch(windows) {
    return windows.map((window) => this.estimateSingle(window));
  }
}

/**
 * RK-SAVR Result object for richer output.
 */
export class RKSAVRResult {
  /**
   * @param {Object} data Result data.
   */
  constructor(data) {
    this.h = data.h;
    this.hHistory = data.hHistory || [];
    this.profile = data.profile || null;
    this.variance = data.variance || null;
    this.confidenceInterval = data.confidenceInterval || null;
    this.breakpoints = data.breakpoints || [];
    this.metadata = data.metadata || {};
  }
}