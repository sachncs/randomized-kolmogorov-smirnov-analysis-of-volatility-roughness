# RK-SAVR: Randomized Kolmogorov–Smirnov Analysis of Volatility Roughness

[![Paper](https://img.shields.io/badge/arXiv-2509.20015v3-B31B1B.svg)](https://arxiv.org/abs/2509.20015v3)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A high-performance JavaScript implementation of the **RK-SAVR** algorithm for estimating the Hurst parameter ($H$) of rough volatility models, as described in the paper *"Randomized Kolmogorov–Smirnov Analysis of Volatility Roughness"* (arXiv:2509.20015v3).

## 📊 Overview

RK-SAVR is a distribution-based estimator that leverages the **Kolmogorov–Smirnov (KS) statistic** to assess the scaling behavior of volatility distributions. Unlike traditional moment-based methods, it is robust against non-linear biases and measurement errors common in financial time series.

### Key Features

- **Distributional Scaling**: Compares entire rescaled distributions of increments.
- **Random Permutation**: De-correlates serial dependence while preserving marginal distributions.
- **Efficient Optimization**: Uses **Brent's Method** for derivative-free 1D minimization of the KS distance.
- **Variance Reduction**: Implements repeated subsampling and averaging ($K$-iterations).
- **Synthetic Data Generation**: Built-in support for generating Fractional Brownian Motion (fBm) using Hosking's method.

## 📂 Project Structure

```text
/rksavr
├── lib/               # Core Library
│   ├── rksavr.js      # Main RKSAVR class
│   ├── stats.js       # KS distance and statistical utilities
│   ├── optimization.js# Brent's method implementation
│   └── fbm.js         # fBm/fGN synthetic data generation
├── demo/              # Interactive Web Demo
│   ├── index.html     # Dashboard layout
│   ├── main.js        # UI logic and Chart.js integration
│   └── style.css      # Premium dark-mode styling
├── package.json       # Dependencies and scripts
└── README.md          # You are here
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

## 💻 Library Usage

You can use the library to analyze your own time series data:

```javascript
import { RKSAVR } from './lib/rksavr.js';

// 1. Initialize with options
const rksavr = new RKSAVR({
    scaleA1: 1,      // Base scale
    scaleA2: 50,     // Upper scale
    sampleSize: 500, // T increments to sample
    iterations: 16   // K iterations for variance reduction
});

// 2. Your log-volatility data
const data = [/* ... array of numbers ... */];

// 3. Estimate Hurst parameter for a single window
const hEstimate = rksavr.estimate(data);
console.log(`Estimated H: ${hEstimate}`);

// 4. Or perform a rolling window analysis
const windowSize = 512;
const step = 20;
const results = rksavr.rolling(data, windowSize, step);
// results => [{ t: 0, H: 0.12 }, { t: 20, H: 0.14 }, ...]
```

## 🧠 Methodology

1.  **Segmentation**: Partition series into overlapping windows.
2.  **Increments**: Compute $Z_{t,a} = X_{t+a} - X_t$ at scales $a_1$ and $a_2$.
3.  **Permutation**: Randomly sample $T$ increments to remove temporal correlation.
4.  **Rescaling**: Rescale increments by $a^{-H}$.
5.  **KS Minimization**: Find $H \in (0, 1]$ that minimizes $\sup_x | \Phi_{1,n}(x) - \Phi_{2,m}(x, H) |$.

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 References

- Bianchi, M. (2004). *A new distribution-based estimator of the self-similarity parameter*.
- Angelini & Bianchi (2025). *Randomized Kolmogorov–Smirnov Analysis of Volatility Roughness*. [arXiv:2509.20015v3](https://arxiv.org/abs/2509.20015v3)
