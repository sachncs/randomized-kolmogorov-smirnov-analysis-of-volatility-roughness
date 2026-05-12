/**
 * Noise correction tests.
 */

import {describe, it} from 'mocha';
import {expect} from 'chai';
import {
  preavgReturns,
  realizedKernel,
  logVolDebias,
} from '../lib/data/noise.js';

describe('preavgReturns', function () {
  it('produces noise-robust returns', function () {
    const prices = Array.from({length: 20}, (_, i) => 100 + i * 0.1);
    const returns = preavgReturns(prices, 2);
    expect(returns).to.be.an('array');
    expect(returns.length).to.be.above(0);
    expect(returns.every((v) => Number.isFinite(v))).to.equal(true);
  });

  it('throws for too-short series', function () {
    expect(() => preavgReturns([100, 101], 5)).to.throw(
      'prices array too short for preaveraging window',
    );
  });
});

describe('realizedKernel', function () {
  it('computes non-negative volatility', function () {
    const returns = Array.from(
      {length: 50},
      () => (Math.random() - 0.5) * 0.02,
    );
    const rv = realizedKernel(returns, 'bartlett');
    expect(rv).to.be.a('number');
    expect(rv).to.be.at.least(0);
  });

  it('supports multiple kernel types', function () {
    const returns = Array.from(
      {length: 50},
      () => (Math.random() - 0.5) * 0.02,
    );
    for (const kernel of ['bartlett', 'parzen', 'tukey-hanning']) {
      const rv = realizedKernel(returns, kernel);
      expect(rv).to.be.at.least(0);
    }
  });

  it('throws for empty returns', function () {
    expect(() => realizedKernel([], 'bartlett')).to.throw(
      'returns must be non-empty',
    );
  });
});

describe('logVolDebias', function () {
  it('returns adjusted estimates', function () {
    const raw = [0.1, 0.15, 0.12];
    const debiased = logVolDebias(raw, 0.3, 0.2);
    expect(debiased).to.have.lengthOf(raw.length);
    expect(debiased.every((v) => v >= 0.01 && v <= 0.99)).to.equal(true);
  });

  it('throws for invalid sigmaLatent', function () {
    expect(() => logVolDebias([0.1], 0.2, 0)).to.throw(
      'sigmaLatent must be positive',
    );
  });

  it('returns empty array for empty input', function () {
    expect(logVolDebias([], 0.2, 0.1)).to.deep.equal([]);
  });
});
