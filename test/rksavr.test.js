/**
 * RKSAVR Core Tests
 * Google JS Style Guide compliant.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { RKSAVR } from '../lib/rksavr.js';
import { generateFBM } from '../lib/fbm.js';
import { asymptoticVariance, confidenceInterval, kalmanFilter } from '../lib/inference.js';

describe('RKSAVR', () => {
  it('should estimate H close to true value for synthetic fBM', () => {
    const H0 = 0.1;
    const fbm = generateFBM(2048, H0);
    const rksavr = new RKSAVR({ scaleA1: 1, scaleA2: 50, sampleSize: 500 });
    const window = fbm.slice(0, 512);
    const estimate = rksavr.estimate(window);

    assert.ok(estimate > 0 && estimate < 1, `H=${estimate} out of valid range`);
    assert.ok(Math.abs(estimate - H0) < 0.3,
        `H estimate ${estimate} too far from true ${H0}`);
  });

  it('should support multiple optimizer types', () => {
    const fbm = generateFBM(1024, 0.1);
    const window = fbm.slice(0, 256);

    const optimizers = ['brent', 'nelder-mead', 'annealing', 'ags'];
    for (const type of optimizers) {
      const rksavr = new RKSAVR({ scaleA1: 1, scaleA2: 50, optimizerType: type });
      const estimate = rksavr.estimate(window);
      assert.ok(estimate > 0 && estimate < 1,
          `Optimizer ${type} produced invalid H=${estimate}`);
    }
  });

  it('should compute rolling estimates', () => {
    const fbm = generateFBM(2048, 0.1);
    const rksavr = new RKSAVR({ scaleA1: 1, scaleA2: 50, sampleSize: 200, iterations: 4 });
    const results = rksavr.rolling(fbm, 256, 100);

    assert.ok(results.length > 0, 'Rolling should return results');
    for (const r of results) {
      assert.ok('t' in r && 'H' in r, 'Result should have t and H');
      assert.ok(r.H > 0 && r.H < 1, `H=${r.H} out of range`);
    }
  });

  it('should support multi-scale estimation', () => {
    const fbm = generateFBM(2048, 0.15);
    const rksavr = new RKSAVR({
      scales: [1, 2, 5, 10],
      weights: [1.0, 0.8, 0.5, 0.3],
      sampleSize: 200,
    });
    const estimate = rksavr.estimateSingle(fbm.slice(0, 512));

    assert.ok(estimate > 0 && estimate < 1, `Multi-scale H=${estimate} invalid`);
  });

  it('should use variance reduction', () => {
    const fbm = generateFBM(1024, 0.1);
    const rksavr = new RKSAVR({ iterations: 8 });

    const single = rksavr.estimateSingle(fbm.slice(0, 256));
    const averaged = rksavr.estimate(fbm.slice(0, 256));

    assert.ok(typeof single === 'number' && typeof averaged === 'number');
  });
});

describe('Inference', () => {
  it('should compute asymptotic variance', () => {
    const varH = asymptoticVariance(1, 50, 500, 500);
    assert.ok(varH > 0, 'Variance should be positive');
    assert.ok(varH < 1, 'Variance should be small');
  });

  it('should compute confidence interval', () => {
    const ci = confidenceInterval(0.1, 1, 50, 500, 500, 0.05);
    assert.ok(ci.lower < 0.1 && ci.upper > 0.1, 'CI should bracket estimate');
  });

  it('should apply Kalman filter', () => {
    const hHistory = Array.from({length: 100}, () => 0.1 + Math.random() * 0.02);
    const result = kalmanFilter(hHistory, { q: 0.01, r: 0.1 });
    assert.ok(result.filtered.length === hHistory.length, 'Filtered length mismatch');
  });
});

import { ksDistance } from '../lib/stats.js';

describe('KS Objective', () => {
  it('should return non-negative distance', () => {
    const s1 = new Array(100).fill(0).map(() => Math.random());
    const s2 = new Array(100).fill(0).map(() => Math.random());
    s1.sort((a, b) => a - b);
    s2.sort((a, b) => a - b);
    const dist = ksDistance(s1, s2, true);
    assert.ok(dist >= 0 && dist <= 1, `Invalid KS distance: ${dist}`);
  });
});

describe('fBM generation', () => {
  it('should generate valid fBM paths', () => {
    const fbm = generateFBM(512, 0.1);
    assert.ok(fbm.length === 512, 'Wrong length');
    assert.ok(fbm.every((v) => Number.isFinite(v)), 'Non-finite values');
  });
});