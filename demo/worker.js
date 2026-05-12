/**
 * RK-SAVR Observatory — Web Worker.
 * Handles heavy computation off the main thread.
 */

import {
  RKSAVR,
  generateFBM,
  rBergomiPrice,
  rFSVPrice,
  fOU,
  mPRE,
  setSeed,
  resetSeed,
  significanceTest,
  confidenceInterval,
  standardError,
} from '../lib/index.js';

/**
 * Generates a synthetic path from the selected model.
 * @param {Object} opts
 * @param {string} opts.model Model name.
 * @param {number} opts.nSteps Number of steps.
 * @param {number} opts.h Hurst parameter.
 * @param {number} opts.seed PRNG seed.
 * @return {Array<number>} Path values.
 */
function generatePath(opts) {
  setSeed(opts.seed || 42);
  let path;
  switch (opts.model) {
    case 'rBergomi':
      path = rBergomiPrice({nPaths: 1, nSteps: opts.nSteps, h: opts.h})
        .prices[0];
      break;
    case 'rFSV':
      path = rFSVPrice({nSteps: opts.nSteps, h: opts.h}).prices;
      break;
    case 'fOU':
      path = fOU({nSteps: opts.nSteps, h: opts.h}).path;
      break;
    case 'mPRE':
      path = mPRE({
        nSteps: opts.nSteps,
        hMin: 0.05,
        hMax: 0.95,
        h0: opts.h,
      }).path;
      break;
    default:
      path = generateFBM(opts.nSteps, opts.h);
  }
  resetSeed();
  return path;
}

self.onmessage = function (e) {
  const {id, cmd, payload} = e.data;

  try {
    switch (cmd) {
      case 'generate': {
        const path = generatePath(payload);
        self.postMessage({type: 'complete', id, result: {path}});
        break;
      }

      case 'single': {
        const {path, config} = payload;
        const rksavr = new RKSAVR(config);
        const {H, minimizedD} = rksavr.estimateSingleWithDiagnostics(path);
        const n = config.sampleSize || 500;
        const m = n;
        const sig = significanceTest(minimizedD, n, m, 0.05);
        const se = standardError(
          config.scaleA1 || 1,
          config.scaleA2 || 25,
          n,
          m,
        );
        const ci = confidenceInterval(H, se, 0.05);
        self.postMessage({
          type: 'complete',
          id,
          result: {H, minimizedD, significance: sig, se, ci},
        });
        break;
      }

      case 'rolling': {
        const {path, windowSize, step, config} = payload;
        const rksavr = new RKSAVR(config);
        const results = rksavr.rolling(
          path,
          windowSize,
          step || 1,
          (progress) => {
            self.postMessage({type: 'progress', id, progress});
          },
        );
        self.postMessage({type: 'complete', id, result: {results}});
        break;
      }

      case 'batch': {
        const {paths, config} = payload;
        const rksavr = new RKSAVR(config);
        const results = paths.map((path, idx) => {
          self.postMessage({
            type: 'progress',
            id,
            progress: (idx + 1) / paths.length,
          });
          try {
            const H = rksavr.estimateSingle(path);
            return {H, error: null};
          } catch (err) {
            return {H: null, error: err.message};
          }
        });
        self.postMessage({type: 'complete', id, result: {results}});
        break;
      }

      case 'explorer': {
        const {
          trueHs,
          windowSizes,
          optimizers,
          nTrials,
          pathLength,
          configBase,
        } = payload;
        const results = [];
        let completed = 0;
        const total =
          trueHs.length * windowSizes.length * optimizers.length * nTrials;

        for (const trueH of trueHs) {
          for (const w of windowSizes) {
            for (const opt of optimizers) {
              const errors = [];
              const times = [];
              for (let t = 0; t < nTrials; t++) {
                const path = generatePath({
                  model: 'fBM',
                  nSteps: pathLength,
                  h: trueH,
                  seed: t + 1,
                });
                const cfg = {
                  ...configBase,
                  optimizerType: opt,
                  sampleSize: Math.min(500, w),
                };
                const rksavr = new RKSAVR(cfg);
                const t0 = performance.now();
                try {
                  const H = rksavr.estimateSingle(path.slice(0, w));
                  errors.push(H - trueH);
                } catch (_err) {
                  errors.push(NaN);
                }
                times.push(performance.now() - t0);
                completed++;
                self.postMessage({
                  type: 'progress',
                  id,
                  progress: completed / total,
                });
              }
              const valid = errors.filter((e) => Number.isFinite(e));
              results.push({
                trueH,
                windowSize: w,
                optimizer: opt,
                rmse: valid.length
                  ? Math.sqrt(
                      valid.reduce((a, b) => a + b * b, 0) / valid.length,
                    )
                  : NaN,
                bias: valid.length
                  ? valid.reduce((a, b) => a + b, 0) / valid.length
                  : NaN,
                failRate: (nTrials - valid.length) / nTrials,
                avgTime: times.reduce((a, b) => a + b, 0) / times.length,
              });
            }
          }
        }
        self.postMessage({type: 'complete', id, result: {results}});
        break;
      }

      default:
        self.postMessage({
          type: 'error',
          id,
          message: `Unknown command: ${cmd}`,
        });
    }
  } catch (err) {
    self.postMessage({type: 'error', id, message: err.message});
  }
};
