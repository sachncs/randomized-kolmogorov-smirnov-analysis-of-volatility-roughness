# Architecture Guide

This document describes the high-level architecture of the RK-SAVR library.

## Overview

RK-SAVR is a modular JavaScript library for estimating the Hurst parameter of rough volatility models. The codebase follows a clean separation of concerns with distinct modules for core estimation, statistics, optimization, inference, and data generation.

## Module Structure

```
lib/
├── index.js              # Central export hub
├── rksavr.js             # Main RKSAVR class
├── stats.js              # Statistical utilities (KS distance, sampling)
├── optimization/         # Multiple optimizer implementations
├── inference/            # Statistical inference (variance, filtering)
├── data/                 # Data loading and preprocessing
├── models/               # Rough volatility model simulators
├── random.js             # Random number generation (fBm, fGn)
├── prng.js               # Seeded PRNG (mulberry32)
├── logger.js             # Logging framework
├── fbm.js                # Fractional Brownian motion utilities
└── data/                 # Data utilities
```

## Core Components

### RKSAVR Class (`lib/rksavr.js`)

The main estimator class that orchestrates the entire estimation pipeline:

1. **Increment Computation**: Extracts increments at two scales (Z_{t,a} = X_{t+a} - X_t)
2. **Block Permutation**: Decorrelates serial dependence while preserving marginal distributions
3. **Subsampling**: Samples T increments per scale
4. **Rescaling**: Rescales increments by a^{-H}
5. **KS Minimization**: Finds H that minimizes the KS distance
6. **Variance Reduction**: Averages over K independent iterations

**Key Methods:**
- `estimate(data)` - Single-window estimation
- `rolling(data, windowSize, step, progressCb)` - Rolling window estimation
- `rollingMultiScale(...)` - Multi-scale rolling estimation
- `estimateSingleWithDiagnostics(data)` - Returns H and minimized KS distance

### Statistics (`lib/stats.js`)

Provides core statistical functions:

- `ksDistance(sample1, sample2)` - Two-sample KS distance
- `ksDistanceRescaled(sortedA, sortedB, factorA, factorB)` - Zero-allocation rescaled KS
- `shuffle(array)` - Fisher-Yates shuffle
- `blockPermutation(data, blockSize)` - Block random permutation
- `randomSample(array, n)` - Floyd's reservoir sampling

### Optimization (`lib/optimization/`)

Multiple optimization algorithms for KS distance minimization:

| Optimizer | Use Case | Complexity |
|-----------|----------|------------|
| Brent's Method | 1D smooth functions | O(1) iterations |
| Nelder-Mead | Multi-dimensional | O(n) per iteration |
| Simulated Annealing | Global optimization | O(n * maxIter) |
| Differential Evolution | Population-based | O(popSize * maxIter) |
| Adaptive Grid Search | Coarse-to-fine | O(gridSize + refineIters) |

**Registry Pattern:** Optimizers are registered via `registerOptimizerFactory()` and retrieved via `getOptimizerFactory()`.

### Inference (`lib/inference/`)

Statistical inference for uncertainty quantification:

- **Asymptotic Variance** (`asymptotic.js`): Proposition 2.9 formula
- **Confidence Intervals** (`asymptotic.js`): Based on asymptotic normality
- **Kalman Filtering** (`filtering.js`): State-space modeling of H(t)
- **CUSUM Test** (`filtering.js`): Structural break detection
- **Constancy Test** (`filtering.js`): Likelihood ratio test for q=0
- **Bootstrap CI** (`filtering.js`): Non-parametric confidence intervals

### Models (`lib/models/`)

Rough volatility model simulators:

| Model | File | Description |
|-------|------|-------------|
| rBergomi | `rbergomi.js` | Rough Bergomi with async coupling |
| rFSV | `rfsv.js` | Rough fractional stochastic volatility |
| fOU | `fou.js` | Fractional Ornstein-Uhlenbeck |
| MPRE | `mpre.js` | Multifractional process with random exponent |
| ARFIMA | `forecasting.js` | Fractional differencing with ARMA |

### Random Generation (`lib/random.js`)

Synthetic data generation:

- `generateFGN(n, H)` - Fractional Gaussian Noise (Hosking's method)
- `generateFBM(n, H)` - Fractional Brownian Motion
- `fractionalKernel(H, nSteps, dt)` - Riemann-Liouville kernel
- `correlatedGaussian(n, rho)` - Correlated normals via Cholesky

### PRNG (`lib/prng.js`)

Seeded pseudo-random number generator for reproducibility:

- `mulberry32(seed)` - Fast 32-bit PRNG
- `setSeed(seed)` - Set global seed
- `random()` - Uniform random number
- `randn()` - Standard normal via Box-Muller

## Data Flow

```
Raw Data
    │
    ▼
┌─────────────────┐
│  Preprocessing   │  prices → RV → log-vol → center
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Increment       │  Z_{t,a} = X_{t+a} - X_t
│  Computation     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Block           │  Decorrelate serial dependence
│  Permutation     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Subsampling     │  Sample T increments per scale
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Rescaling       │  a^{-H} rescaling
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  KS Distance     │  Compute empirical CDFs
│  Minimization    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Variance        │  Average over K iterations
│  Reduction       │
└────────┬────────┘
         │
         ▼
    H Estimate
```

## Design Patterns

### Registry Pattern

Optimizers and models use a registry pattern for extensibility:

```javascript
// Register custom optimizer
registerOptimizerFactory('my-optimizer', (opts) => {
  return (f, ax, bx, cx) => { /* ... */ };
});

// Use registered optimizer
const rksavr = new RKSAVR({ optimizerType: 'my-optimizer' });
```

### Builder Pattern

The `RKSAVR` class uses a builder-like constructor for configuration:

```javascript
const rksavr = new RKSAVR({
  scaleA1: 1,
  scaleA2: 50,
  sampleSize: 500,
  iterations: 16,
  optimizerType: 'brent',
  hMin: 0.01,
  hMax: 0.5
});
```

### Functional Pipeline

Data processing uses a functional pipeline approach:

```javascript
import { preprocessPipeline } from 'rksavr';

const logVol = preprocessPipeline(prices, {
  interval: 78,
  center: true
});
```

## Testing Strategy

- **Unit Tests**: Individual function tests in `tests/`
- **Integration Tests**: Full pipeline tests
- **Edge Cases**: Empty inputs, NaN values, flat objectives
- **Coverage**: c8 with HTML/text reporters

## Performance Considerations

- **Zero-Allocation KS**: `ksDistanceRescaled` applies scaling inline during pointer walk
- **Seeded PRNG**: Reproducible simulations without global state pollution
- **Rolling Windows**: Per-window failure handling prevents batch crashes
- **Optimizer Selection**: Choose based on problem dimensionality and smoothness

## Future Directions

- [ ] TypeScript declarations
- [ ] Streaming estimator for online H estimation
- [ ] CLI tool for batch processing
- [ ] WebSocket demo for real-time visualization
- [ ] Integration with real-world datasets (VIX, S&P 500 RV)
