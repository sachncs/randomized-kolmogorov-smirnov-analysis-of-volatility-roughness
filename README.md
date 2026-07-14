<p align="center">
  <h1 align="center">RK-SAVR</h1>
  <p align="center">Randomized Kolmogorov-Smirnov Analysis of Volatility Roughness.</p>
  <p align="center">
    <a href="#installation"><img src="https://img.shields.io/badge/node-20%2B-brightgreen" alt="Node"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License"></a>
    <a href="https://github.com/sachncs/randomized-kolmogorov-smirnov-analysis-of-volatility-roughness/actions"><img src="https://img.shields.io/github/actions/workflow/status/sachncs/randomized-kolmogorov-smirnov-analysis-of-volatility-roughness/ci.yml?branch=master" alt="CI"></a>
    <a href="https://www.npmjs.com/package/rksavr"><img src="https://img.shields.io/npm/v/rksavr" alt="npm"></a>
    <a href="https://github.com/sachncs/randomized-kolmogorov-smirnov-analysis-of-volatility-roughness/stargazers"><img src="https://img.shields.io/github/stars/sachncs/randomized-kolmogorov-smirnov-analysis-of-volatility-roughness" alt="Stars"></a>
  </p>
</p>

**Randomized Kolmogorov-Smirnov Analysis of Volatility Roughness — a high-performance JavaScript implementation for estimating the Hurst parameter of rough volatility models.**

`rksavr` is a JavaScript implementation of the **RK-SAVR** algorithm (Angelini & Bianchi, arXiv:2509.20015v3) for estimating the Hurst parameter `H` of rough volatility models. It compares the empirical distributions of rescaled increments at two (or more) scales to recover `H` without ever fitting a parametric model.

## Features

- **Distributional scaling** — Compare entire rescaled distributions of increments across scales
- **Block random permutation** — Decorrelate serial dependence while preserving marginal distributions
- **Variance reduction** — Repeated subsampling and averaging with `K` independent iterations
- **Multi-scale analysis** — Vectorized scaling profile across `k` scales with optional weights
- **Pluggable optimizers** — Brent's method, Nelder-Mead, simulated annealing, differential evolution, and adaptive grid search
- **Statistical inference** — Asymptotic variance (Prop 2.9), confidence intervals, KS significance testing, Kalman filtering, CUSUM break detection, constancy test, bootstrap CIs
- **Synthetic data** — Hosking's-method fBm/fGn, VIX-style and SPX-RV-style log-volatility generators
- **Rough-volatility model zoo** — Simulators for rBergomi, rFSV, fOU, and mPRE processes
- **H-forecasting** — ARFIMA, Holt-Winters, LSTM-like, and attention-based predictors
- **Noise correction** — Preaveraging, realized kernel, log-volatility de-biasing
- **Zero runtime dependencies** — Pure JavaScript implementation with no external dependencies

## Installation

### From npm

```bash
npm install rksavr
```

### From source

```bash
git clone https://github.com/sachncs/randomized-kolmogorov-smirnov-analysis-of-volatility-roughness.git
cd randomized-kolmogorov-smirnov-analysis-of-volatility-roughness
npm install
```

### Dev dependencies (lint, test, docs, build)

```bash
npm install --include=dev
```

**Requirements**: Node.js ≥ 20.x (engines: `>= 18.x`; reference badge targets Node 20+).

## Quick Start

### CLI

```bash
node -e "import('./lib/index.js').then(({RKSAVR}) => { const r = new RKSAVR({scaleA1:1, scaleA2:50, sampleSize:500, iterations:16}); console.log(r.estimate(/* log-vol series */)); });"
```

There is no shipped CLI binary — consume the library directly from a script or the interactive demo (`npm run dev`).

### Node.js API

```javascript
import { RKSAVR } from 'rksavr';

const rksavr = new RKSAVR({
  scaleA1: 1,      // Lower scale
  scaleA2: 50,     // Upper scale
  sampleSize: 500, // Increments to sample
  iterations: 16,  // Variance reduction iterations
  blockSize: 16,   // Block length for random permutation
});

const data = [/* log-volatility series */];
const hEstimate = rksavr.estimate(data);
console.log(`Estimated H: ${hEstimate}`);
```

Rolling and multi-scale analyses:

