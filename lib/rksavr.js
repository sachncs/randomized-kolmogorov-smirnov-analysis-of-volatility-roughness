import { ksDistance, randomSample } from './stats.js';
import { brentMinimize } from './optimization.js';

/**
 * RK-SAVR Modular Core
 */

/**
 * Default Sampler: Random selection
 */
export const defaultSampler = (data, n) => randomSample(data, n);

/**
 * Default Optimizer: Brent's Method
 */
export const defaultOptimizer = (fn, min, guess, max, tol) => brentMinimize(fn, min, guess, max, tol).x;

/**
 * Default Objective: KS Distance between two rescaled samples
 */
export const ksObjective = (sample1, sample2, a1, a2, H) => {
    const rescaled1 = sample1.map(z => Math.pow(a1, -H) * z);
    const rescaled2 = sample2.map(z => Math.pow(a2, -H) * z);
    // Pre-sorting here once per H would be better, but sample.sort() is O(N log N)
    // Actually, we can't pre-sort if we rescale by a negative power unless we handle it.
    // Since a1, a2 > 0 and H > 0, scaling is monotonic.
    // So if we pre-sort sample1 and sample2, rescaled1 and rescaled2 will still be sorted!
    
    return ksDistance(rescaled1, rescaled2, true);
};

export class RKSAVR {
    constructor(config = {}) {
        this.config = {
            scaleA1: 1,
            scaleA2: 50,
            sampleSize: 500,
            iterations: 16,
            optimizer: defaultOptimizer,
            sampler: defaultSampler,
            objective: ksObjective,
            ...config
        };
    }

    /**
     * Compute increments for a series
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
     * Single estimation of H
     */
    estimateSingle(window) {
        const { scaleA1, scaleA2, sampleSize, sampler, optimizer, objective } = this.config;
        
        const inc1 = RKSAVR.getIncrements(window, scaleA1);
        const inc2 = RKSAVR.getIncrements(window, scaleA2);

        // Pre-sort after sampling for efficiency in the optimization loop
        const s1 = sampler(inc1, sampleSize).sort((a, b) => a - b);
        const s2 = sampler(inc2, sampleSize).sort((a, b) => a - b);

        const fn = (H) => objective(s1, s2, scaleA1, scaleA2, H);
        
        return optimizer(fn, 0.0001, 0.5, 1.0, 1e-5);
    }

    /**
     * Estimate H with variance reduction
     */
    estimate(window) {
        let sum = 0;
        const k = this.config.iterations;
        for (let i = 0; i < k; i++) {
            sum += this.estimateSingle(window);
        }
        return sum / k;
    }

    /**
     * Rolling estimation (Blocking version)
     */
    rolling(series, windowSize, step = 1, onProgress) {
        const results = [];
        const total = Math.floor((series.length - windowSize) / step) + 1;
        let count = 0;

        for (let t = 0; t <= series.length - windowSize; t += step) {
            const window = series.slice(t, t + windowSize);
            const H = this.estimate(window);
            results.push({ t, H });
            
            count++;
            if (onProgress) onProgress(count / total);
        }
        return results;
    }
}
