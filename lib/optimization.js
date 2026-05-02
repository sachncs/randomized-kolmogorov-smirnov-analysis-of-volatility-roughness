/**
 * Brent's Method for 1D minimization.
 * Ported and adapted for RK-SAVR.
 */

/**
 * Minimizes a function f(x) on the interval [ax, cx].
 * @param {Function} f The function to minimize.
 * @param {number} ax Lower bound.
 * @param {number} bx An initial guess (optional, if not provided, (ax+cx)/2 is used).
 * @param {number} cx Upper bound.
 * @param {number} tol Tolerance.
 * @returns {Object} { x: minimum_x, f: minimum_f }
 */
export function brentMinimize(f, ax, bx, cx, tol = 1e-6) {
    const GOLDEN = 0.3819660; // 3 - sqrt(5) / 2
    const EPS = 1e-10;

    let a = Math.min(ax, cx);
    let b = Math.max(ax, cx);
    
    let x = bx || (a + b) / 2;
    let w = x;
    let v = x;
    
    let fx = f(x);
    let fw = fx;
    let fv = fx;
    
    let d = 0;
    let e = 0;
    
    for (let iter = 0; iter < 100; iter++) {
        const xm = 0.5 * (a + b);
        const tol1 = tol * Math.abs(x) + EPS;
        const tol2 = 2.0 * tol1;
        
        if (Math.abs(x - xm) <= (tol2 - 0.5 * (b - a))) {
            return { x, f: fx };
        }
        
        if (Math.abs(e) > tol1) {
            let r = (x - w) * (fx - fv);
            let q = (x - v) * (fx - fw);
            let p = (x - v) * q - (x - w) * r;
            q = 2.0 * (q - r);
            if (q > 0.0) p = -p;
            q = Math.abs(q);
            const etemp = e;
            e = d;
            
            if (Math.abs(p) >= Math.abs(0.5 * q * etemp) || p <= q * (a - x) || p >= q * (b - x)) {
                e = (x >= xm ? a - x : b - x);
                d = GOLDEN * e;
            } else {
                d = p / q;
                const u = x + d;
                if (u - a < tol2 || b - u < tol2) {
                    d = (xm - x >= 0 ? tol1 : -tol1);
                }
            }
        } else {
            e = (x >= xm ? a - x : b - x);
            d = GOLDEN * e;
        }
        
        const u = (Math.abs(d) >= tol1 ? x + d : x + (d >= 0 ? tol1 : -tol1));
        const fu = f(u);
        
        if (fu <= fx) {
            if (u >= x) a = x; else b = x;
            v = w; fv = fw;
            w = x; fw = fx;
            x = u; fx = fu;
        } else {
            if (u < x) a = u; else b = u;
            if (fu <= fw || w === x) {
                v = w; fv = fw;
                w = u; fw = fu;
            } else if (fu <= fv || v === x || v === w) {
                v = u; fv = fu;
            }
        }
    }
    
    return { x, f: fx };
}