```javascript
const windowSize = 512;
const step = 20;
const results = rksavr.rolling(data, windowSize, step, (progress) => {
  console.log(`Progress: ${(progress * 100).toFixed(1)}%`);
});
// results => [{ t: 0, H: 0.12 }, { t: 20, H: 0.14 }, ...]

const rksavrMulti = new RKSAVR({
  scales: [1, 2, 5, 10, 20, 50],
  weights: [1.0, 0.8, 0.6, 0.4, 0.2, 0.1],
  sampleSize: 500,
  iterations: 8,
});
const multiResults = rksavrMulti.rollingMultiScale(
  data, 512, [1, 2, 5, 10, 20, 50], [1, 0.8, 0.6, 0.4, 0.2, 0.1], 20,
);
```

Optimizer choice:

```javascript
const rksavrDe = new RKSAVR({
  scaleA1: 1,
  scaleA2: 50,
  optimizerType: 'de',  // 'brent' | 'nelder-mead' | 'annealing' | 'de' | 'ags'
  iterations: 16,
});
```

## Configuration

No environment variables are required for core library usage. See `.env.example` for development configuration.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scaleA1` | `number` | `1` | Lower scale for increment computation |
| `scaleA2` | `number` | `50` | Upper scale for increment computation |
| `sampleSize` | `number` | `500` | Number of increments to sample per scale |
| `iterations` | `number` | `16` | Number of `K` iterations for variance reduction |
| `blockSize` | `number` | `16` | Block length for random permutation |
| `optimizerType` | `string` | `'brent'` | Optimizer selection |
| `hMin` | `number` | `0.01` | Minimum Hurst parameter bound |
| `hMax` | `number` | `0.99` | Maximum Hurst parameter bound |
| `scales` | `Array<number>` | `null` | Multi-scale array; overrides `scaleA1` / `scaleA2` |
| `weights` | `Array<number>` | `null` | Per-scale weights for the weighted KS objective |
| `sampler` | `function` | Floyd's R | Custom `(data, n) => sample` function |

| Optimizer | Key | Best for |
|-----------|-----|----------|
| Brent's method | `'brent'` | 1D smooth functions (default) |
| Nelder-Mead | `'nelder-mead'` | Multi-dimensional problems |
| Simulated annealing | `'annealing'` | Global optimization |
| Differential evolution | `'de'` | Population-based search |
| Adaptive grid search | `'ags'` | Coarse-to-fine refinement |

## API

| Symbol | Type | Description |
|--------|------|-------------|
| `RKSAVR` | class | Main estimator; two-scale and multi-scale modes |
| `RKSAVR#estimate(data)` | method | Single-shot `H` estimate |
| `RKSAVR#rolling(data, w, step, onProgress)` | method | Rolling-window `H` trajectory |
| `RKSAVR#rollingMultiScale(data, w, scales, weights, step)` | method | Multi-scale rolling estimates |
| `asymptoticVariance(a1, a2, n, m)` | function | Asymptotic variance (Prop 2.9) |
| `confidenceInterval(h, a1, a2, n, m, alpha)` | function | Confidence interval for `H` |
| `kalmanFilter(hSeries, opts)` | function | Kalman-smoothed `H` series |
| `cusumTest(hSeries, opts)` | function | CUSUM structural-break test |
| `constancyTest(hSeries, opts)` | function | Constancy-of-H test |
| `bootstrapCI(estimator, data, B, alpha)` | function | Bootstrap confidence interval |
| `rBergomi(opts)` / `rFSV(opts)` / `fOU(opts)` / `mPRE(opts)` | functions | Rough-volatility path simulators |
| `arfima(opts)` / `holtWintersForecast` / `createLSTM` | functions | H-forecasting primitives |
| `preavgReturns` / `realizedKernel` / `logVolDebias` | functions | Microstructure-noise correction |
| `rBergomi`, `rFSV`, `fOU`, `mPRE` (models) | namespaces | Rough-vol model zoo |

## Examples

Statistical inference toolkit:

```javascript
import {
  asymptoticVariance,
  confidenceInterval,
  kalmanFilter,
  cusumTest,
  constancyTest,
  bootstrapCI,
} from 'rksavr';

const varH = asymptoticVariance(1, 50, 500, 500);
const ci = confidenceInterval(0.12, 1, 50, 500, 500, 0.05);
const filtered = kalmanFilter(hHistory, { q: 0.01, r: 0.1 });
const bootstrap = bootstrapCI((w) => rksavr.estimate(w), data, 1000, 0.05);
```

Rough-volatility model zoo (paths and times):

