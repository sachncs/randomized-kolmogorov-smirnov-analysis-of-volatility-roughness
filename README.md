# RK-SAVR: Randomized Kolmogorov–Smirnov Analysis of Volatility Roughness

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Build Status](https://github.com/your-repo/rksavr/actions/workflows/ci.yml/badge.svg)](https://github.com/your-repo/rksavr/actions/workflows/ci.yml)

A high-performance JavaScript implementation of the **RK-SAVR** algorithm for estimating the Hurst parameter ($H$) of rough volatility models, as described in the paper *"Randomized Kolmogorov–Smirnov Analysis of Volatility Roughness"* (arXiv:2509.20015v3).

## 📊 Overview

RK-SAVR is a distribution-based estimator that leverages the **Kolmogorov–Smirnov (KS) statistic** to assess the scaling behavior of volatility distributions. Unlike traditional moment-based methods, it is robust against non-linear biases and measurement errors common in financial time series.

### Key Features

- **Distributional Scaling**: Compares entire rescaled distributions of increments.
- **Random Permutation**: De-correlates serial dependence while preserving marginal distributions.
- **Multiple Optimizers**: Brent's Method, Nelder-Mead, Simulated Annealing, Differential Evolution, Adaptive Grid Search.
- **Variance Reduction**: Implements repeated subsampling and averaging ($K$-iterations).
- **Multi-Scale Analysis**: Vectorized scaling profile across $k$ scales with optional weights.
- **Synthetic Data Generation**: Built-in support for generating Fractional Brownian Motion (fBm) using Hosking's method.
- **Rough Volatility Model Zoo**: Simulators for rBergomi, rFSV, fOU, and MPRE processes.
- **Statistical Inference**: Asymptotic variance (Prop 2.9), bootstrap CIs, Kalman filtering, CUSUM break detection.
- **Noise Correction**: Preaveraging, realized kernel, bid-ask bounce correction, log-volatility de-biasing.
- **Forecasting**: ARFIMA, LSTM-like cells, and Transformer-style attention for H-prediction.

## 📂 Project Structure

```
/rksavr
├── lib/                     # Core Library
│   ├── rksavr.js            # Main RKSAVR class with multi-scale support
│   ├── stats.js             # KS distance and statistical utilities
│   ├── optimization.js     # Brent, Nelder-Mead, SA, DE, AGS
│   ├── inference.js         # Asymptotic variance, Kalman, CUSUM, breakpoints
│   ├── noise.js             # Microstructure noise correction
│   └── models/              # Rough Volatility Model Zoo
│       ├── rbergomi.js      # Rough Bergomi model
│       ├── rfsv.js         # Rough Fractional Stochastic Volatility
│       ├── fou.js          # Fractional Ornstein-Uhlenbeck
│       ├── mpre.js         # Multifractional Process with Random Exponent
│       ├── forecasting.js  # ARFIMA, LSTM, Attention forecasting
│       └── index.js        # Model exports
├── demo/                    # Interactive Web Demo
├── test/                    # Test suite
├── CHANGELOG.md             # Version history
└── README.md                # You are here
```

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16+)
- npm or yarn

### Installation

```bash
git clone https://github.com/your-repo/rksavr.git
cd rksavr
npm install
```

### Running the Demo

The demo provides an interactive dashboard to visualize synthetic volatility paths and real-time Hurst parameter estimation.

```bash
npm run dev
```
Then navigate to `http://localhost:5173`.

### Running Tests

```bash
npm test
```

## 💻 Library Usage

### Basic Estimation

```javascript
import { RKSAVR } from './lib/rksavr.js';

// Initialize with options
const rksavr = new RKSAVR({
    scaleA1: 1,      // Base scale
    scaleA2: 50,     // Upper scale
    sampleSize: 500, // T increments to sample
    iterations: 16    // K iterations for variance reduction
});

// Your log-volatility data
const data = [/* ... array of numbers ... */];

// Estimate Hurst parameter for a single window
const hEstimate = rksavr.estimate(data);
console.log(`Estimated H: ${hEstimate}`);
```

### Rolling Window Analysis

```javascript
// Rolling estimation with progress callback
const windowSize = 512;
const step = 20;
const results = rksavr.rolling(data, windowSize, step, (progress) => {
    console.log(`Progress: ${(progress * 100).toFixed(1)}%`);
});
// results => [{ t: 0, H: 0.12 }, { t: 20, H: 0.14 }, ...]
```

### Multi-Scale Analysis

