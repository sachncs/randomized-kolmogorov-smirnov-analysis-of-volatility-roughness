/**
 * Seeded pseudo-random number generator.
 * Uses mulberry32 for fast, seedable 32-bit PRNG.
 * Falls back to Math.random() when no seed is set.
 */

let seededRng = null;

/**
 * mulberry32 PRNG.
 * @param {number} seed PRNG seed.
 * @return {function(): number} Random generator function.
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
 * Pass null or call reset() to revert to Math.random().
 * @param {number|null} seed
 */
export function setSeed(seed) {
  if (seed === null || seed === undefined) {
    seededRng = null;
  } else {
    seededRng = mulberry32(seed >>> 0);
  }
}

/**
 * Resets the PRNG to use Math.random().
 */
export function resetSeed() {
  seededRng = null;
}

/**
 * Returns a random number in [0, 1).
 * Uses the seeded generator if available, otherwise Math.random().
 * @return {number} Random number in [0, 1).
 */
export function random() {
  return seededRng ? seededRng() : Math.random();
}
