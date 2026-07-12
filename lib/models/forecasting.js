/**
 * @fileoverview H-forecasting primitives for RK-SAVR.
 *
 * Provides lightweight forecasting tools that consume a stream of
 * historical `H` estimates (typically the output of `RKSAVR.rolling`)
 * and predict the next value. The intent is to enable the dashboard
 * and experiments modules to demonstrate online forecasting without
 * pulling in a heavyweight ML framework.
 *
 * Shipped forecasters:
 *
 * - `arfima`: autoregressive fractionally-integrated moving average.
 * - `holtWintersForecast`: exponential smoothing with level + trend.
 * - `createLSTM`: a minimal stateless LSTM-like recurrent cell.
 * - `createAttentionModel`: a minimal stateless Transformer-style
 *   self-attention block.
 *
 * All forecasters route their random initialization through `prng.js`
 * so that seeded experiments are reproducible.
 *
 * @see ../../tests/forecasting.tests.js for behavioral tests.
 * @see ../prng.js for the seeded mulberry32 random source.
 */

import {random} from '../prng.js';

/**
 * ARFIMA(p, d, q) forecaster factory.
 *
 * Returns a function that maps a history of `H` estimates to a
 * one-step-ahead forecast. The model is the canonical long-memory
 * combination of autoregressive, fractionally-integrated, and moving-
 * average components. Implementation steps:
 *
 * 1. If the history is shorter than `window`, fall back to its simple
 *    arithmetic mean.
 * 2. Take the last `window` samples and apply fractional differencing
 *    with parameter `d` via
 *
 *        (1 - L)^d X_t = sum_{k=0..L} binomial(d, k) (-1)^k X_{t - k}
 *
 *    using a capped lag of 50 to keep the per-step cost bounded.
 * 3. Add a small AR contribution (weights `0.3` per lag, capped at three
 *    lags) and a tiny MA correction.
 * 4. Clamp to `[0.01, 0.99]` so the forecast remains in the legal
 *    Hurst-parameter range.
 *
 * The forecaster weights are deliberately conservative defaults; the
 * goal here is a *demonstration* model rather than a state-of-the-art
 * fit.
 *
 * @param {Object} opts Model parameters.
 * @param {number=} opts.p AR order (default `1`).
 * @param {number=} opts.d Differencing parameter (default `0.3`).
 * @param {number=} opts.q MA order (default `1`).
 * @param {number=} opts.window Window size for rolling forecasts
 *   (default `100`).
 * @return {function(Array<number>): number} Forecasting function
 *   `history -> predicted H`.
 */
export function arfima(opts = {}) {
  const p = opts.p || 1;
  const d = opts.d || 0.3;
  const q = opts.q || 1;
  const windowSize = opts.window || 100;

  return function forecast(hHistory) {
    const n = hHistory.length;
    if (n < windowSize) {
      return hHistory.reduce((a, b) => a + b, 0) / n;
    }

    const recent = hHistory.slice(n - windowSize);
    const diffSeries = _fractionalDifference(recent, d);
    const diffLen = diffSeries.length;

    let prediction = 0;

    // AR contribution: a small lag-weighted sum of the fractionally
    // differenced series, capped at three lags so the model stays robust.
    for (let i = 0; i < Math.min(p, 3); i++) {
      const idx = diffLen - 1 - i;
      if (idx >= 0 && idx < diffLen) {
        prediction += 0.3 * diffSeries[idx];
      }
    }

    // MA contribution: simple lag-based correction against the raw
    // recent values.
    for (let i = 0; i < Math.min(q, 3); i++) {
      const idx = diffLen - 1 - i;
      if (idx >= 0 && idx < diffLen) {
        prediction += 0.1 * (recent[idx] - prediction);
      }
    }

    // Clamp to the legally valid H range to prevent runaway forecasts
    // from blowing past the optimizer bounds used downstream.
    return Math.max(0.01, Math.min(0.99, prediction));
  };
}

