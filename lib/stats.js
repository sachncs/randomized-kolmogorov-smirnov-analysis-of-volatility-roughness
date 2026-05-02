/**
 * Statistical utilities for RK-SAVR
 */

/**
 * Computes the Kolmogorov-Smirnov distance between two samples.
 * @param {number[]|Float64Array} sample1 
 * @param {number[]|Float64Array} sample2 
 * @param {boolean} isSorted Whether the samples are already sorted.
 * @returns {number}
 */
export function ksDistance(sample1, sample2, isSorted = false) {
    const s1 = isSorted ? sample1 : [...sample1].sort((a, b) => a - b);
    const s2 = isSorted ? sample2 : [...sample2].sort((a, b) => a - b);
    
    let i = 0;
    let j = 0;
    let maxDist = 0;
    
    const n1 = s1.length;
    const n2 = s2.length;
    
    while (i < n1 && j < n2) {
        const x1 = s1[i];
        const x2 = s2[j];
        
        if (x1 < x2) {
            i++;
        } else if (x1 > x2) {
            j++;
        } else {
            i++;
            j++;
        }
        
        const dist = Math.abs(i / n1 - j / n2);
        if (dist > maxDist) maxDist = dist;
    }
    
    return maxDist;
}

/**
 * Fisher-Yates shuffle
 * @param {any[]} array 
 * @returns {any[]}
 */
export function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Randomly samples n elements from an array using Floyd's algorithm or simple selection.
 * @param {any[]} array 
 * @param {number} n 
 * @returns {any[]}
 */
export function randomSample(array, n) {
    const len = array.length;
    if (n >= len) return shuffle(array);
    
    // Reservoir sampling or simple selection if n is small relative to len
    const result = new Array(n);
    const selected = new Set();
    
    for (let i = 0; i < n; i++) {
        let idx;
        do {
            idx = Math.floor(Math.random() * len);
        } while (selected.has(idx));
        selected.add(idx);
        result[i] = array[idx];
    }
    
    return result;
}
