/**
 * Shared random number generation utilities.
 * Implements Hosking's method for fGN and Box-Muller for normals.
 * Google JS Style Guide compliant.
 */

/**
 * Standard normal via Box-Muller.
 * @return {number} Standard normal random variable.
 */
export function randn() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Batch of standard normals.
 * @param {number} n Number of samples.
 * @return {Float64Array} Standard normals.
 */
export function randnBatch(n) {
  const result = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = randn();
  }
  return result;
}

/**
 * Correlated standard normals via Cholesky.
 * @param {number} n Number of samples.
 * @param {number} rho Correlation (-1, 1).
 * @return {Array<Float64Array>} [Z1, Z2] correlated normals.
 */
export function correlatedGaussian(n, rho) {
  const Z1 = new Float64Array(n);
  const Z2 = new Float64Array(n);
  const sqrt1Rho2 = Math.sqrt(Math.max(0, 1 - rho * rho));

  for (let i = 0; i < n; i++) {
    // Box-Muller: one (u1, u2) pair produces two normals
    const u1 = Math.random();
    const u2 = Math.random();
    const z1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    const z2 = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
    Z1[i] = z1;
    Z2[i] = rho * z1 + sqrt1Rho2 * z2;
  }

  return [Z1, Z2];
}

/**
 * Generates Fractional Gaussian Noise (fGN) using Hosking's method.
 * O(n^2) but exact for any H in (0,1).
 * @param {number} n Length.
 * @param {number} H Hurst parameter (0 < H < 1).
 * @return {Float64Array} fGN sample.
 */
export function generateFGN(n, H) {
  if (n <= 0) return new Float64Array(0);
  if (H <= 0 || H >= 1) {
    throw new Error('H must satisfy 0 < H < 1');
  }

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
 * Precomputes the Riemann-Liouville fractional kernel.
 * K(t) = sqrt(2H) * t^{H-0.5} for t > 0
 * @param {number} H Hurst parameter.
 * @param {number} nSteps Number of time steps.
 * @param {number} dt Time step.
 * @return {Float64Array} Kernel values.
 */
export function fractionalKernel(H, nSteps, dt) {
  const kernel = new Float64Array(nSteps);
  const coeff = Math.sqrt(2 * H);
  for (let i = 0; i < nSteps; i++) {
    const t = (i + 1) * dt;
    kernel[i] = coeff * Math.pow(t, H - 0.5);
  }
  return kernel;
}

/**
 * Computes fractional Brownian motion increment using precomputed kernel.
 * I_t = sum_{j=0}^{t-1} K(t-j) * dW_j
 * @param {Float64Array} dW Brownian increments.
 * @param {Float64Array} kernel Precomputed kernel.
 * @param {number} t Current time index (exclusive upper bound).
 * @return {number} Fractional integral value at time t.
 */
export function fractionalIntegral(dW, kernel, t) {
  let sum = 0;
  for (let j = 0; j < t; j++) {
    sum += kernel[t - 1 - j] * dW[j];
  }
  return sum;
}