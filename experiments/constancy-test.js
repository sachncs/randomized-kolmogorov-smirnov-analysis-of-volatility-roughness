/**
 * Experiment: Constancy test on rolling H estimates.
 * Reproduces the paper's likelihood ratio test (Table 1 style).
 *
 * Usage:
 *   node experiments/constancy-test.js
 *
 * Outputs:
 *   - data/samples/constancy-test-results.json
 */

import {RKSAVR} from '../lib/rksavr.js';
import {constancyTest} from '../lib/inference.js';
import {generateVIXLogVol, generateSPXLogVol} from '../lib/data/synthetic.js';
import {generateFBM} from '../lib/fbm.js';
import {setSeed} from '../lib/prng.js';
import {writeFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Runs constancy test on rolling H estimates.
 *
 * @param {Array<number>} logVol Log-volatility series.
 * @param {Object} config RKSAVR configuration.
 * @param {number} windowSize Window size.
 * @param {number} step Step size.
 * @param {Object} kalmanOpts Kalman filter options.
 * @return {{estimates: Array<Object>, constancy: Object}} Results.
 */
export function runConstancyExperiment(
  logVol,
  config,
  windowSize,
  step,
  kalmanOpts = {},
) {
  const rksavr = new RKSAVR(config);
  const estimates = rksavr
    .rolling(logVol, windowSize, step)
    .filter((r) => r.H !== null)
    .map((r) => r.H);

  const constancy = constancyTest(estimates, kalmanOpts);
  return {estimates, constancy};
}

/**
 * Runs the full experiment suite.
 */
export function main() {
  const windowSize = 512;
  const step = 20;
  const config = {
    scaleA1: 1,
    scaleA2: 50,
    sampleSize: 500,
    iterations: 16,
    blockSize: 16,
    hMin: 0.01,
    hMax: 0.5,
  };

  const kalmanOpts = {q: 0.01, r: 0.1};

  // VIX-style
  setSeed(42);
  const vixLogVol = generateVIXLogVol(1500, 0.1, {seed: 42});
  const vixResult = runConstancyExperiment(
    vixLogVol,
    config,
    windowSize,
    step,
    kalmanOpts,
  );

  // SPX-style
  setSeed(123);
  const spxLogVol = generateSPXLogVol(1500, 0.14, {seed: 123});
  const spxResult = runConstancyExperiment(
    spxLogVol,
    config,
    windowSize,
    step,
    kalmanOpts,
  );

  // Time-varying H (non-constant) for contrast
  setSeed(999);
  const n = 1500;
  // Two fBM segments with different H values to simulate regime change
  const fbm1 = generateFBM(Math.floor(n / 2), 0.1);
  const fbm2 = generateFBM(Math.ceil(n / 2), 0.3);
  const mixedLogVol = [...fbm1, ...fbm2].map((v) => 1.5 + v * 0.4);
  const mixedResult = runConstancyExperiment(
    mixedLogVol,
    config,
    windowSize,
    step,
    kalmanOpts,
  );

  const output = {
    config,
    windowSize,
    step,
    kalmanOpts,
    results: {
      vix: {
        label: 'VIX-style (constant H=0.1)',
        nEstimates: vixResult.estimates.length,
        meanH:
          vixResult.estimates.reduce((a, b) => a + b, 0) /
          vixResult.estimates.length,
        constancy: vixResult.constancy,
      },
      spx: {
        label: 'SPX-style (constant H=0.14)',
        nEstimates: spxResult.estimates.length,
        meanH:
          spxResult.estimates.reduce((a, b) => a + b, 0) /
          spxResult.estimates.length,
        constancy: spxResult.constancy,
      },
      mixed: {
        label: 'Mixed regime (H changes from 0.1 to 0.3)',
        nEstimates: mixedResult.estimates.length,
        meanH:
          mixedResult.estimates.reduce((a, b) => a + b, 0) /
          mixedResult.estimates.length,
        constancy: mixedResult.constancy,
      },
    },
  };

  const outPath = join(
    __dirname,
    '..',
    'data',
    'samples',
    'constancy-test-results.json',
  );
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Constancy test results written to ${outPath}`);
  console.log('Summary:');
  for (const [key, val] of Object.entries(output.results)) {
    const sig = val.constancy.constant ? 'CONSTANT' : 'TIME-VARYING';
    console.log(
      `  ${key}: mean H=${val.meanH.toFixed(3)}, p-value=${val.constancy.pValue.toFixed(4)}, ${sig}`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
