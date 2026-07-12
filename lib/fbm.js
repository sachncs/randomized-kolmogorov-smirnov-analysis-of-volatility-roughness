/**
 * @fileoverview Fractional Brownian motion re-exports.
 *
 * Backward-compatible shim that re-exports the fBM/fGN helpers from the
 * canonical implementation in `random.js`. Existing user code that
 * imports `rksavr/fbm` continues to work after the helpers were moved
 * into the shared random-utils module.
 *
 * @see ./random.js for the full documentation and the Hosking-method
 *   implementation.
 */

export {generateFGN, generateFBM} from './random.js';
