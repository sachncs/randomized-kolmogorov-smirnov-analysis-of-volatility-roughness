/**
 * Statistical utilities tests.
 */

import {describe, it} from 'mocha';
import {expect} from 'chai';
import {
  ksDistance,
  ksDistanceRescaled,
  shuffle,
  randomSample,
  blockPermutation,
} from '../lib/stats.js';
import {setSeed, resetSeed} from '../lib/prng.js';

describe('ksDistance', function () {
  it('computes zero distance for identical samples', function () {
    const s = [1, 2, 3, 4, 5];
    expect(ksDistance(s, s, false)).to.equal(0);
  });

  it('computes one distance for disjoint samples', function () {
    expect(ksDistance([1, 2, 3], [10, 11, 12], false)).to.equal(1);
  });

  it('handles ties correctly', function () {
    const s1 = [1, 2, 2, 3];
    const s2 = [2, 2, 4];
    const d = ksDistance(s1, s2, false);
    expect(d).to.be.within(0, 1);
  });

  it('validates input types', function () {
    expect(() => ksDistance(null, [1])).to.throw('sample1 must be an array');
    expect(() => ksDistance([1], null)).to.throw('sample2 must be an array');
  });

  it('validates non-empty arrays', function () {
    expect(() => ksDistance([], [1])).to.throw(
      'ksDistance requires non-empty arrays',
    );
    expect(() => ksDistance([1], [])).to.throw(
      'ksDistance requires non-empty arrays',
    );
  });

  it('validates finite values', function () {
    expect(() => ksDistance([1, Infinity], [1, 2])).to.throw(
      'ksDistance requires finite values',
    );
    expect(() => ksDistance([1, 2], [NaN, 2])).to.throw(
      'ksDistance requires finite values',
    );
  });

  it('works with Float64Array', function () {
    const a = new Float64Array([1, 2, 3]);
    const b = new Float64Array([2, 3, 4]);
    expect(ksDistance(a, b, false)).to.be.a('number');
  });

  it('is symmetric', function () {
    setSeed(7);
    const s1 = new Array(50).fill(0).map(() => Math.random());
    const s2 = new Array(50).fill(0).map(() => Math.random());
    const d1 = ksDistance(s1, s2, false);
    const d2 = ksDistance(s2, s1, false);
    expect(d1).to.equal(d2);
    resetSeed();
  });
});

describe('ksDistanceRescaled', function () {
  it('matches ksDistance for identity factors', function () {
    const a = new Float64Array([1, 2, 3, 4, 5]);
    const b = new Float64Array([2, 3, 4, 5, 6]);
    const d1 = ksDistance(a, b, false);
    const d2 = ksDistanceRescaled(a, b, 1, 1);
    expect(d2).to.equal(d1);
  });

  it('returns zero for identical rescaled samples', function () {
    const a = new Float64Array([1, 2, 3]);
    // a*2 = [2,4,6], b*1 = [2,4,6]
    const b = new Float64Array([2, 4, 6]);
    expect(ksDistanceRescaled(a, b, 2, 1)).to.equal(0);
  });

  it('validates non-empty arrays', function () {
    expect(() => ksDistanceRescaled([], [1], 1, 1)).to.throw(
      'ksDistanceRescaled requires non-empty arrays',
    );
    expect(() => ksDistanceRescaled([1], [], 1, 1)).to.throw(
      'ksDistanceRescaled requires non-empty arrays',
    );
  });

  it('works with regular arrays', function () {
    const a = [1, 2, 3];
    const b = [10, 11, 12];
    expect(ksDistanceRescaled(a, b, 1, 1)).to.equal(1);
  });
});

describe('shuffle', function () {
  it('preserves all elements', function () {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    expect(shuffled.sort((a, b) => a - b)).to.deep.equal(arr);
  });

  it('does not mutate original', function () {
    const arr = [1, 2, 3];
    shuffle(arr);
    expect(arr).to.deep.equal([1, 2, 3]);
  });

  it('handles empty array', function () {
    expect(shuffle([])).to.deep.equal([]);
  });
});

describe('randomSample', function () {
  it('samples without replacement', function () {
    setSeed(8);
    const arr = Array.from({length: 100}, (_, i) => i);
    const sample = randomSample(arr, 20);
    expect(sample).to.have.lengthOf(20);
    expect(new Set(sample).size).to.equal(20);
    resetSeed();
  });

  it('returns full array when n >= length', function () {
    const arr = [1, 2, 3];
    const sample = randomSample(arr, 5);
    expect(sample.sort((a, b) => a - b)).to.deep.equal(arr);
  });

  it('returns empty array for n <= 0', function () {
    expect(randomSample([1, 2, 3], 0)).to.deep.equal([]);
    expect(randomSample([1, 2, 3], -1)).to.deep.equal([]);
  });
});

describe('blockPermutation', function () {
  it('preserves all elements', function () {
    setSeed(9);
    const data = Array.from({length: 30}, (_, i) => i);
    const perm = blockPermutation(data, 6);
    expect(perm.sort((a, b) => a - b)).to.deep.equal(data);
    resetSeed();
  });

  it('supports random phase', function () {
    setSeed(10);
    const data = Array.from({length: 25}, (_, i) => i);
    const perm = blockPermutation(data, 5, true);
    expect(perm.sort((a, b) => a - b)).to.deep.equal(data);
    resetSeed();
  });

  it('throws for invalid blockSize', function () {
    expect(() => blockPermutation([1, 2], 0)).to.throw(
      'blockSize must be positive',
    );
    expect(() => blockPermutation([1, 2], 3)).to.throw(
      'blockSize must be positive and not exceed data length',
    );
  });

  it('throws for non-array input', function () {
    expect(() => blockPermutation(null, 2)).to.throw('data must be an array');
  });

  it('works with Float64Array', function () {
    setSeed(11);
    const data = new Float64Array([1, 2, 3, 4, 5, 6]);
    const perm = blockPermutation(data, 2);
    expect(perm.length).to.equal(6);
    resetSeed();
  });
});