/**
 * Holt-Winters (level + trend) one-step-ahead forecast.
 *
 * The recursion updates a level `L_t` and trend `T_t` according to
 *
 *     L_t = alpha * X_t + (1 - alpha) * (L_{t-1} + T_{t-1})
 *     T_t = beta  * (L_t - L_{t-1}) + (1 - beta) * T_{t-1}
 *
 * then returns `L + T` as the forecast for the next observation. The
 * smoothing factors `alpha` and `beta` are interpreted as the standard
 * Holt (1957) hyperparameters.
 *
 * @param {Array<number>} series Non-empty input series.
 * @param {number} alpha Level smoothing factor in `[0, 1]` (default
 *   `0.3`).
 * @param {number} beta Trend smoothing factor in `[0, 1]` (default
 *   `0.1`).
 * @return {number} Forecast for the next observation.
 * @throws {Error} When `series` is empty or `alpha`/`beta` are outside
 *   `[0, 1]`.
 */
export function holtWintersForecast(series, alpha = 0.3, beta = 0.1) {
  if (!series || series.length === 0)
    throw new Error('series must be non-empty');
  if (alpha < 0 || alpha > 1) throw new Error('alpha must be in [0,1]');
  if (beta < 0 || beta > 1) throw new Error('beta must be in [0,1]');

  let level = series[0];
  let trend = series.length > 1 ? series[1] - series[0] : 0;

  for (let i = 1; i < series.length; i++) {
    const value = series[i];
    const newLevel = alpha * value + (1 - alpha) * (level + trend);
    const newTrend = beta * (newLevel - level) + (1 - beta) * trend;
    level = newLevel;
    trend = newTrend;
  }

  return level + trend;
}

/**
 * Xavier (Glorot-uniform) weight initialization using the seeded PRNG.
 *
 * Produces a `rows x cols` matrix where each entry is sampled uniformly
 * in `[-scale, scale]` with `scale = sqrt(2 / (rows + cols))`. This is the
 * standard initializer for tanh/sigmoid-activated layers (Glorot &
 * Bengio, 2010).
 *
 * @private
 * @param {number} rows Number of rows.
 * @param {number} cols Number of columns.
 * @return {Array<Array<number>>} Initialized weight matrix.
 */
function _xavierInit(rows, cols) {
  const scale = Math.sqrt(2.0 / (rows + cols));
  const arr = new Array(rows);
  for (let i = 0; i < rows; i++) {
    arr[i] = new Array(cols);
    for (let j = 0; j < cols; j++) {
      arr[i][j] = (random() * 2 - 1) * scale;
    }
  }
  return arr;
}

/**
 * Creates a minimal stateless LSTM-like recurrent cell for H
 * forecasting.
 *
 * This is a **demonstration** model rather than a fully trained LSTM:
 *
 * - The cell has four gates (`f`, `i`, `c~`, `o`) each driven by an
 *   independent Xavier-initialized projection `[inputSize + hiddenSize
 *   -> hiddenSize]`.
 * - Biases are initialized to zero.
 * - The cell is "stateless" in the sense that each call to `predict`
 *   starts from a zero hidden state and hidden-state at the end of the
 *   sequence is returned, not used as a recurrent seed.
 *
 * The intent is to provide an offline-illustrative model for
 * forecasting examples. Train weights externally by exposing the
 * returned `step` closure and running backprop.
 *
 * @param {Object} opts Architecture options.
 * @param {number=} opts.hiddenSize Hidden state dimension (default `16`).
 * @param {number=} opts.inputSize Input dimension (default `1`).
 * @return {{predict: function(Array<number>): Array<number>,
 *   step: function(number, Array<number>, Array<number>)}}
 *   A predictor with `predict(series)` returning the final hidden state.
 */
