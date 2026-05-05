import { RKSAVR } from '../lib/rksavr.js';

self.onmessage = function(e) {
    const { series, windowSize, step, config } = e.data;

    try {
        const rksavr = new RKSAVR(config);
        const results = rksavr.rolling(series, windowSize, step, (progress) => {
            self.postMessage({ type: 'progress', progress });
        });
        self.postMessage({ type: 'complete', results });
    } catch (err) {
        self.postMessage({ type: 'error', message: err.message });
    }
};
