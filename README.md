# RK-SAVR: Randomized Kolmogorov-Smirnov Analysis of Volatility Roughness

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/sachn-cs/randomized-kolmogorov-smirnov-analysis-of-volatility-roughness/actions/workflows/ci.yml/badge.svg)](https://github.com/sachn-cs/randomized-kolmogorov-smirnov-analysis-of-volatility-roughness/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/rksavr.svg)](https://www.npmjs.com/package/rksavr)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.x-brightgreen.svg)](https://nodejs.org/)
[![GitHub stars](https://img.shields.io/github/stars/sachn-cs/randomized-kolmogorov-smirnov-analysis-of-volatility-roughness.svg)](https://github.com/sachn-cs/randomized-kolmogorov-smirnov-analysis-of-volatility-roughness/stargazers)

A high-performance JavaScript implementation of the **RK-SAVR** algorithm for estimating the Hurst parameter (H) of rough volatility models, as described in the paper *"Randomized Kolmogorov-Smirnov Analysis of Volatility Roughness"* (arXiv:2509.20015v3).

## Features

- **Distributional Scaling**: Compares entire rescaled distributions of increments
- **Block Random Permutation**: De-correlates serial dependence while preserving marginal distributions
- **Multiple Optimizers**: Brent's Method, Nelder-Mead, Simulated Annealing, Differential Evolution, Adaptive Grid Search
- **Variance Reduction**: Implements repeated subsampling and averaging (K-iterations)
- **Multi-Scale Analysis**: Vectorized scaling profile across k scales with optional weights
- **Synthetic Data Generation**: Built-in support for generating Fractional Brownian Motion (fBm) using Hosking's method
- **Rough Volatility Model Zoo**: Simulators for rBergomi, rFSV, fOU, and MPRE processes
- **Statistical Inference**: Asymptotic variance, confidence intervals, KS significance testing, Kalman filtering, CUSUM break detection, constancy test, bootstrap CIs
- **Noise Correction**: Preaveraging, realized kernel, bid-ask bounce correction, log-volatility de-biasing
- **Forecasting**: ARFIMA, LSTM-like cells, and Transformer-style attention for H-prediction
- **Zero Runtime Dependencies**: Pure JavaScript implementation with no external dependencies

## Installation

```bash
# Install from npm
npm install rksavr

# Or clone and install from source
git clone https://github.com/sachn-cs/randomized-kolmogorov-smirnov-analysis-of-volatility-roughness.git
cd randomized-kolmogorov-smirnov-analysis-of-volatility-roughness
npm install
```

## Quick Start

```javascript
import { RKSAVR } from 'rksavr';

// Initialize estimator
const rksavr = new RKSAVR({
  scaleA1: 1,      // Lower scale
  scaleA2: 50,     // Upper scale
  sampleSize: 500, // Increments to sample
  iterations: 16   // Variance reduction iterations
});

// Your log-volatility data
const data = [/* ... */];

// Estimate Hurst parameter
const hEstimate = rksavr.estimate(data);
console.log(`Estimated H: ${hEstimate}`);
```

## Usage

### Basic Estimation

```javascript
import { RKSAVR } from 'rksavr';

const rksavr = new RKSAVR({
  scaleA1: 1,
  scaleA2: 50,
  sampleSize: 500,
  iterations: 16
});

const hEstimate = rksavr.estimate(data);
```

### Block Random Permutation (Paper-Faithful)

```javascript
const rksavr = new RKSAVR({
  scaleA1: 1,
  scaleA2: 50,
  blockSize: 16,   // Block length for random permutation
  sampleSize: 500,
  iterations: 16
});
```

### Rolling Window Analysis

```javascript
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
import {
  asymptoticVariance,
  confidenceInterval,
  kalmanFilter,
  cusumTest,
  constancyTest,
  bootstrapCI
} from 'rksavr';

// Compute asymptotic variance (Prop 2.9)
const varH = asymptoticVariance(1, 50, 500, 500);

// Confidence interval
const ci = confidenceInterval(0.12, 1, 50, 500, 500, 0.05);

// Kalman-filtered H estimates
const filtered = kalmanFilter(hHistory, { q: 0.01, r: 0.1 });

// Bootstrap confidence interval
const bootstrap = bootstrapCI((w) => rksavr.estimate(w), data, 1000, 0.05);
```

### Rough Volatility Models

```javascript
import { rBergomi, rFSV, fOU, mPRE } from 'rksavr';

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
const { path, hPath } = mPRE({
  nSteps: 252,
  hMin: 0.05,
  hMax: 0.95,
  h0: 0.1,
});
```

### H-Forecasting

```javascript
import { arfima, holtWintersForecast, createLSTM } from 'rksavr';

// ARFIMA forecasting
const forecastFn = arfima({ p: 1, d: 0.3, q: 1, window: 50 });
const predictedH = forecastFn(hHistory);

// Holt-Winters exponential smoothing
const nextH = holtWintersForecast(hHistory, 0.3, 0.1);

// LSTM-like model
const lstm = createLSTM({ hiddenSize: 16 });
const hidden = lstm.predict(hHistory);
```

### Noise Correction

```javascript
import { preavgReturns, realizedKernel, logVolDebias } from 'rksavr';

// Preaveraging for microstructure noise
const correctedReturns = preavgReturns(prices, 2);

// Realized kernel volatility
const rv = realizedKernel(returns, 'bartlett');

// Log-volatility de-biasing
const debiasedH = logVolDebias(rawHEstimates, sigmaObs, sigmaLatent);
```

## Configuration

### Environment Variables

No environment variables are required for core library usage. See `.env.example` for development configuration.

### RKSAVR Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scaleA1` | `number` | `1` | Lower scale for increment computation |
| `scaleA2` | `number` | `50` | Upper scale for increment computation |
| `sampleSize` | `number` | `500` | Number of increments to sample per scale |
| `iterations` | `number` | `16` | Number of K iterations for variance reduction |
| `blockSize` | `number` | `16` | Block length for random permutation |
| `optimizerType` | `string` | `'brent'` | Optimizer selection |
| `hMin` | `number` | `0.01` | Minimum Hurst parameter bound |
| `hMax` | `number` | `0.99` | Maximum Hurst parameter bound |

### Optimizer Options

| Optimizer | Key | Best For |
|-----------|-----|----------|
| Brent's Method | `'brent'` | 1D smooth functions (default) |
| Nelder-Mead | `'nelder-mead'` | Multi-dimensional problems |
| Simulated Annealing | `'annealing'` | Global optimization |
| Differential Evolution | `'de'` | Population-based search |
| Adaptive Grid Search | `'ags'` | Coarse-to-fine refinement |

## Project Structure

```
rksavr/
├── lib/                     # Core Library
│   ├── index.js             # Central export hub
│   ├── rksavr.js            # Main RKSAVR class with multi-scale support
│   ├── stats.js             # KS distance, block permutation, sampling
│   ├── optimization/        # Brent, Nelder-Mead, SA, DE, AGS
│   ├── inference/           # Asymptotic variance, Kalman, CUSUM, bootstrap
│   ├── data/                # Data loading and preprocessing
│   ├── models/              # Rough Volatility Model Zoo
│   │   ├── rbergomi.js      # Rough Bergomi model
│   │   ├── rfsv.js          # Rough Fractional Stochastic Volatility
│   │   ├── fou.js           # Fractional Ornstein-Uhlenbeck
│   │   ├── mpre.js          # Multifractional Process with Random Exponent
│   │   ├── forecasting.js   # ARFIMA, LSTM, Attention forecasting
│   │   └── index.js         # Model exports
│   ├── random.js            # fBm, fGn generation
│   ├── prng.js              # Seeded PRNG (mulberry32)
│   ├── logger.js            # Logging framework
│   └── fbm.js               # Fractional Brownian motion utilities
├── demo/                    # Interactive Web Demo
├── tests/                   # Test suite (Mocha + Chai)
├── docs/                    # Generated documentation
├── .github/                 # CI/CD workflows and templates
├── scripts/                 # Setup and cleanup scripts
├── CHANGELOG.md             # Version history
├── CONTRIBUTING.md          # Contributing guidelines
├── CODE_OF_CONDUCT.md       # Code of conduct
├── SECURITY.md              # Security policy
├── LICENSE                  # MIT License
└── README.md                # This file
```

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm or yarn

### Commands

```bash
# Install dependencies
npm install

# Development server (demo)
npm run dev

# Linting
npm run lint           # Check for issues
npm run lint:fix       # Auto-fix issues

# Testing
npm test               # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # Generate coverage report

# Building
npm run build          # Build ESM, CJS, and IIFE bundles
npm run docs           # Generate JSDoc HTML and API.md
npm run build:full     # Build docs and bundles

# Utilities
npm run setup          # Run setup script
npm run cleanup        # Run cleanup script
```

### Running the Demo

The demo provides an interactive dashboard to visualize synthetic volatility paths and real-time Hurst parameter estimation.

```bash
npm run dev
```

Then navigate to `http://localhost:5173`.

## Tech Stack

- **Language**: JavaScript (ES2022+)
- **Module System**: ES Modules with CommonJS support
- **Build Tool**: Rollup with Babel
- **Test Framework**: Mocha + Chai
- **Coverage**: c8
- **Linting**: ESLint (Google style) + Prettier
- **Documentation**: JSDoc + jsdoc-to-markdown
- **CI/CD**: GitHub Actions
- **Demo**: Vite + Chart.js + Plotly.js

## Testing

```bash
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

## Building

```bash
npm run build           # Build ESM, CJS, and IIFE bundles
npm run docs            # Generate JSDoc HTML and API.md
```

## Publishing

```bash
npm run build:full      # Build docs and bundles
npm publish --dry-run   # Validate package contents
npm publish             # Publish to npm
```

## Methodology

1. **Segmentation**: Partition series into overlapping windows.
2. **Increments**: Compute Z_{t,a} = X_{t+a} - X_t at scales a_1 and a_2.
3. **Block Permutation**: Randomly permute blocks of increments to remove temporal correlation.
4. **Subsampling**: Sample T increments per scale.
5. **Rescaling**: Rescale increments by a^{-H}.
6. **KS Minimization**: Find H in (0, 1] that minimizes the KS distance.
7. **Variance Reduction**: Average over K independent iterations.

## Roadmap

- [ ] TypeScript declarations for API consumers
- [ ] CLI tool for batch processing CSV files
- [ ] Streaming estimator for online H estimation
- [ ] WebSocket demo for real-time visualization
- [ ] Integration with real-world datasets (VIX, S&P 500 RV)
- [ ] Process noise estimation for Kalman filter
- [ ] Heteroskedasticity-robust standard errors
- [ ] Adaptive scale selection based on window size

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, branch naming, commit conventions, and the pull request process.

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Security

For security issues, please see [SECURITY.md](SECURITY.md). Please do NOT report security vulnerabilities through public GitHub issues.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This is an **independent implementation** of the RK-SAVR algorithm described in the paper *"Randomized Kolmogorov-Smirnov Analysis of Volatility Roughness"* (arXiv:2509.20015v3) by Angelini & Bianchi. The author of this code is not affiliated with the paper's authors. This implementation is provided as-is for research and educational purposes. Please cite the original paper when using this library in academic work.

## References

- Bianchi, M. (2004). *A new distribution-based estimator of the self-similarity parameter*.
- Angelini & Bianchi (2025). *Randomized Kolmogorov-Smirnov Analysis of Volatility Roughness*. [arXiv:2509.20015v3](https://arxiv.org/abs/2509.20015v3)
- Bayer, Friz, Gatheral (2016). *Roughing it up: Connecting rough volatility with option pricing*.