export function createLSTM(opts = {}) {
  const hiddenSize = opts.hiddenSize || 16;
  const inputSize = opts.inputSize || 1;

  const Wf = _xavierInit(hiddenSize, inputSize + hiddenSize);
  const Wi = _xavierInit(hiddenSize, inputSize + hiddenSize);
  const Wc = _xavierInit(hiddenSize, inputSize + hiddenSize);
  const Wo = _xavierInit(hiddenSize, inputSize + hiddenSize);
  const bf = new Array(hiddenSize).fill(0);
  const bi = new Array(hiddenSize).fill(0);
  const bc = new Array(hiddenSize).fill(0);
  const bo = new Array(hiddenSize).fill(0);

  const sigmoid = (x) => 1 / (1 + Math.exp(-x));
  const tanh = (x) => Math.tanh(x);

  const step = (x, hPrev, cPrev) => {
    const concat = [x, ...hPrev];
    const f = new Array(hiddenSize);
    const iGate = new Array(hiddenSize);
    const cTilde = new Array(hiddenSize);
    const o = new Array(hiddenSize);

    for (let j = 0; j < hiddenSize; j++) {
      let sumF = bf[j];
      let sumI = bi[j];
      let sumC = bc[j];
      let sumO = bo[j];
      for (let k = 0; k < concat.length; k++) {
        sumF += Wf[j][k] * concat[k];
        sumI += Wi[j][k] * concat[k];
        sumC += Wc[j][k] * concat[k];
        sumO += Wo[j][k] * concat[k];
      }
      f[j] = sigmoid(sumF);
      iGate[j] = sigmoid(sumI);
      cTilde[j] = tanh(sumC);
      o[j] = sigmoid(sumO);
    }

    const c = new Array(hiddenSize);
    const h = new Array(hiddenSize);
    for (let j = 0; j < hiddenSize; j++) {
      c[j] = f[j] * cPrev[j] + iGate[j] * cTilde[j];
      h[j] = o[j] * tanh(c[j]);
    }

    return {h, c};
  };

  return {
    predict: (series) => {
      if (!series || series.length === 0)
        throw new Error('series must be non-empty');
      let h = new Array(hiddenSize).fill(0);
      let c = new Array(hiddenSize).fill(0);
      for (const x of series) {
        const result = step(x, h, c);
        h = result.h;
        c = result.c;
      }
      return h;
    },
  };
}

/**
 * Creates a minimal stateless Transformer-style self-attention block for
 * `H` forecasting.
 *
 * The model projects each scalar input to a `hiddenSize`-dimensional
 * vector via a deterministic linear map (alternating signs and a small
 * bias), then runs a single head of scaled dot-product self-attention
 * over the resulting sequence and finally projects back via a learnable
 * matrix. The output is averaged across the sequence length so the
 * returned vector has fixed dimension.
 *
 * Note: `numHeads` is accepted for API symmetry with full Transformer
 * implementations but is intentionally unused here — this is a single-
 * head attention block.
 *
 * @param {Object} opts Architecture options.
 * @param {number=} opts.hiddenSize Hidden dimension (default `16`).
 * @param {number=} opts.numHeads Reserved for future multi-head
 *   support; not used in this minimal implementation.
 * @return {{predict: function(Array<number>): Array<number>}} Predictor
 *   with `predict(series)` returning the aggregated hidden vector.
 */
export function createAttentionModel(opts = {}) {
  const hiddenSize = opts.hiddenSize || 16;
  // numHeads is accepted for API compatibility but not used in this minimal implementation

  const Wq = _xavierInit(hiddenSize, hiddenSize);
  const Wk = _xavierInit(hiddenSize, hiddenSize);
  const Wv = _xavierInit(hiddenSize, hiddenSize);
  const WoAttn = _xavierInit(hiddenSize, hiddenSize);

  const softmax = (vec) => {
    const maxVal = Math.max(...vec);
    const exps = vec.map((v) => Math.exp(v - maxVal));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map((v) => v / sum);
  };

  const matVecMul = (mat, vec) => {
    const result = new Array(mat.length);
    for (let i = 0; i < mat.length; i++) {
      let sum = 0;
      for (let j = 0; j < vec.length; j++) {
        sum += mat[i][j] * vec[j];
      }
      result[i] = sum;
    }
    return result;
  };

  return {
    predict: (series) => {
      if (!series || series.length === 0)
        throw new Error('series must be non-empty');
      // Project each input to hidden dimension via a deterministic linear
      // projection: alternating coefficients and a small bias. This is
      // intentionally non-trainable here (the demonstration model has no
      // optimizer; users can swap in projections of their own design).
      const projected = series.map((x) => {
        const vec = new Array(hiddenSize);
        for (let i = 0; i < hiddenSize; i++) {
          vec[i] = x * (i % 2 === 0 ? 1 : 0.1) + i * 0.01;
        }
        return vec;
      });

      // Self-attention over the projected sequence.
      const queries = projected.map((p) => matVecMul(Wq, p));
      const keys = projected.map((p) => matVecMul(Wk, p));
      const values = projected.map((p) => matVecMul(Wv, p));

      const n = projected.length;
      const output = new Array(hiddenSize).fill(0);

      for (let i = 0; i < n; i++) {
        const scores = new Array(n);
        for (let j = 0; j < n; j++) {
          let dot = 0;
          for (let d = 0; d < hiddenSize; d++) {
            dot += queries[i][d] * keys[j][d];
          }
          // Scaled dot-product: dividing by sqrt(d_k) keeps the softmax
          // in its sensitive region regardless of hidden dimension.
          scores[j] = dot / Math.sqrt(hiddenSize);
        }
        const weights = softmax(scores);
        for (let j = 0; j < n; j++) {
          for (let d = 0; d < hiddenSize; d++) {
            output[d] += weights[j] * values[j][d];
          }
        }
      }

      // Final linear projection and average across sequence length.
      const result = matVecMul(WoAttn, output);
      for (let i = 0; i < hiddenSize; i++) {
        result[i] /= n;
      }
      return result;
    },
  };
}