```javascript
import { rBergomi, rFSV, fOU, mPRE } from 'rksavr';

const { paths, times } = rBergomi({ nPaths: 100, nSteps: 252, h: 0.1, eta: 2.0, rho: -0.8 });
const { volPath }     = rFSV({ nSteps: 252, h: 0.1, theta: 2.0, mu: 0.04, nu: 0.5 });
const { path }        = fOU({ nSteps: 252, h: 0.3, theta: 1.0, mu: 0.0, sigma: 1.0 });
const { path, hPath } = mPRE({ nSteps: 252, hMin: 0.05, hMax: 0.95, h0: 0.1 });
```

H-forecasting and noise correction:

```javascript
import { arfima, holtWintersForecast, createLSTM } from 'rksavr';
import { preavgReturns, realizedKernel, logVolDebias } from 'rksavr';

const forecastFn = arfima({ p: 1, d: 0.3, q: 1, window: 50 });
const predictedH = forecastFn(hHistory);
const nextH = holtWintersForecast(hHistory, 0.3, 0.1);
const lstm = createLSTM({ hiddenSize: 16 });

const correctedReturns = preavgReturns(prices, 2);
const rv = realizedKernel(returns, 'bartlett');
const debiasedH = logVolDebias(rawHEstimates, sigmaObs, sigmaLatent);
```

## Methodology

Given a stationary window `X_0, ..., X_{W-1}` of a log-volatility series the RK-SAVR estimator proceeds as follows:

1. **Segmentation** — Slice the series into overlapping windows.
2. **Increments** — Compute `Z_{t,a} = X_{t+a} - X_t` at scales `a_1` and `a_2` (or a multi-scale array).
3. **Block permutation** — Randomly permute blocks of increments to remove temporal correlation while preserving marginal distributions.
4. **Subsampling** — Draw `T` increments per scale with Floyd's reservoir sampler.
5. **Rescaling** — Rescale by `a^{-H}` and treat the rescaled samples as identically distributed under the null of self-similarity.
6. **KS minimization** — Find `H in (0, 1)` that minimizes the two-sample Kolmogorov-Smirnov distance between rescaled samples.
7. **Variance reduction** — Average over `K` independent iterations.

The asymptotic variance of `H_hat` (Proposition 2.9) is

```
Var(H_hat) = (2 * pi * e) / (ln(a2 / a1))^2 * (1/sqrt(n) + 1/sqrt(m))^2
```

so doubling the sample sizes halves the SE and widening the scale ratio shrinks it quadratically.

See [docs/architecture.md](docs/architecture.md) and the generated [API.md](API.md) for full design rationale, algorithm pseudocode, and extension points.

## Project Structure

```
rksavr/
├── lib/                       # Core library
│   ├── index.js               # Central export hub
│   ├── rksavr.js              # Main RKSAVR class with multi-scale support
│   ├── stats.js               # KS distance, block permutation, sampling
│   ├── optimization/          # Brent, Nelder-Mead, SA, DE, AGS, registry
│   ├── inference/             # Asymptotic variance, Kalman, CUSUM, bootstrap
│   │   ├── asymptotic.js      #   - Prop 2.9 variance and confidence interval
│   │   ├── filtering.js       #   - Kalman filter and constancy test
│   │   └── math.js            #   - Beasley-Springer-Malkin normal quantile
│   ├── data/                  # Data loading, preprocessing, noise correction
│   │   ├── loaders.js         #   - CSV / JSON loaders and validators
│   │   ├── preprocess.js      #   - RV, Parkinson, log-vol, windows
│   │   ├── synthetic.js       #   - VIX-style / SPX-RV-style generators
│   │   └── noise.js           #   - Preaveraging, realized kernel, de-bias
│   ├── models/                # Rough-volatility model zoo
│   │   ├── rbergomi.js        #   - Bayer-Friz-Gatheral rBergomi
│   │   ├── rfsv.js            #   - Rough Fractional Stochastic Volatility
│   │   ├── fou.js             #   - Fractional Ornstein-Uhlenbeck
│   │   ├── mpre.js            #   - Multifractional Process with Random Exponent
│   │   ├── forecasting.js     #   - ARFIMA, Holt-Winters, LSTM, attention
│   │   └── index.js           #   - Model registry
│   ├── random.js              # Hosking fGn/fBm + Box-Muller + RL kernel
│   ├── prng.js                # Seeded mulberry32 PRNG
│   ├── logger.js              # Leveled logger (debug / info / warn / error)
│   └── fbm.js                 # Back-compat shim around random.js
├── demo/                      # Interactive web demo (Vite + Chart.js)
├── tests/                     # Test suite (Mocha + Chai, 190 tests)
├── docs/                      # Generated JSDoc HTML and API.md
├── .github/                   # CI/CD workflows and templates
├── scripts/                   # Setup and cleanup helpers
├── package.json
└── LICENSE
```

