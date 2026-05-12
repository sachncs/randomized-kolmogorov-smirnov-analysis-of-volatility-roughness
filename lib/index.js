/**
 * RK-SAVR main exports.
 * Randomized Kolmogorov-Smirnov Analysis of Volatility Roughness.
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
