# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Production Package Infrastructure
- **Build System** (`rollup.dist.config.js`): Rollup with Babel producing ESM, ES5, CJS, and IIFE bundles.
- **Dual-Format Publishing** (`package.json`): Conditional exports for `import` and `require`, `files` whitelist, zero runtime dependencies.
- **StandardJS Linting**: Replaced ESLint with `standard` + `snazzy` for zero-config linting.
- **Test Framework Migration** (`tests/`): Mocha + Chai with `@babel/register`, `.mocharc.yml`, and 123 tests.
- **Coverage** (`npm run test:coverage`): c8 with HTML/text reporters, 93.56% statement coverage.
- **Documentation** (`npm run docs`): JSDoc HTML (`docs/`) and `API.md` via `jsdoc-to-markdown`.
- **CI/CD** (`.github/workflows/`):
  - `testsuite.yml`: Matrix testing on Node 18/20/22 with lint + test + coverage.
  - `publish.yml`: Docs + build + dry-run publish.
  - `codeql-analysis.yml`: Security analysis.
- **Community Files**: `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, issue/PR templates, `FUNDING.yml`, `dependabot.yml`.

#### Paper Fidelity & Core Fixes
- **Asymptotic Variance** (`lib/inference/asymptotic.js`): Corrected to Proposition 2.9 formula `(2πe)/(ln a)² · (1/√n + 1/√m)²`.
- **Block Random Permutation** (`lib/stats.js`): Paper-faithful implementation with optional random phase offset, preserving marginal distributions while stripping autocorrelation.
- **Configurable H Bounds** (`lib/rksavr.js`): `hMin`/`hMax` constructor options passed to optimizers and clamped on results.
- **KS Significance Testing** (`lib/inference.js`): `ksCriticalValue`, `ksPvalue`, and `significanceTest` using asymptotic Kolmogorov distribution.
- **Constancy Test** (`lib/inference/filtering.js`): Likelihood ratio test for Kalman `q=0` vs `q>0`.
- **Bootstrap CI** (`lib/inference.js`): Non-parametric bootstrap with seeded PRNG for reproducibility.
- **CUSUM / Breakpoint Detection** (`lib/inference.js`): Structural break detection in H(t) series.

#### Algorithmic Optimizations
- **Zero-Allocation Rescaled KS** (`lib/stats.js:ksDistanceRescaled`): Applies `scale^(-H)` inline during the pointer walk — eliminates two array allocations per optimizer evaluation.
- **Fixed `getIncrementsMulti`** (`lib/rksavr.js`): Replaced buggy single-pass loop with correct per-scale computation.
- **`estimateSingleWithDiagnostics`** (`lib/rksavr.js`): Returns both H and minimized KS distance D.

#### Restored Modules
- **Noise Correction** (`lib/noise.js`): `preavgReturns`, `realizedKernel` (Bartlett/Parzen/Tukey-Hanning), `logVolDebias`.
- **Forecasting** (`lib/models/forecasting.js`): `holtWintersForecast`, `createLSTM` (16/8-dim, Xavier init, full gates), `createAttentionModel` (Q/K/V self-attention).
- **Central Export Hub** (`lib/index.js`): Single entry point re-exporting all public APIs.

### Changed
- **CJS Bundle**: Renamed to `dist/index.cjs` so `require()` works under `"type": "module"`.
- **Demo Dependencies**: `chart.js` and `plotly.js-dist-min` moved from `dependencies` to `devDependencies`.
- **README.md**: Updated repo links, added development workflow, testing, building, and publishing sections.

### Fixed
- `significanceTest` no longer approximates D from variance; it requires the actual minimized KS distance.
- `blockPermutation` random phase no longer drops prefix elements when offset > 0.
- `bootstrapCI` now uses the seeded PRNG instead of `Math.random()`.
- Removed stale `dist/index.cjs.js` build artifacts.

### Removed
- **ESLint**: Replaced by StandardJS (`standard`).
- **Node.js Native Test Runner**: Replaced by Mocha + Chai.
- **`test/rksavr.test.js`**: Migrated to `tests/rksavr.tests.js`.

## [1.1.0] - 2026-05-04

### Added

#### Algorithmic Kernels (Section 1)
- **Nelder-Mead Optimizer** (`lib/optimization.js:nelderMead`): Multi-dimensional simplex method for non-smooth KS distance minimization.
- **Simulated Annealing** (`lib/optimization.js:simulatedAnnealing`): Global optimizer with adaptive cooling to prevent local minima.
- **Differential Evolution** (`lib/optimization.js:differentialEvolution`): Population-based evolutionary optimizer with crossover.
- **Adaptive Grid Search** (`lib/optimization.js:adaptiveGridSearch`): Coarse grid initialization followed by Brent refinement.

#### Multi-Scale Scaling (Section 1.2)
- **Vectorized KS Objective** (`lib/rksavr.js:vectorizedKsObjective`): Compare all scale pairs in a single objective call.
- **Weighted KS Distance** (`lib/stats.js:weightedKsDistance`): Per-scale weighting for heterogeneous scale importance.
- **Scaling Profile** (`lib/stats.js:scalingProfile`): Full multi-scale distance vector for diagnostics.
- **Multi-Scale RKSAVR** (`lib/rksavr.js:RKSAVR.rollingMultiScale`): Comprehensive rolling estimation with profile output.
- **Optimizer Selection**: `optimizerType` config option ('brent', 'nelder-mead', 'annealing', 'de', 'ags').

#### Statistical Robustness (Section 2)
- **Asymptotic Variance** (`lib/inference.js:asymptoticVariance`): Prop 2.9 formula $\frac{2\pi e}{(\ln a)^2}(\frac{1}{\sqrt{n}}+\frac{1}{\sqrt{m}})^2$.
- **Standard Error & CI** (`lib/inference.js:standardError`, `confidenceInterval`): Analytic confidence intervals.
- **Bootstrap CI** (`lib/inference.js:bootstrapCI`): Non-parametric empirical confidence intervals.
- **Kalman Filter** (`lib/inference.js:kalmanFilter`): State-space filtering for temporal H variation.
- **CUSUM Test** (`lib/inference.js:cusumTest`): Structural break detection in H series.
- **Breakpoint Detection** (`lib/inference.js:detectBreakpoints`): Binary segmentation for regime identification.
- **Constancy Test** (`lib/inference.js:constancyTest`): Likelihood ratio test for Kalman $q=0$ vs $q>0$.
- **Preaveraging** (`lib/noise.js:preavgReturns`): Noise mitigation via overlapping returns.
- **Realized Kernel** (`lib/noise.js:realizedKernel`): Bartlett/Parzen/Tukey kernel volatility.
- **Multiscale Decomposition** (`lib/noise.js:multiscaleDecompose`): Trend/noise separation.
- **Log-Vol De-biasing** (`lib/noise.js:logVolDebias`): Non-linear bias correction.
- **Bid-Ask Correction** (`lib/noise.js:bidAskCorrection`): Zero-return tick test filter.
- **Optimal Sampling** (`lib/noise.js:optimalSamplingInterval`): Noise-adaptive interval selection.

#### Financial Engineering (Section 3)
- **rBergomi Model** (`lib/models/rbergomi.js`): One-factor rough Bergomi with async coupling.
- **rFSV Model** (`lib/models/rfsv.js`): Rough fractional stochastic volatility with Heston dynamics.
- **fOU Process** (`lib/models/fou.js`): Fractional Ornstein-Uhlenbeck with exact OU discretization.
- **MPRE** (`lib/models/mpre.js`): Multifractional process with stochastic H exponent.
- **ARFIMA Forecasting** (`lib/models/forecasting.js:arfima`): Fractional differencing with ARMA.
- **LSTM Cell** (`lib/models/forecasting.js:createLSTM`): Simple recurrent cell for H prediction.
- **Attention Model** (`lib/models/forecasting.js:createAttentionModel`): Transformer-style self-attention.
- **Holt-Winters** (`lib/models/forecasting.js:holtWintersForecast`): Exponential smoothing forecast.

### Changed
- `lib/rksavr.js`: Refactored with multi-scale support, optimizer selection, and new objective functions.
- `lib/stats.js`: Added weighted KS, scaling profile, and bootstrap utilities.
- `lib/optimization.js`: Restructured as multi-optimizer suite with consistent API.
- `README.md`: Expanded with multi-scale usage, model examples, and inference documentation.

## [1.0.0] - 2026-05-03

### Added
- Initial RK-SAVR implementation with Brent's method optimizer.
- KS distance and random sampling utilities.
- Fractional Brownian motion generator (Hosking's method).
- Interactive web demo with Chart.js.
- Basic rolling window estimation.
- MIT License.