/**
 * @fileoverview Re-exports for the data pipeline layer.
 *
 * Single import surface for the four data submodules: loaders
 * (`loaders.js`), preprocessing (`preprocess.js`), synthetic data
 * generators (`synthetic.js`), and microstructure-noise corrections
 * (`noise.js`).
 */

export {
  parseCSV,
  extractSeries,
  parseJSON,
  validateNoGaps,
  downsample,
} from './loaders.js';

export {
  computeRV,
  computeRVParkinson,
  aggregateDailyRV,
  logTransform,
  centerSeries,
  standardizeSeries,
  preprocessPipeline,
  trainTestSplit,
  createWindows,
} from './preprocess.js';

export {
  generateVIXLogVol,
  generateSPXLogVol,
  generateIntradayPrices,
  seriesToCSV,
} from './synthetic.js';

export {preavgReturns, realizedKernel, logVolDebias} from './noise.js';
