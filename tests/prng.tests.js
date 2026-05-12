/**
 * PRNG tests.
 */

import {describe, it} from 'mocha';
import {expect} from 'chai';
import {setSeed, resetSeed, random} from '../lib/prng.js';

describe('PRNG', function () {
  it('produces deterministic output with seed', function () {
    setSeed(42);
    const a = [random(), random(), random()];
    setSeed(42);
    const b = [random(), random(), random()];
    expect(a).to.deep.equal(b);
  });

  it('produces different streams with different seeds', function () {
    setSeed(1);
    const a = random();
    setSeed(2);
    const b = random();
    expect(a).to.not.equal(b);
  });

  it('falls back to Math.random when seed is null', function () {
    setSeed(null);
    const a = random();
    expect(a).to.be.within(0, 1);
  });

  it('resetSeed reverts to Math.random', function () {
    setSeed(42);
    resetSeed();
    const a = random();
    expect(a).to.be.within(0, 1);
  });

  it('handles seed of 0', function () {
    setSeed(0);
    const a = random();
    expect(a).to.be.within(0, 1);
  });

  it('produces uniform-ish distribution', function () {
    setSeed(123);
    const n = 1000;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += random();
    }
    const mean = sum / n;
    expect(mean).to.be.closeTo(0.5, 0.05);
    resetSeed();
  });
});