## Development

```bash
npm install
npm run lint          # eslint + prettier check
npm run lint:fix      # eslint --fix + prettier --write
npm run test          # 190 tests
npm run test:watch
npm run test:coverage
npm run build         # rollup -> dist/index.{js,cjs,iife.js}
npm run docs          # jsdoc + jsdoc2md -> API.md
npm run build:full    # docs + build
npm run dev           # vite demo (interactive UI)
npm run setup
npm run cleanup
```

Code style: Google JS Style (enforced via ESLint) + Prettier auto-format, single quotes, every public module/class/function ships a JSDoc block explaining *why* not just *what* with algorithm/math references where relevant. Commits follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add two-scale bootstrap CI module
fix: handle empty window in rollingMultiScale
docs: comprehensive JSDoc pass across lib/
refactor: extract percentile helpers into inference/math.js
test: add parity tests for cached vs streamed memory
chore: update jsdoc config
```

## Testing

```bash
npm test                       # mocha (190 tests)
npm run test:watch             # watch mode
npm run test:coverage          # c8 text + html coverage
```

## Build

```bash
npm run build                  # rollup ESM + CJS + IIFE bundles
npm run docs                   # JSDoc HTML + API.md
npm run build:full             # full documentation + bundle
```

## Release

```bash
npm version patch              # 0.0.7 -> 0.0.8
npm run lint && npm run build && npm test
git tag v0.0.X && git push origin v0.0.X
# .github/workflows/publish.yml publishes to npm via trusted publishing
```

## Tech Stack

| Category | Technology |
|----------|------------|
| Language | JavaScript (ES2022+) |
| Module system | ES Modules with CommonJS + IIFE support |
| Build tool | Rollup with Babel |
| Test framework | Mocha + Chai |
| Coverage | c8 |
| Lint | ESLint (Google style) + Prettier |
| Documentation | JSDoc + jsdoc-to-markdown |
| CI/CD | GitHub Actions |
| Demo | Vite + Chart.js + Plotly.js |

## Roadmap

- **v0.0.7** — Current: core RK-SAVR estimator, multi-scale analysis, statistical inference, model zoo, and forecasting primitives.
- **v0.1.0** — Planned: TypeScript declarations for API consumers; CLI for batch CSV processing; streaming estimator for online `H`.
- **v0.2.0** — Planned: WebSocket demo for real-time visualization; integration with VIX and SPX-RV reference datasets; process-noise estimation for the Kalman filter.
- **v1.0.0** — Planned: heteroskedasticity-robust standard errors; adaptive scale selection based on window size.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Code of Conduct

This project follows the [Contributor Covenant v2.1](CODE_OF_CONDUCT.md).

## Security

Report vulnerabilities to **sachncs@gmail.com** — see [SECURITY.md](SECURITY.md). Please do **not** disclose security issues through public GitHub issues.

## License

[MIT](LICENSE) © 2025-2026 Sachin

## Disclaimer

This is an **independent implementation** of the RK-SAVR algorithm described in *Randomized Kolmogorov-Smirnov Analysis of Volatility Roughness* (arXiv:2509.20015v3) by Angelini & Bianchi. The author is not affiliated with the paper's authors. This implementation is provided **as-is** for research and educational purposes. Please cite the original paper when using this library in academic work.

## References

- Bianchi, M. (2004). *A new distribution-based estimator of the self-similarity parameter*.
- Angelini & Bianchi (2025). *Randomized Kolmogorov-Smirnov Analysis of Volatility Roughness*. [arXiv:2509.20015v3](https://arxiv.org/abs/2509.20015v3).
- Bayer, Friz, Gatheral (2016). *Roughing it up: Connecting rough volatility with option pricing*.
- Gatheral, Jaisson, Rosenbaum (2018). *Volatility is Rough*.
- Hosking, J. R. M. (1984). *Modeling persistence in hydrological time series using fractional differencing*. Water Resources Research.
- Mandelbrot, B., & Van Ness, J. W. (1968). *Fractional Brownian motions, fractional noises and applications*. SIAM Review.
- Brent, R. P. (1971). *Algorithms for Minimization without Derivatives*.
