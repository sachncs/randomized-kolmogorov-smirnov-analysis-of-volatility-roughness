/**
 * H-Forecasting module for predicting future volatility roughness.
 * Includes ARFIMA models and simple neural network approaches.
 *
 * Google JS Style Guide compliant.
 */

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
    const diffSeries = fractionalDifference(recent, d);
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
 * Computes fractional difference of a series.
 * (1-L)^d X_t = sum_{k=0}^{infty} binomial(d, k) (-1)^k X_{t-k}
 *
 * @param {Array<number>} data Input series.
 * @param {number} d Differencing parameter.
 * @param {number} lag Maximum lag for approximation.
 * @return {Array<number>} Fractionally differenced series.
 */
const _binomialCache = new Map();

function getBinomialCoeffs(d, lag) {
  const key = `${d}:${lag}`;
  let coeffs = _binomialCache.get(key);
  if (!coeffs) {
    coeffs = new Float64Array(lag + 1);
    coeffs[0] = 1;
    for (let k = 1; k <= lag; k++) {
      coeffs[k] = coeffs[k - 1] * (d - k + 1) / k;
    }
    _binomialCache.set(key, coeffs);
  }
  return coeffs;
}

export function fractionalDifference(data, d, lag = 50) {
  const n = data.length;
  const result = new Array(n);

  // Precompute binomial coefficients (cached for repeated calls)
  const coeffs = getBinomialCoeffs(d, lag);

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

/**
 * LSTM-like cell for H prediction.
 * @param {Object} params Model parameters.
 * @param {number} params.hiddenSize Hidden layer size.
 * @param {number} params.inputSize Input size (default 1).
 * @return {Object} LSTM model with predict method.
 */
export function createLSTM(params = {}) {
  const hiddenSize = params.hiddenSize || 16;
  const inputSize = params.inputSize || 1;

  const Wi = xavierInit(inputSize, hiddenSize);
  const Wh = xavierInit(hiddenSize, hiddenSize);
  const bi = new Float64Array(hiddenSize).fill(0.01);
  const bf = new Float64Array(hiddenSize).fill(0.5);
  const bo = new Float64Array(hiddenSize).fill(0.01);
  const bc = new Float64Array(hiddenSize).fill(0.01);

  const hState = new Float64Array(hiddenSize).fill(0);
  const cState = new Float64Array(hiddenSize).fill(0);

  function sigmoid(x) {
    return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
  }

  function predict(inputs) {
    const n = inputs.length;
    hState.fill(0);
    cState.fill(0);

    for (let t = 0; t < n; t++) {
      const x = Array.isArray(inputs[t]) ? inputs[t] : [inputs[t]];
      const hiddenInput = new Float64Array(hiddenSize);

      for (let j = 0; j < hiddenSize; j++) {
        let sum = bi[j];
        for (let i = 0; i < inputSize; i++) {
          sum += x[i || 0] * Wi[i][j];
        }
        for (let i = 0; i < hiddenSize; i++) {
          sum += hState[i] * Wh[i][j];
        }
        hiddenInput[j] = sum;
      }

      const iGate = new Float64Array(hiddenSize);
      const fGate = new Float64Array(hiddenSize);
      const oGate = new Float64Array(hiddenSize);
      const cTilde = new Float64Array(hiddenSize);

      for (let j = 0; j < hiddenSize; j++) {
        iGate[j] = sigmoid(hiddenInput[j]);
        fGate[j] = sigmoid(hiddenInput[j] + bf[j]);
        oGate[j] = sigmoid(hiddenInput[j] + bo[j]);
        cTilde[j] = Math.tanh(hiddenInput[j] + bc[j]);
      }

      for (let j = 0; j < hiddenSize; j++) {
        cState[j] = fGate[j] * cState[j] + iGate[j] * cTilde[j];
        hState[j] = oGate[j] * Math.tanh(cState[j]);
      }
    }

    return Array.from(hState);
  }

  function reset() {
    hState.fill(0);
    cState.fill(0);
  }

  return {predict, reset, getHidden: () => Array.from(hState)};
}

/**
 * Xavier initialization for neural network weights.
 * @param {number} fanIn Input dimension.
 * @param {number} fanOut Output dimension.
 * @return {Array<Array<number>>} Weight matrix.
 */
function xavierInit(fanIn, fanOut) {
  const scale = Math.sqrt(2.0 / (fanIn + fanOut));
  const matrix = [];
  for (let i = 0; i < fanIn; i++) {
    matrix[i] = [];
    for (let j = 0; j < fanOut; j++) {
      matrix[i][j] = (Math.random() - 0.5) * 2 * scale;
    }
  }
  return matrix;
}

/**
 * Simple attention model for H forecasting.
 * @param {Object} params Model parameters.
 * @param {number} params.embedSize Embedding dimension.
 * @return {Object} Attention model.
 */
export function createAttentionModel(params = {}) {
  const embedSize = params.embedSize || 32;

  const Wq = xavierInit(1, embedSize);
  const Wv = xavierInit(1, embedSize);
  const Wo = xavierInit(embedSize, 1);

  function softmax(arr) {
    const max = Math.max(...arr);
    const exp = arr.map((x) => Math.exp(x - max));
    const sumExp = exp.reduce((a, b) => a + b, 0);
    return exp.map((x) => x / sumExp);
  }

  function predict(inputs) {
    const n = inputs.length;
    if (n === 0) return 0.5;

    const queries = new Array(n);
    const values = new Array(n);
    for (let t = 0; t < n; t++) {
      const x = Array.isArray(inputs[t]) ? inputs[t][0] : inputs[t];
      queries[t] = new Float64Array(embedSize);
      values[t] = new Float64Array(embedSize);
      for (let j = 0; j < embedSize; j++) {
        queries[t][j] = x * Wq[0][j];
        values[t][j] = x * Wv[0][j];
      }
    }

    const scores = new Array(n);
    for (let t = 0; t < n; t++) {
      scores[t] = new Float64Array(n);
      for (let s = 0; s < n; s++) {
        let dot = 0;
        for (let j = 0; j < embedSize; j++) {
          dot += queries[t][j] * queries[s][j];
        }
        scores[t][s] = dot / Math.sqrt(embedSize);
      }
    }

    const weights = scores.map((row) => softmax(Array.from(row)));

    const output = new Float64Array(embedSize).fill(0);
    for (let t = 0; t < n; t++) {
      for (let j = 0; j < embedSize; j++) {
        output[j] += weights[t][t] * values[t][j];
      }
    }

    let prediction = 0;
    for (let j = 0; j < embedSize; j++) {
      prediction += output[j] * Wo[j][0];
    }

    return Math.max(0.01, Math.min(0.99, prediction));
  }

  return {predict};
}

/**
 * Rolling forecast using Holt-Winters exponential smoothing.
 * @param {Array<number>} hHistory Historical H values.
 * @param {number} alpha Smoothing for level.
 * @param {number} beta Smoothing for trend.
 * @return {number} Next H prediction.
 */
export function holtWintersForecast(hHistory, alpha = 0.3, beta = 0.1) {
  const n = hHistory.length;
  if (n === 0) return 0.5;
  if (n === 1) return hHistory[0];

  let level = hHistory[0];
  let trend = hHistory[1] - hHistory[0];

  for (let i = 1; i < n; i++) {
    const prevLevel = level;
    level = alpha * hHistory[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  return Math.max(0.01, Math.min(0.99, level + trend));
}