/**
 * Caches the binomial-coefficient table indexed by `${d}:${lag}` keys.
 * Together with the bounded keyset below it implements a small FIFO
 * cache so repeated ARFIMA calls (e.g. inside rolling estimation) avoid
 * recomputing the same coefficients.
 *
 * @private
 */
const _binomialCache = new Map();
const _binomialCacheKeys = [];
const MAX_BINOMIAL_CACHE = 100;

/**
 * Returns the binomial coefficient sequence
 * `[binom(d, 0), binom(d, 1), ..., binom(d, lag)]` for fractional
 * differencing.
 *
 * Uses a tiny FIFO cache keyed by `${d}:${lag}` so that identical
 * lookups within a rolling ARFIMA run are `O(1)`. When the cache is
 * full the oldest entry is evicted.
 *
 * @private
 * @param {number} d Differencing parameter.
 * @param {number} lag Maximum lag (inclusive).
 * @return {Float64Array} Coefficient vector of length `lag + 1`.
 */
function _getBinomialCoeffs(d, lag) {
  const key = `${d}:${lag}`;
  let coeffs = _binomialCache.get(key);
  if (!coeffs) {
    coeffs = new Float64Array(lag + 1);
    coeffs[0] = 1;
    for (let k = 1; k <= lag; k++) {
      coeffs[k] = (coeffs[k - 1] * (d - k + 1)) / k;
    }
    if (
      _binomialCache.size >= MAX_BINOMIAL_CACHE &&
      _binomialCacheKeys.length > 0
    ) {
      const oldest = _binomialCacheKeys.shift();
      _binomialCache.delete(oldest);
    }
    _binomialCache.set(key, coeffs);
    _binomialCacheKeys.push(key);
  }
  return coeffs;
}

/**
 * Computes the (truncated) fractional difference
 *
 *     (1 - L)^d X_t = sum_{k=0..L} binom(d, k) (-1)^k X_{t - k}
 *
 * of a series for a given `d` and lag cap. The truncation to `lag` keeps
 * the per-step cost `O(lag)` rather than `O(t)`, which is essential for
 * long-history forecasting.
 *
 * @private
 * @param {Array<number>} data Input series.
 * @param {number} d Differencing parameter.
 * @param {number=} lag Maximum lag for the binomial expansion (default
 *   `50`).
 * @return {Array<number>} Fractionally differenced series.
 */
function _fractionalDifference(data, d, lag = 50) {
  const n = data.length;
  const result = new Array(n);

  // Precompute binomial coefficients (cached for repeated calls)
  const coeffs = _getBinomialCoeffs(d, lag);

  for (let t = 0; t < n; t++) {
    let sum = 0;
    let sign = 1;
    for (let k = 0; k <= Math.min(t, lag); k++) {
      sum += sign * coeffs[k] * data[t - k];
      sign = -sign;
    }
    result[t] = sum;
  }

  return result;
}
