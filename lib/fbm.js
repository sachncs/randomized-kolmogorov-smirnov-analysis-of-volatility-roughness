/**
 * Fractional Brownian Motion generation using Hosking's method.
 * Google JS Style Guide compliant.
 */

/**
 * Generates Fractional Gaussian Noise (fGN).
 * @param {number} n Length.
 * @param {number} H Hurst parameter.
 * @return {Float64Array} fGN sample.
 */
export function generateFGN(n, H) {
  if (n <= 0) return new Float64Array(0);

  // Autocovariance function: gamma(k) = 0.5 * (|k+1|^{2H} - 2|k|^{2H} + |k-1|^{2H})
  const autocov = (k) => {
    const absK = Math.abs(k);
    return 0.5 * (
        Math.pow(absK + 1, 2 * H) -
        2 * Math.pow(absK, 2 * H) +
        Math.pow(Math.abs(absK - 1), 2 * H)
    );
  };

  const x = new Float64Array(n);
  const phi = new Float64Array(n);
  const psi = new Float64Array(n);

  // Box-Muller for initial normal
  const randn = boxMuller;
  x[0] = randn();
  let v = 1.0;

  const r = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    r[i] = autocov(i);
  }

  phi[0] = 0;

  for (let i = 1; i < n; i++) {
    let num = r[i];
    for (let j = 0; j < i - 1; j++) {
      num -= phi[j] * r[i - 1 - j];
    }
    const nextPhi = num / v;

    for (let j = 0; j < i - 1; j++) {
      psi[j] = phi[j] - nextPhi * phi[i - 2 - j];
    }
    for (let j = 0; j < i - 1; j++) {
      phi[j] = psi[j];
    }
    phi[i - 1] = nextPhi;

    v *= (1 - nextPhi * nextPhi);

    let mean = 0;
    for (let j = 0; j < i; j++) {
      mean += phi[j] * x[i - 1 - j];
    }
    x[i] = mean + Math.sqrt(Math.max(0, v)) * randn();
  }

  return x;
}

/**
 * Generates Fractional Brownian Motion (fBm) by cumulative sum of fGN.
 * @param {number} n Length.
 * @param {number} H Hurst parameter.
 * @return {Float64Array} fBm path.
 */
export function generateFBM(n, H) {
  if (n <= 0) return new Float64Array(0);

  const fgn = generateFGN(n, H);
  const fbm = new Float64Array(n);
  fbm[0] = 0;

  for (let i = 1; i < n; i++) {
    fbm[i] = fbm[i - 1] + fgn[i - 1];
  }

  return fbm;
}

/**
 * Box-Muller transform for standard normal random variables.
 * @return {number} Standard normal.
 */
function boxMuller() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}