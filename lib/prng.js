/**
 * @fileoverview Seeded pseudo-random number generator.
 *
 * All stochastic primitives in the library (`stats.js`, `random.js`,
 * `models/*`, `data/synthetic.js`) route their randomness through a
 * single global dispatcher exposed here. This makes the entire pipeline
 * deterministically reproducible: call `setSeed(seed)` once at the top of
 * a script and every downstream draw follows the same sequence.
 *
 * The default generator is **mulberry32**, a tiny 32-bit state machine
 * with a 2^32 period that passes most statistical tests for non-crypto
 * workloads. It is **not** cryptographically secure — do not use it for
 * key generation, tokens, or anything that requires unpredictability.
 *
 * ## Lifecycle
 *
 * 1. `setSeed(seed)` captures the seed and constructs a fresh generator.
 *    The previous generator (if any) is discarded.
 * 2. Every `random()` call advances the global generator by one step.
 * 3. `resetSeed()` (or `setSeed(null)`) clears the global generator so
 *    subsequent `random()` calls fall back to `Math.random()`.
 *
 * @see https://github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32
 *   for the canonical mulberry32 implementation reference.
 */

let seededRng = null;

/**
 * Constructs a mulberry32 generator with the given 32-bit seed.
 *
 * The algorithm packs the state into a single unsigned 32-bit integer
 * `a`. Each call applies two well-known integer mixing steps
 * (`Math.imul` & bitwise shift) and returns the result divided by
 * `2^32` so the output is in `[0, 1)`.
 *
 * @private
 * @param {number} seed PRNG seed (will be coerced to a 32-bit unsigned
 *   integer; `>>> 0` performs the conversion).
 * @return {function(): number} A function that returns the next uniform
 *   sample on every call.
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sets a global seed for reproducible simulations.
 *
 * Passing `null` or `undefined` clears the seed and reverts to
 * `Math.random()`. Calling `setSeed` twice restarts the deterministic
 * sequence from scratch.
 *
 * @param {number|null|undefined} seed Integer seed (coerced to 32-bit).
 *   `null`/`undefined` clears the seed.
 */
export function setSeed(seed) {
  if (seed === null || seed === undefined) {
    seededRng = null;
  } else {
    seededRng = mulberry32(seed >>> 0);
  }
}

/**
 * Resets the PRNG to use `Math.random()` for all subsequent draws.
 *
 * Equivalent to `setSeed(null)`. Use this at the end of a deterministic
 * experiment to restore nondeterministic behavior.
 */
export function resetSeed() {
  seededRng = null;
}

/**
 * Returns a uniform random number in `[0, 1)`.
 *
 * Uses the seeded generator when one has been installed via `setSeed`,
 * otherwise falls through to `Math.random()`. Because this dispatcher is
 * called from every stochastic primitive in the library, the *entire*
 * computation tree is reproducible from a single seed.
 *
 * @return {number} A pseudo-random number in `[0, 1)`.
 */
export function random() {
  return seededRng ? seededRng() : Math.random();
}
