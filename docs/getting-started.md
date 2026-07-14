# Getting Started with RK-SAVR

This guide will help you get started with using RK-SAVR for Hurst parameter estimation.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm or yarn

## Installation

### As a Dependency

```bash
npm install rksavr
```

### From Source

```bash
git clone https://github.com/sachncs/randomized-kolmogorov-smirnov-analysis-of-volatility-roughness.git
cd randomized-kolmogorov-smirnov-analysis-of-volatility-roughness
npm install
```

## Basic Usage

### ES Modules (Recommended)

```javascript
import { RKSAVR } from 'rksavr';

const rksavr = new RKSAVR({
  scaleA1: 1,
  scaleA2: 50,
  sampleSize: 500,
  iterations: 16
});

// Your log-volatility data
const data = [/* ... */];

// Estimate Hurst parameter
const hEstimate = rksavr.estimate(data);
console.log(`Estimated H: ${hEstimate}`);
```

### CommonJS

```javascript
const { RKSAVR } = require('rksavr');

const rksavr = new RKSAVR({
  scaleA1: 1,
  scaleA2: 50,
  sampleSize: 500,
  iterations: 16
});

const data = [/* ... */];
const hEstimate = rksavr.estimate(data);
console.log(`Estimated H: ${hEstimate}`);
```

### Browser (IIFE)

```html
<script src="dist/index.iife.js"></script>
<script>
  const rksavr = new RKSAVR.RKSAVR({
    scaleA1: 1,
    scaleA2: 50,
    sampleSize: 500,
    iterations: 16
  });
</script>
```

## Configuration Options

The `RKSAVR` constructor accepts the following options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scaleA1` | `number` | `1` | Lower scale for increment computation |
| `scaleA2` | `number` | `50` | Upper scale for increment computation |
| `sampleSize` | `number` | `500` | Number of increments to sample per scale |
| `iterations` | `number` | `16` | Number of K iterations for variance reduction |
| `blockSize` | `number` | `16` | Block length for random permutation |
| `optimizerType` | `string` | `'brent'` | Optimizer: `'brent'`, `'nelder-mead'`, `'annealing'`, `'de'`, `'ags'` |
| `hMin` | `number` | `0.01` | Minimum Hurst parameter bound |
| `hMax` | `number` | `0.99` | Maximum Hurst parameter bound |

## Rolling Window Analysis

```javascript
const windowSize = 512;
const step = 20;

const results = rksavr.rolling(data, windowSize, step, (progress) => {
  console.log(`Progress: ${(progress * 100).toFixed(1)}%`);
});

// results => [{ t: 0, H: 0.12 }, { t: 20, H: 0.14 }, ...]
```

## Working with Real Data

### From CSV

```javascript
import { parseCSV, extractSeries, preprocessPipeline } from 'rksavr';

// Parse CSV data
const rows = parseCSV(csvString, {
  dateField: 'date',
  numericFields: ['close']
});

// Extract time series
const prices = extractSeries(rows, 'close');

// Full preprocessing pipeline
const logVolatility = preprocessPipeline(prices, {
  interval: 78,  // 5-minute intervals
  center: true
});

// Estimate H
const rksavr = new RKSAVR({ scaleA1: 1, scaleA2: 50 });
const hEstimate = rksavr.estimate(logVolatility);
```

### From JSON

```javascript
import { parseJSON, extractSeries, preprocessPipeline } from 'rksavr';

const rows = parseJSON(jsonString);
const prices = extractSeries(rows, 'close');
const logVolatility = preprocessPipeline(prices, { interval: 78 });
```

## Statistical Inference

```javascript
import {
  asymptoticVariance,
  confidenceInterval,
  kalmanFilter,
  bootstrapCI
} from 'rksavr';

// Compute asymptotic variance
const varH = asymptoticVariance(1, 50, 500, 500);

// Confidence interval
const ci = confidenceInterval(0.12, 1, 50, 500, 500, 0.05);

// Kalman filtering for time-varying H
const filtered = kalmanFilter(hHistory, { q: 0.01, r: 0.1 });

// Bootstrap confidence interval
const bootstrap = bootstrapCI(
  (w) => rksavr.estimate(w),
  data,
  1000,
  0.05
);
```

## Rough Volatility Models

```javascript
import { rBergomi, rFSV, fOU, mPRE } from 'rksavr';

// Generate rough Bergomi paths
const { paths } = rBergomi({
  nPaths: 100,
  nSteps: 252,
  h: 0.1,
  eta: 2.0,
  rho: -0.8,
});

// Estimate H from generated paths
const rksavr = new RKSAVR({ scaleA1: 1, scaleA2: 50 });
const logVol = paths[0].map(v => Math.log(Math.sqrt(v)));
const hEstimate = rksavr.estimate(logVol);
```

## Next Steps

- Read the [API Reference](../API.md) for detailed documentation
- Explore the [Architecture Guide](architecture.md) to understand the codebase
- Check out the [interactive demo](../demo/) for visualization
- Read the [contributing guidelines](../CONTRIBUTING.md) to get involved