```javascript
const rksavrMulti = new RKSAVR({
    scales: [1, 2, 5, 10, 20, 50],
    weights: [1.0, 0.8, 0.6, 0.4, 0.2, 0.1],
    sampleSize: 500,
    iterations: 8
});

const multiResults = rksavrMulti.rollingMultiScale(
    data, 512, [1, 2, 5, 10, 20, 50], [1, 0.8, 0.6, 0.4, 0.2, 0.1], 20
);
// multiResults => [{ t: 0, H: 0.12, profile: [...] }, ...]
```

### Choosing an Optimizer

```javascript
const rksavrDe = new RKSAVR({
    scaleA1: 1,
    scaleA2: 50,
    optimizerType: 'de',  // 'brent', 'nelder-mead', 'annealing', 'de', 'ags'
    iterations: 16
});
```

### Statistical Inference

```javascript
import { asymptoticVariance, confidenceInterval, kalmanFilter, cusumTest } from './lib/inference.js';

// Compute asymptotic variance (Prop 2.9)
const varH = asymptoticVariance(1, 50, 500, 500);
const se = Math.sqrt(varH);

// Confidence interval
const ci = confidenceInterval(0.12, 1, 50, 500, 500, 0.05);

// Kalman-filtered H estimates
const filtered = kalmanFilter(hHistory, { q: 0.01, r: 0.1 });

// CUSUM break detection
const cusumResult = cusumTest(hHistory, 0.5, threshold = 3.0);
```

### Rough Volatility Models

```javascript
import { rBergomi, rFSV, fOU, mpre } from './lib/models/index.js';

// Generate rough Bergomi paths
const { paths, times } = rBergomi({
    nPaths: 100,
    nSteps: 252,
    h: 0.1,
    eta: 2.0,
    rho: -0.8,
});

// Generate rFSV volatility
const { volPath } = rFSV({
    nSteps: 252,
    h: 0.1,
    theta: 2.0,
    mu: 0.04,
    nu: 0.5,
});

// Fractional Ornstein-Uhlenbeck
const { path } = fOU({
    nSteps: 252,
    h: 0.3,
    theta: 1.0,
    mu: 0.0,
    sigma: 1.0,
});

// MPRE (H varies over time)
const { path, hPath } = mpre({
    nSteps: 252,
    hMin: 0.05,
    hMax: 0.95,
    h0: 0.1,
});
```

### H-Forecasting

```javascript
import { arfima, holtWintersForecast, createLSTM } from './lib/models/forecasting.js';

// ARFIMA forecasting
const forecastFn = arfima(hHistory, { p: 1, d: 0.3, q: 1 });
const predictedH = forecastFn(hHistory);

// Holt-Winters exponential smoothing
const nextH = holtWintersForecast(hHistory, alpha = 0.3, beta = 0.1);

// LSTM-like model
const lstm = createLSTM({ hiddenSize: 16 });
const hidden = lstm.predict(hHistory);
```

### Noise Correction

```javascript
import { preavgReturns, realizedKernel, logVolDebias } from './lib/noise.js';

// Preaveraging for microstructure noise
const correctedReturns = preavgReturns(prices, windowSize = 2);

// Realized kernel volatility
const rv = realizedKernel(returns, 'bartlett');

// Log-volatility de-biasing
const debiasedH = logVolDebias(rawHEstimates, sigmaObs, sigmaLatent);
```

## 🧠 Methodology

1.  **Segmentation**: Partition series into overlapping windows.
2.  **Increments**: Compute $Z_{t,a} = X_{t+a} - X_t$ at scales $a_1$ and $a_2$.
3.  **Permutation**: Randomly sample $T$ increments to remove temporal correlation.
4.  **Rescaling**: Rescale increments by $a^{-H}$.
5.  **KS Minimization**: Find $H \in (0, 1]$ that minimizes $\sup_x | \Phi_{1,n}(x) - \Phi_{2,m}(x, H) |$.
6.  **Variance Reduction**: Average over $K$ independent iterations.

## 🧪 Testing

```bash
npm test
```

Tests use Node's built-in test runner. Run tests for any module:

```bash
node --test test/rksavr.test.js
node --test test/models/rbergomi.test.js
```

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This is an **independent implementation** of the RK-SAVR algorithm described in the paper *"Randomized Kolmogorov–Smirnov Analysis of Volatility Roughness"* (arXiv:2509.20015v3) by Angelini & Bianchi. The author of this code is not affiliated with the paper's authors. This implementation is provided as-is for research and educational purposes. Please cite the original paper when using this library in academic work.

## 🔗 References

- Bianchi, M. (2004). *A new distribution-based estimator of the self-similarity parameter*.
- Angelini & Bianchi (2025). *Randomized Kolmogorov–Smirnov Analysis of Volatility Roughness*. [arXiv:2509.20015v3](https://arxiv.org/abs/2509.20015v3)
- Bayer, Friz, Gatheral (2016). *Roughing it up: Connecting rough volatility with option pricing*.