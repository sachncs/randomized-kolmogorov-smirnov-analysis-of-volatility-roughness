/**
 * Experiment: Generate figure data for paper reproduction.
 * Produces JSON datasets that can be plotted to match paper figures.
 *
 * Usage:
 *   node experiments/generate-figures.js
 *
 * Outputs:
 *   - data/samples/figure-1-path.json (synthetic fBM path)
 *   - data/samples/figure-2-rolling.json (rolling estimates with CI)
 *   - data/samples/figure-3-profile.json (multi-scale scaling profile)
 */

import {RKSAVR} from '../lib/rksavr.js';
import {generateFBM} from '../lib/fbm.js';
import {confidenceInterval} from '../lib/inference.js';
import {setSeed} from '../lib/prng.js';
import {writeFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Generates data for Figure 1: a synthetic fBM path with estimated H.
 */
export function generateFigure1() {
  setSeed(42);
  const H0 = 0.1;
  const n = 2048;
  const path = generateFBM(n, H0);

  const rksavr = new RKSAVR({
    scaleA1: 1,
    scaleA2: 50,
    sampleSize: 500,
    iterations: 16,
  });
  const estimate = rksavr.estimate(path);
  const {minimizedD} = rksavr.estimateSingleWithDiagnostics(path);

  const data = {
    figure: 1,
    title: 'Synthetic Fractional Brownian Motion',
    trueH: H0,
    estimatedH: estimate,
    minimizedD,
    n,
    path: path.map((v, i) => ({t: i, value: v})),
  };

  const outPath = join(
    __dirname,
    '..',
    'data',
    'samples',
    'figure-1-path.json',
  );
  writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`Figure 1 data written to ${outPath}`);
  return data;
}

/**
 * Generates data for Figure 2: rolling estimates with confidence intervals.
 */
export function generateFigure2() {
  setSeed(123);
  const H0 = 0.14;
  const n = 1500;
  const windowSize = 512;
  const step = 20;
  const path = generateFBM(n, H0);

  const rksavr = new RKSAVR({
    scaleA1: 1,
    scaleA2: 50,
    sampleSize: 500,
    iterations: 16,
    blockSize: 16,
  });

  const rolling = rksavr.rolling(path, windowSize, step);
  const estimates = rolling.filter((r) => r.H !== null);

  // Add confidence intervals
  const withCI = estimates.map((r) => {
    const ci = confidenceInterval(r.H, 1, 50, 500, 500, 0.05);
    return {
      t: r.t,
      H: r.H,
      lower: ci.lower,
      upper: ci.upper,
    };
  });

  const data = {
    figure: 2,
    title: 'Rolling Window H Estimation with 95% CI',
    trueH: H0,
    n,
    windowSize,
    step,
    estimates: withCI,
  };

  const outPath = join(
    __dirname,
    '..',
    'data',
    'samples',
    'figure-2-rolling.json',
  );
  writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`Figure 2 data written to ${outPath}`);
  return data;
}

/**
 * Generates data for Figure 3: multi-scale scaling profile.
 */
export function generateFigure3() {
  setSeed(456);
  const H0 = 0.1;
  const n = 1024;
  const path = generateFBM(n, H0);

  const scales = [1, 2, 5, 10, 20, 50];
  const weights = [1.0, 0.9, 0.7, 0.5, 0.3, 0.1];

  const rksavr = new RKSAVR({
    scales,
    weights,
    sampleSize: 500,
    iterations: 8,
  });

  const {H, profile} = rksavr.rollingMultiScale(path, n, scales, weights, n)[0];

  const data = {
    figure: 3,
    title: 'Multi-Scale Scaling Profile',
    trueH: H0,
    estimatedH: H,
    scales,
    weights,
    profile,
  };

  const outPath = join(
    __dirname,
    '..',
    'data',
    'samples',
    'figure-3-profile.json',
  );
  writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`Figure 3 data written to ${outPath}`);
  return data;
}

/**
 * Runs all figure generation.
 */
export function main() {
  generateFigure1();
  generateFigure2();
  generateFigure3();
  console.log('All figure data generated.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
