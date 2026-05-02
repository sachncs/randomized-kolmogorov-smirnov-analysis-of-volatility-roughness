/**
 * Fractional Brownian Motion generation using Hosking's method.
 */

/**
 * Generates Fractional Gaussian Noise (fGN)
 * @param {number} n Length
 * @param {number} H Hurst parameter
 * @returns {number[]}
 */
export function generateFGN(n, H) {
    const autocov = (k, H) => {
        return 0.5 * (Math.pow(Math.abs(k + 1), 2 * H) - 2 * Math.pow(Math.abs(k), 2 * H) + Math.pow(Math.abs(k - 1), 2 * H));
    };

    const x = new Array(n);
    const phi = new Array(n);
    const psi = new Array(n);
    
    // Initial value
    x[0] = Math.sqrt(2 * Math.PI) * (Math.random() + Math.random() + Math.random() + Math.random() - 2) / Math.sqrt(4/12 * 12); // Simple normal approx
    // Better normal approx: Box-Muller
    const randn = () => {
        let u = 0, v = 0;
        while(u === 0) u = Math.random();
        while(v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    };

    x[0] = randn();
    let v = 1;
    
    const r = new Array(n);
    for(let i=0; i<n; i++) r[i] = autocov(i, H);

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
        phi[i-1] = nextPhi;
        
        v = v * (1 - nextPhi * nextPhi);
        
        let mean = 0;
        for (let j = 0; j < i; j++) {
            mean += phi[j] * x[i - 1 - j];
        }
        x[i] = mean + Math.sqrt(v) * randn();
    }
    
    return x;
}

/**
 * Generates Fractional Brownian Motion (fBm)
 * @param {number} n Length
 * @param {number} H Hurst parameter
 * @returns {number[]}
 */
export function generateFBM(n, H) {
    const fgn = generateFGN(n, H);
    const fbm = new Array(n);
    fbm[0] = 0;
    for (let i = 1; i < n; i++) {
        fbm[i] = fbm[i - 1] + fgn[i - 1];
    }
    return fbm;
}
