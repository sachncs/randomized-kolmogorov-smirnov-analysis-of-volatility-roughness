/**
 * H-Forecasting module for predicting future volatility roughness.
 * Includes ARFIMA models and simple neural network approaches.
 *
 * Google JS Style Guide compliant.
 */

import {random} from '../prng.js';

/**
 * ARFIMA(p, d, q) model for fractional differencing.
 *
 * The ARFIMA model combines autoregressive (AR) and moving average (MA)
 * terms with fractional differencing (d) to capture long-memory processes.
 *
 * @param {Object} opts Model parameters.
 * @param {number} opts.p AR order.
 * @param {number} opts.d Differencing parameter (fractional).
 * @param {number} opts.q MA order.
 * @param {number} opts.window Window size for rolling forecasts.
 * @return {function(Array<number>): number} Forecasting function.
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

    // AR component
    for (let i = 0; i < Math.min(p, 3); i++) {
      const idx = diffLen - 1 - i;
      if (idx >= 0 && idx < diffLen) {
        prediction += 0.3 * diffSeries[idx];
      }
    }

    // MA component (simple lag-based)
    for (let i = 0; i < Math.min(q, 3); i++) {
      const idx = diffLen - 1 - i;
      if (idx >= 0 && idx < diffLen) {
        prediction += 0.1 * (recent[idx] - prediction);
      }
    }

    return Math.max(0.01, Math.min(0.99, prediction));
  };
}

/**
 * Holt-Winters exponential smoothing forecast.
 *
 * @param {Array<number>} series Input time series.
 * @param {number} alpha Level smoothing factor (default 0.3).
 * @param {number} beta Trend smoothing factor (default 0.1).
 * @return {number} One-step ahead forecast.
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
 * Xavier weight initialization using the seeded PRNG.
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
 * Creates a minimal LSTM-like recurrent cell for H forecasting.
 * Stateless: processes a full sequence and produces a hidden state.
 *
 * @param {Object} opts
 * @param {number} opts.hiddenSize Hidden state dimension (default 16).
 * @param {number} opts.inputSize Input dimension (default 1).
 * @return {{predict: function(Array<number>): Array<number>}} LSTM-like predictor.
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
 * Creates a minimal Transformer-style attention model for H forecasting.
 * Stateless: processes a full sequence and produces an aggregated hidden state.
 *
 * @param {Object} opts
 * @param {number} opts.hiddenSize Hidden dimension (default 16).
 * @param {number} opts.numHeads Number of attention heads (default 4).
 * @return {{predict: function(Array<number>): Array<number>}} Attention predictor.
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
      // Project each input to hidden dimension via simple linear projection
      const projected = series.map((x) => {
        const vec = new Array(hiddenSize);
        for (let i = 0; i < hiddenSize; i++) {
          vec[i] = x * (i % 2 === 0 ? 1 : 0.1) + i * 0.01;
        }
        return vec;
      });

      // Self-attention over the projected sequence
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
          scores[j] = dot / Math.sqrt(hiddenSize);
        }
        const weights = softmax(scores);
        for (let j = 0; j < n; j++) {
          for (let d = 0; d < hiddenSize; d++) {
            output[d] += weights[j] * values[j][d];
          }
        }
      }

      // Final linear projection and average across sequence length
      const result = matVecMul(WoAttn, output);
      for (let i = 0; i < hiddenSize; i++) {
        result[i] /= n;
      }
      return result;
    },
  };
}

/**
 * Computes fractional difference of a series.
 * (1-L)^d X_t = sum_{k=0}^{infty} binomial(d, k) (-1)^k X_{t-k}
 *
 * @param {Array<number>} data Input series.
 * @param {number} d Differencing parameter.
 * @param {number} lag Maximum lag for approximation.
 * @return {Array<number>} Fractionally differenced series.
 */
const _binomialCache = new Map();
const _binomialCacheKeys = [];
const MAX_BINOMIAL_CACHE = 100;

/**
 * Computes (or retrieves cached) binomial coefficients for fractional differencing.
 * @param {number} d Differencing parameter.
 * @param {number} lag Maximum lag.
 * @return {Float64Array} Binomial coefficients.
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
 * Computes fractional difference of a series.
 * @param {Array<number>} data Input series.
 * @param {number} d Differencing parameter.
 * @param {number} lag Maximum lag for approximation.
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
