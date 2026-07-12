/**
 * @fileoverview Public entry point for the rksavr package.
 *
 * This module re-exports every user-facing API of the RK-SAVR library. It is
 * the only file consumers should normally import from when using the package
 * (`import {RKSAVR} from 'rksavr';`). The intent is to keep a stable surface
 * even when internal modules are split, renamed, or rearranged.
 *
 * ## Architecture
 *
 * The library follows a layered, single-responsibility design:
 *
 *   lib/
 *   ├── index.js                 <- this file, the public surface
 *   ├── rksavr.js                <- RKSAVR class (the estimator)
 *   ├── stats.js                 <- KS distance, permutation, sampling
 *   ├── random.js                <- fBm/fGn generation, Box-Muller, kernels
 *   ├── prng.js                  <- Seedable mulberry32 PRNG + global handle
 *   ├── logger.js                <- Minimal leveled logger
 *   ├── inference.js             <- High-level inference facade
 *   ├── inference/asymptotic.js  <- Asymptotic variance, CIs
 *   ├── inference/filtering.js   <- Kalman filter, constancy test
 *   ├── inference/math.js        <- Internal normal-quantile approximation
 *   ├── optimization/            <- Brent, Nelder-Mead, SA, DE, AGS, registry
 *   ├── models/                  <- Rough volatility simulators + forecasters
 *   └── data/                    <- Loaders, preprocessing, noise correction
 *
 * The RK-SAVR estimator itself depends only on `stats.js`,
 * `optimization/index.js`, and `logger.js`. Inference, models, and the data
 * pipeline are independent consumers that may be used standalone.
 *
 * ## Design rationale
 *
 * - **Zero runtime dependencies.** Everything is implemented in pure ES2022+
 *   JavaScript so the library is portable across Node.js, browsers, and the
 *   bundled IIFE/CJS/ESM distributions.
 * - **Seeded, deterministic PRNG.** `setSeed`/`random` in `prng.js` lets users
 *   make simulations reproducible. Math.random() is used as a fallback.
 * - **Pluggable optimizers.** Estimators delegate the 1D minimization problem
 *   to factories registered in `optimization/registry.js`. Callers can plug
 *   in custom optimizers at runtime.
 *
 * @see {@link RKSAVR} for the main estimator class.
 * @see {@link module:stats} for the statistical primitives.
 * @see {@link module:optimization} for the optimizer registry.
 * @see ./rksavr.js
 * @see ./stats.js
 * @see ./inference.js
 * @see ./models/index.js
 * @see ./optimization/index.js
 */

export {RKSAVR} from './rksavr.js';
export {ksDistance, shuffle, randomSample, blockPermutation} from './stats.js';
export {
  generateFGN,
  generateFBM,
  randn,
  randnBatch,
  correlatedGaussian,
  fractionalKernel,
  fractionalIntegral,
} from './random.js';
export {setSeed, resetSeed, random} from './prng.js';
export {
  LogLevel,
  setLogLevel,
  getLogLevel,
  debug,
  info,
  warn,
  error,
} from './logger.js';
export {
  asymptoticVariance,
  standardError,
  confidenceInterval,
  kalmanFilter,
  ksCriticalValue,
  ksPvalue,
  significanceTest,
  cusumTest,
  detectBreakpoints,
  constancyTest,
  bootstrapCI,
} from './inference.js';
export {
  rBergomi,
  rBergomiPrice,
  rFSV,
  rFSVPrice,
  fOU,
  exactOU,
  mPRE,
  mPREExact,
  arfima,
  holtWintersForecast,
  createLSTM,
  createAttentionModel,
  getModel,
  registerModel,
  listModels,
} from './models/index.js';

export {
  parseCSV,
  extractSeries,
  parseJSON,
  validateNoGaps,
  downsample,
  computeRV,
  computeRVParkinson,
  aggregateDailyRV,
  logTransform,
  centerSeries,
  standardizeSeries,
  preprocessPipeline,
  trainTestSplit,
  createWindows,
  generateVIXLogVol,
  generateSPXLogVol,
  generateIntradayPrices,
  seriesToCSV,
} from './data/index.js';
export {
  brentMinimize,
  nelderMead,
  simulatedAnnealing,
  differentialEvolution,
  adaptiveGridSearch,
  safeOptimizer,
  getOptimizerFactory,
  registerOptimizerFactory,
} from './optimization/index.js';
