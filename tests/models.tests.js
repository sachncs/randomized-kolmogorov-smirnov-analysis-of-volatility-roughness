/**
 * Rough volatility model tests.
 */

import {describe, it} from 'mocha';
import {expect} from 'chai';
import {
  rBergomi,
  rBergomiPrice,
  rFSV,
  rFSVPrice,
  fOU,
  exactOU,
  mPRE,
  mPREExact,
  getModel,
  listModels,
  registerModel,
} from '../lib/models/index.js';

describe('rBergomi', function () {
  it('generates volatility paths', function () {
    const result = rBergomi({nPaths: 2, nSteps: 100, h: 0.1});
    expect(result.paths).to.have.lengthOf(2);
    expect(result.times).to.have.lengthOf(101);
    expect(result.paths[0]).to.have.lengthOf(101);
    expect(result.paths[0].every((v) => Number.isFinite(v) && v >= 0)).to.equal(
      true,
    );
  });

  it('generates price paths', function () {
    const result = rBergomiPrice({nPaths: 1, nSteps: 50, h: 0.1});
    expect(result.prices).to.have.lengthOf(1);
    expect(result.prices[0]).to.have.lengthOf(51);
    expect(result.prices[0][0]).to.equal(100);
  });
});

describe('rFSV', function () {
  it('generates volatility path', function () {
    const result = rFSV({nSteps: 100, h: 0.1});
    expect(result.volPath).to.have.lengthOf(101);
    expect(result.times).to.have.lengthOf(101);
    expect(result.volPath.every((v) => Number.isFinite(v))).to.equal(true);
  });

  it('generates price path', function () {
    const result = rFSVPrice({nSteps: 50, h: 0.1});
    expect(result.prices).to.have.lengthOf(51);
    expect(result.prices[0]).to.equal(100);
    expect(result.volatilities).to.have.lengthOf(51);
  });
});

describe('fOU', function () {
  it('generates OU path', function () {
    const result = fOU({nSteps: 100, h: 0.5});
    expect(result.path).to.have.lengthOf(101);
    expect(result.times).to.have.lengthOf(101);
    expect(result.path.every((v) => Number.isFinite(v))).to.equal(true);
  });

  it('generates exact OU path', function () {
    const result = exactOU({nSteps: 100, h: 0.5});
    expect(result.path).to.have.lengthOf(101);
    expect(result.times).to.have.lengthOf(101);
  });
});

describe('mPRE', function () {
  it('generates MPRE path', function () {
    const result = mPRE({nSteps: 100, hMin: 0.05, hMax: 0.95, h0: 0.1});
    expect(result.path).to.have.lengthOf(101);
    expect(result.hPath).to.have.lengthOf(101);
    expect(result.times).to.have.lengthOf(101);
    expect(result.hPath.every((h) => h >= 0.05 && h <= 0.95)).to.equal(true);
  });

  it('generates exact MPRE path', function () {
    const result = mPREExact({nSteps: 50, hMin: 0.05, hMax: 0.95, h0: 0.1});
    expect(result.path).to.have.lengthOf(51);
    expect(result.hPath).to.have.lengthOf(51);
  });
});

describe('Model Registry', function () {
  it('lists built-in models', function () {
    const models = listModels();
    expect(models).to.include('rBergomi');
    expect(models).to.include('rFSV');
    expect(models).to.include('fOU');
    expect(models).to.include('mPRE');
    expect(models).to.include('arfima');
  });

  it('retrieves models', function () {
    const model = getModel('rBergomi');
    expect(model).to.have.property('simulate');
    expect(model).to.have.property('price');
  });

  it('registers custom models', function () {
    const customFn = () => 42;
    registerModel('testModel', {simulate: customFn});
    const retrieved = getModel('testModel');
    expect(retrieved).to.have.property('simulate');
    expect(retrieved.simulate).to.equal(customFn);
  });
});
