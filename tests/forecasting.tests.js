/**
 * Forecasting model tests.
 */

import {describe, it} from 'mocha';
import {expect} from 'chai';
import {
  arfima,
  holtWintersForecast,
  createLSTM,
  createAttentionModel,
} from '../lib/models/forecasting.js';

describe('arfima', function () {
  it('produces a forecast function', function () {
    const fn = arfima({p: 1, d: 0.3, q: 1, window: 10});
    expect(fn).to.be.a('function');
  });

  it('returns average for short series', function () {
    const fn = arfima({window: 10});
    const series = [0.1, 0.2, 0.15];
    const val = fn(series);
    expect(val).to.be.within(0.01, 0.99);
  });

  it('returns bounded prediction for longer series', function () {
    const fn = arfima({window: 5});
    const series = Array.from({length: 20}, () => 0.1 + Math.random() * 0.05);
    const val = fn(series);
    expect(val).to.be.within(0.01, 0.99);
  });
});

describe('holtWintersForecast', function () {
  it('produces a forecast', function () {
    const series = [1, 2, 3, 4, 5];
    const forecast = holtWintersForecast(series, 0.3, 0.1);
    expect(forecast).to.be.a('number');
    expect(forecast).to.be.above(0);
  });

  it('throws for empty series', function () {
    expect(() => holtWintersForecast([], 0.3, 0.1)).to.throw(
      'series must be non-empty',
    );
  });

  it('validates alpha in [0,1]', function () {
    expect(() => holtWintersForecast([1, 2], -0.1, 0.1)).to.throw(
      'alpha must be in [0,1]',
    );
    expect(() => holtWintersForecast([1, 2], 1.1, 0.1)).to.throw(
      'alpha must be in [0,1]',
    );
  });
});

describe('createLSTM', function () {
  it('creates a predictor with predict method', function () {
    const lstm = createLSTM({hiddenSize: 8});
    expect(lstm).to.have.property('predict');
    expect(lstm.predict).to.be.a('function');
  });

  it('produces hidden state of correct size', function () {
    const lstm = createLSTM({hiddenSize: 8});
    const hidden = lstm.predict([0.1, 0.2, 0.3, 0.4]);
    expect(hidden).to.have.lengthOf(8);
    expect(hidden.every((v) => Number.isFinite(v))).to.equal(true);
  });

  it('throws for empty series', function () {
    const lstm = createLSTM();
    expect(() => lstm.predict([])).to.throw('series must be non-empty');
  });
});

describe('createAttentionModel', function () {
  it('creates a predictor with predict method', function () {
    const attn = createAttentionModel({hiddenSize: 8, numHeads: 2});
    expect(attn).to.have.property('predict');
    expect(attn.predict).to.be.a('function');
  });

  it('produces hidden state of correct size', function () {
    const attn = createAttentionModel({hiddenSize: 8, numHeads: 2});
    const hidden = attn.predict([0.1, 0.2, 0.3, 0.4]);
    expect(hidden).to.have.lengthOf(8);
    expect(hidden.every((v) => Number.isFinite(v))).to.equal(true);
  });

  it('throws for empty series', function () {
    const attn = createAttentionModel();
    expect(() => attn.predict([])).to.throw('series must be non-empty');
  });
});
