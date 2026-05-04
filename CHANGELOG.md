# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **CI Pipeline** (`.github/workflows/ci.yml`): GitHub Actions workflow with lint, test, and build jobs.
- **ESLint Configuration** (`eslint.config.js`): ESLint 10 flat config with basic rules.
- **Test Suite** (`test/rksavr.test.js`): Node.js native test runner with 10 tests covering core functionality.

### Changed
- **Nelder-Mead Fix** (`lib/optimization.js`): Fixed scope bug in return statement causing `sortedPts`/`sortedF` undefined errors.
- **AGS Optimizer** (`lib/rksavr.js`): Fixed adaptive grid search call signature to pass `max` as upper bound instead of array.
- **Model Index** (`lib/models/index.js`): Added explicit imports for `no-undef` compliance in default export.

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
- **Asymptotic Variance** (`lib/inference.js:asymptoticVariance`): Prop 2.9 formula $\frac{2\pi e}{(2\ln a)^2}(\frac{1}{n}+\frac{1}{m})$.
- **Standard Error & CI** (`lib/inference.js:standardError`, `confidenceInterval`): Analytic confidence intervals.
- **Bootstrap CI** (`lib/inference.js:bootstrapCI`): Non-parametric empirical confidence intervals.
- **Kalman Filter** (`lib/inference.js:kalmanFilter`): State-space filtering for temporal H variation.
- **CUSUM Test** (`lib/inference.js:cusumTest`): Structural break detection in H series.
- **Breakpoint Detection** (`lib/inference.js:detectBreakpoints`): Binary segmentation for regime identification.
- **Constancy Test** (`lib/inference.js:constancyTest`): Running window variance ratio test.
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