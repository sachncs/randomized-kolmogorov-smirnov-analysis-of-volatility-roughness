## Classes

<dl>
<dt><a href="#RKSAVR">RKSAVR</a></dt>
<dd><p>RK-SAVR Estimator class.
Estimates Hurst parameter (H) for rough volatility models.
H must satisfy 0 &lt; H &lt; 1.</p>
</dd>
</dl>

## Members

<dl>
<dt><a href="#seededRng">seededRng</a></dt>
<dd><p>Seeded pseudo-random number generator.
Uses mulberry32 for fast, seedable 32-bit PRNG.
Falls back to Math.random() when no seed is set.</p>
</dd>
</dl>

## Constants

<dl>
<dt><a href="#LogLevel">LogLevel</a></dt>
<dd><p>Minimal logging framework for RK-SAVR.
Defaults to WARN level in production; can be tuned via setLogLevel.</p>
</dd>
<dt><a href="#_binomialCache">_binomialCache</a> ⇒ <code>Array.&lt;number&gt;</code></dt>
<dd><p>Computes fractional difference of a series.
(1-L)^d X_t = sum_{k=0}^{infty} binomial(d, k) (-1)^k X_{t-k}</p>
</dd>
<dt><a href="#MODEL_REGISTRY">MODEL_REGISTRY</a></dt>
<dd><p>Model registry for dynamic lookup.
Maps model names to their exported entry points.</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#parseCSV">parseCSV(csv, opts)</a> ⇒ <code>Array.&lt;Object&gt;</code></dt>
<dd><p>Parses a CSV string into an array of objects.
Expects the first row to be headers.
Handles basic quoting and comma separation.</p>
</dd>
<dt><a href="#extractSeries">extractSeries(rows, field, opts)</a> ⇒ <code>Array.&lt;{date: Date, value: number}&gt;</code></dt>
<dd><p>Extracts a numeric time series from parsed CSV rows.</p>
</dd>
<dt><a href="#parseJSON">parseJSON(json)</a> ⇒ <code>Array.&lt;Object&gt;</code></dt>
<dd><p>Loads and parses a JSON array of objects.</p>
</dd>
<dt><a href="#validateNoGaps">validateNoGaps(series, maxGapMs)</a> ⇒ <code>Object</code></dt>
<dd><p>Validates that a time series has no gaps larger than a threshold.</p>
</dd>
<dt><a href="#downsample">downsample(series, intervalMs)</a> ⇒ <code>Array.&lt;{date: Date, value: number}&gt;</code></dt>
<dd><p>Downsamples a time series to a target frequency by averaging.</p>
</dd>
<dt><a href="#computeRV">computeRV(prices, interval)</a> ⇒ <code>Array.&lt;number&gt;</code></dt>
<dd><p>Computes 5-minute realized volatility from intraday log-returns.
RV = sum_i (r_i)^2 where r_i = log(P_{t_i}) - log(P_{t_{i-1}})</p>
</dd>
<dt><a href="#computeRVParkinson">computeRVParkinson(bars)</a> ⇒ <code>Array.&lt;number&gt;</code></dt>
<dd><p>Computes 5-minute RV from OHLC bars using the Parkinson estimator.
More efficient than tick-based RV when only OHLC is available.</p>
</dd>
<dt><a href="#aggregateDailyRV">aggregateDailyRV(intradayRVs)</a> ⇒ <code>number</code></dt>
<dd><p>Computes daily realized volatility from intraday 5-minute RVs.
Aggregates intraday RVs into a single daily RV figure.</p>
</dd>
<dt><a href="#logTransform">logTransform(rv)</a> ⇒ <code>Array.&lt;number&gt;</code></dt>
<dd><p>Applies log-transformation to a volatility series.
The paper uses log-volatility: X_t = log(sqrt(RV_t))</p>
</dd>
<dt><a href="#centerSeries">centerSeries(series)</a> ⇒ <code>Array.&lt;number&gt;</code></dt>
<dd><p>Removes the mean (centers) a time series.</p>
</dd>
<dt><a href="#standardizeSeries">standardizeSeries(series)</a> ⇒ <code>Array.&lt;number&gt;</code></dt>
<dd><p>Standardizes a time series to zero mean and unit variance.</p>
</dd>
<dt><a href="#preprocessPipeline">preprocessPipeline(prices, opts)</a> ⇒ <code>Array.&lt;number&gt;</code></dt>
<dd><p>Full preprocessing pipeline: prices -&gt; RV -&gt; log-vol -&gt; center.</p>
</dd>
<dt><a href="#trainTestSplit">trainTestSplit(series, trainRatio)</a> ⇒ <code>Object</code></dt>
<dd><p>Splits a series into train/test sets.</p>
</dd>
<dt><a href="#createWindows">createWindows(series, windowSize, step)</a> ⇒ <code>Array.&lt;Array.&lt;number&gt;&gt;</code></dt>
<dd><p>Creates overlapping windows from a series.</p>
</dd>
<dt><a href="#generateVIXLogVol">generateVIXLogVol(nDays, h, opts)</a> ⇒ <code>Array.&lt;number&gt;</code></dt>
<dd><p>Generates synthetic VIX-style daily log-volatility.
Uses fractional Brownian motion with H ~ 0.1 and realistic drift/noise.
This ensures the generated series has the exact target Hurst parameter
for estimator validation.</p>
</dd>
<dt><a href="#generateSPXLogVol">generateSPXLogVol(nDays, h, opts)</a> ⇒ <code>Array.&lt;number&gt;</code></dt>
<dd><p>Generates synthetic S&amp;P 500 realized volatility style data.
Uses fractional Brownian motion with H ~ 0.14 (empirical estimate from paper).</p>
</dd>
<dt><a href="#generateIntradayPrices">generateIntradayPrices(nIntraday, nDays, h, opts)</a> ⇒ <code>Array.&lt;Array.&lt;number&gt;&gt;</code></dt>
<dd><p>Generates synthetic intraday 5-minute prices for RV computation testing.
Uses a simple rough volatility + Brownian motion model.</p>
</dd>
<dt><a href="#seriesToCSV">seriesToCSV(series, dateHeader, valueHeader)</a> ⇒ <code>string</code></dt>
<dd><p>Exports a series as CSV string.</p>
</dd>
<dt><a href="#ksCriticalValue">ksCriticalValue(n, m, alpha)</a> ⇒ <code>number</code></dt>
<dd><p>Computes the asymptotic critical value for the two-sample KS test.
D_alpha = sqrt(-0.5 * ln(alpha/2)) * sqrt((n+m)/(n*m))</p>
</dd>
<dt><a href="#ksPvalue">ksPvalue(D, n, m)</a> ⇒ <code>number</code></dt>
<dd><p>Approximate p-value for the two-sample KS statistic D.
Uses the asymptotic Kolmogorov distribution approximation.</p>
</dd>
<dt><a href="#significanceTest">significanceTest(D, n, m, alpha)</a> ⇒ <code>Object</code></dt>
<dd><p>Significance test for the minimized KS distance after H estimation.
Compares the minimized KS statistic D against the asymptotic critical value.</p>
</dd>
<dt><a href="#cusumTest">cusumTest(hHistory, targetH, threshold)</a> ⇒ <code>Object</code></dt>
<dd><p>CUSUM test for detecting structural breaks in H(t) series.</p>
</dd>
<dt><a href="#detectBreakpoints">detectBreakpoints(hHistory, windowSize, threshold)</a> ⇒ <code>Array.&lt;{index: number, H_before: number, H_after: number}&gt;</code></dt>
<dd><p>Detects breakpoints in a time series of H estimates using
a sliding window CUSUM approach.</p>
</dd>
<dt><a href="#bootstrapCI">bootstrapCI(estimator, window, nBoot, alpha)</a> ⇒ <code>Object</code></dt>
<dd><p>Bootstrap confidence interval for H estimate.</p>
</dd>
<dt><a href="#asymptoticVariance">asymptoticVariance(scaleA1, scaleA2, n, m)</a> ⇒ <code>number</code></dt>
<dd><p>Computes asymptotic variance based on Proposition 2.9.
Var(H_hat) = (2 * pi * e) / (ln(a))^2 * (1/sqrt(n) + 1/sqrt(m))^2</p>
</dd>
<dt><a href="#standardError">standardError(scaleA1, scaleA2, n, m)</a> ⇒ <code>number</code></dt>
<dd><p>Computes standard error of H estimate.</p>
</dd>
<dt><a href="#confidenceInterval">confidenceInterval(HEstimate, scaleA1, scaleA2, n, m, alpha)</a> ⇒ <code>Object</code></dt>
<dd><p>Constructs confidence interval for H.
Uses the asymptotic normality result from Prop 2.9.</p>
</dd>
<dt><a href="#kalmanFilter">kalmanFilter(observations, opts)</a> ⇒ <code>Object</code></dt>
<dd><p>Kalman filter for state-space modeling of H(t).
Simple 1D Kalman filter for tracking H over time.
State: x_t = H_t (Hurst parameter)
Transition: H_t = H_{t-1} + w_t, w_t ~ N(0, q)
Observation: z_t = H_t + v_t, v_t ~ N(0, r)</p>
</dd>
<dt><a href="#constancyTest">constancyTest(observations, opts)</a> ⇒ <code>Object</code></dt>
<dd><p>Constancy test for H(t) using likelihood ratio on Kalman filter process noise.
Tests H0: q = 0 (constant H) vs H1: q &gt; 0 (time-varying H).</p>
</dd>
<dt><a href="#normalQuantile">normalQuantile(p)</a> ⇒ <code>number</code></dt>
<dd><p>Inverse standard normal CDF (quantile function).</p>
</dd>
<dt><a href="#setLogLevel">setLogLevel(level)</a></dt>
<dd><p>Sets the current log level.</p>
</dd>
<dt><a href="#getLogLevel">getLogLevel()</a> ⇒ <code>number</code></dt>
<dd><p>Gets the current log level.</p>
</dd>
<dt><a href="#debug">debug(...args)</a></dt>
<dd></dd>
<dt><a href="#info">info(...args)</a></dt>
<dd></dd>
<dt><a href="#warn">warn(...args)</a></dt>
<dd></dd>
<dt><a href="#error">error(...args)</a></dt>
<dd></dd>
<dt><a href="#arfima">arfima(opts)</a> ⇒ <code>function</code></dt>
<dd><p>ARFIMA(p, d, q) model for fractional differencing.</p>
<p>The ARFIMA model combines autoregressive (AR) and moving average (MA)
terms with fractional differencing (d) to capture long-memory processes.</p>
</dd>
<dt><a href="#holtWintersForecast">holtWintersForecast(series, alpha, beta)</a> ⇒ <code>number</code></dt>
<dd><p>Holt-Winters exponential smoothing forecast.</p>
</dd>
<dt><a href="#createLSTM">createLSTM(opts)</a> ⇒ <code>Object</code></dt>
<dd><p>Creates a minimal LSTM-like recurrent cell for H forecasting.
Stateless: processes a full sequence and produces a hidden state.</p>
</dd>
<dt><a href="#createAttentionModel">createAttentionModel(opts)</a> ⇒ <code>Object</code></dt>
<dd><p>Creates a minimal Transformer-style attention model for H forecasting.
Stateless: processes a full sequence and produces an aggregated hidden state.</p>
</dd>
<dt><a href="#fOU">fOU(params)</a> ⇒ <code>Object</code></dt>
<dd><p>Generates fOU sample paths using Euler-Maruyama discretization.
For H = 0.5, uses exact discretization.</p>
</dd>
<dt><a href="#exactOU">exactOU(params)</a> ⇒ <code>Object</code></dt>
<dd><p>Alternative fOU using exact Riemann-Liouville integral representation.
More accurate but slower for long time series.</p>
</dd>
<dt><a href="#getModel">getModel(name)</a> ⇒ <code>Object</code> | <code>undefined</code></dt>
<dd><p>Retrieves a registered model by name.</p>
</dd>
<dt><a href="#registerModel">registerModel(name, entry)</a></dt>
<dd><p>Registers a new model in the factory.</p>
</dd>
<dt><a href="#listModels">listModels()</a> ⇒ <code>Array.&lt;string&gt;</code></dt>
<dd><p>Lists all registered model names.</p>
</dd>
<dt><a href="#mpre">mpre(params)</a> ⇒ <code>Object</code></dt>
<dd><p>Generates MPRE sample paths using approximation.
H evolves as an Ornstein-Uhlenbeck process.
The path is approximated using the local Hölder exponent at each point.</p>
</dd>
<dt><a href="#mpreExact">mpreExact(params)</a> ⇒ <code>Object</code></dt>
<dd><p>MPRE with continuous H evolution using exact fractional representation.
More accurate but O(n^2) - use for short series only.</p>
</dd>
<dt><a href="#rBergomi">rBergomi(params)</a> ⇒ <code>Object</code></dt>
<dd><p>Generates rough Bergomi volatility paths.
The variance process follows:
  V_t = xi * exp(eta * I_t - (eta^2/2) * t^{2H})
where I_t is the Riemann-Liouville fractional integral of W^perp.</p>
</dd>
<dt><a href="#rBergomiPrice">rBergomiPrice(params)</a> ⇒ <code>Object</code></dt>
<dd><p>Generates log-price paths under rough volatility.
SDE: dS_t = vol_t * S_t * dW_t
where vol_t = sqrt(V_t) from rBergomi.</p>
</dd>
<dt><a href="#rFSV">rFSV(params)</a> ⇒ <code>Object</code></dt>
<dd><p>Simulates rFSV process.
The volatility has both a classical Heston component and a rough component
driven by fractional Brownian motion.</p>
</dd>
<dt><a href="#rFSVPrice">rFSVPrice(params)</a> ⇒ <code>Object</code></dt>
<dd><p>Generates price path under rFSV.
dS_t = vol_t * S_t * dW_t</p>
</dd>
<dt><a href="#preavgReturns">preavgReturns(prices, windowSize)</a> ⇒ <code>Array.&lt;number&gt;</code></dt>
<dd><p>Preaveraging of returns to reduce microstructure noise.
Computes local averages of returns over a sliding window,
then differences these averages to obtain noise-robust returns.</p>
</dd>
<dt><a href="#realizedKernel">realizedKernel(returns, kernelType, bandwidth)</a> ⇒ <code>number</code></dt>
<dd><p>Realized kernel volatility estimator with Bartlett or other kernels.</p>
</dd>
<dt><a href="#logVolDebias">logVolDebias(rawHEstimates, sigmaObs, sigmaLatent)</a> ⇒ <code>Array.&lt;number&gt;</code></dt>
<dd><p>De-biases log-volatility H estimates by correcting for
observational noise in the volatility proxy.</p>
</dd>
<dt><a href="#brentMinimize">brentMinimize(f, ax, bx, cx, tol)</a> ⇒ <code>Object</code></dt>
<dd><p>Minimizes a function f(x) on the interval [ax, cx] using Brent&#39;s Method.</p>
</dd>
<dt><a href="#nelderMead">nelderMead(f, x0, opts)</a> ⇒ <code>Object</code></dt>
<dd><p>Nelder-Mead (Simplex) method for multi-dimensional minimization.</p>
</dd>
<dt><a href="#simulatedAnnealing">simulatedAnnealing(f, x0, opts)</a> ⇒ <code>Object</code></dt>
<dd><p>Simulated Annealing for global optimization.</p>
</dd>
<dt><a href="#differentialEvolution">differentialEvolution(f, x0, opts)</a> ⇒ <code>Object</code></dt>
<dd><p>Differential Evolution for global optimization.</p>
</dd>
<dt><a href="#adaptiveGridSearch">adaptiveGridSearch(f, min, max, opts)</a> ⇒ <code>Object</code></dt>
<dd><p>Adaptive Grid Search with Brent refinement.</p>
</dd>
<dt><a href="#safeOptimizer">safeOptimizer(opt)</a> ⇒ <code>function</code></dt>
<dd><p>Wraps an optimizer so that failures return NaN instead of throwing.</p>
</dd>
<dt><a href="#getOptimizerFactory">getOptimizerFactory(name)</a> ⇒ <code>function</code> | <code>undefined</code></dt>
<dd><p>Retrieves an optimizer factory by name.</p>
</dd>
<dt><a href="#registerOptimizerFactory">registerOptimizerFactory(name, factory)</a></dt>
<dd><p>Registers a custom optimizer factory.</p>
</dd>
<dt><a href="#mulberry32">mulberry32(seed)</a> ⇒ <code>function</code></dt>
<dd><p>mulberry32 PRNG.</p>
</dd>
<dt><a href="#setSeed">setSeed(seed)</a></dt>
<dd><p>Sets a global seed for reproducible simulations.
Pass null or call reset() to revert to Math.random().</p>
</dd>
<dt><a href="#resetSeed">resetSeed()</a></dt>
<dd><p>Resets the PRNG to use Math.random().</p>
</dd>
<dt><a href="#random">random()</a> ⇒ <code>number</code></dt>
<dd><p>Returns a random number in [0, 1).
Uses the seeded generator if available, otherwise Math.random().</p>
</dd>
<dt><a href="#randn">randn()</a> ⇒ <code>number</code></dt>
<dd><p>Standard normal via Box-Muller.</p>
</dd>
<dt><a href="#randnBatch">randnBatch(n)</a> ⇒ <code>Float64Array</code></dt>
<dd><p>Batch of standard normals.</p>
</dd>
<dt><a href="#correlatedGaussian">correlatedGaussian(n, rho)</a> ⇒ <code>Array.&lt;Float64Array&gt;</code></dt>
<dd><p>Correlated standard normals via Cholesky.</p>
</dd>
<dt><a href="#generateFGN">generateFGN(n, H)</a> ⇒ <code>Float64Array</code></dt>
<dd><p>Generates Fractional Gaussian Noise (fGN) using Hosking&#39;s method.
O(n^2) but exact for any H in (0,1).</p>
</dd>
<dt><a href="#generateFBM">generateFBM(n, H)</a> ⇒ <code>Float64Array</code></dt>
<dd><p>Generates Fractional Brownian Motion (fBm) by cumulative sum of fGN.</p>
</dd>
<dt><a href="#fractionalKernel">fractionalKernel(H, nSteps, dt)</a> ⇒ <code>Float64Array</code></dt>
<dd><p>Precomputes the Riemann-Liouville fractional kernel.
K(t) = sqrt(2H) * t^{H-0.5} for t &gt; 0</p>
</dd>
<dt><a href="#fractionalIntegral">fractionalIntegral(dW, kernel, t)</a> ⇒ <code>number</code></dt>
<dd><p>Computes fractional Brownian motion increment using precomputed kernel.
I_t = sum_{j=0}^{t-1} K(t-j) * dW_j</p>
</dd>
<dt><a href="#defaultSampler">defaultSampler()</a></dt>
<dd><p>Default Sampler: Random selection.</p>
</dd>
<dt><a href="#vectorizedKsObjective">vectorizedKsObjective(sortedSamples, scales, H)</a> ⇒ <code>number</code></dt>
<dd><p>Vectorized KS objective for multi-scale analysis.
Pre-sorted samples, rescale only.</p>
</dd>
<dt><a href="#computeScalePairDistance">computeScalePairDistance(sortedSamples, scales, i, j, H)</a> ⇒ <code>number</code></dt>
<dd><p>Computes KS distance between a pair of rescaled samples.</p>
</dd>
<dt><a href="#buildScaleProfile">buildScaleProfile(sortedSamples, scales, H)</a> ⇒ <code>Array.&lt;number&gt;</code></dt>
<dd><p>Builds a flat profile array of all pairwise KS distances between
rescaled samples at the given scales for a fixed H.</p>
</dd>
<dt><a href="#weightedKsObjective">weightedKsObjective(sortedSamples, scales, weights, H)</a> ⇒ <code>number</code></dt>
<dd><p>Weighted KS objective with scale weights.</p>
</dd>
<dt><a href="#ksDistance">ksDistance(sample1, sample2, isSorted)</a> ⇒ <code>number</code></dt>
<dd><p>Computes the Kolmogorov-Smirnov distance between two samples.
D = sup_x |F_n(x) - G_m(x)| where F_n and G_m are empirical CDFs.
Uses the two-sample KS statistic computation.</p>
</dd>
<dt><a href="#ksDistanceRescaled">ksDistanceRescaled(sortedA, sortedB, factorA, factorB)</a> ⇒ <code>number</code></dt>
<dd><p>Computes KS distance between two pre-sorted samples after rescaling by positive factors.
Avoids array allocation by applying factors during the pointer walk.
Multiplication by a positive scalar preserves ordering, so no re-sorting is needed.</p>
</dd>
<dt><a href="#shuffle">shuffle(array)</a> ⇒ <code>Array.&lt;*&gt;</code></dt>
<dd><p>Fisher-Yates shuffle.
Fisher-Yates shuffle.</p>
</dd>
<dt><a href="#blockPermutation">blockPermutation(data, blockSize, randomPhase)</a> ⇒ <code>Array.&lt;*&gt;</code></dt>
<dd><p>Block random permutation for decorrelating serial dependence.
Partitions data into blocks of length blockSize, shuffles the blocks,
and optionally applies a random phase offset to the starting index.
Preserves marginal distributions while stripping away autocorrelation.</p>
</dd>
<dt><a href="#randomSample">randomSample(array, n)</a> ⇒ <code>Array.&lt;*&gt;</code></dt>
<dd><p>Floyd&#39;s reservoir sampling for random sampling without replacement.
More efficient than Set-based collision detection.</p>
</dd>
</dl>

<a name="seededRng"></a>

## seededRng
Seeded pseudo-random number generator.
Uses mulberry32 for fast, seedable 32-bit PRNG.
Falls back to Math.random() when no seed is set.

**Kind**: global variable  
<a name="LogLevel"></a>

## LogLevel
Minimal logging framework for RK-SAVR.
Defaults to WARN level in production; can be tuned via setLogLevel.

**Kind**: global constant  
<a name="_binomialCache"></a>

## \_binomialCache ⇒ <code>Array.&lt;number&gt;</code>
Computes fractional difference of a series.
(1-L)^d X_t = sum_{k=0}^{infty} binomial(d, k) (-1)^k X_{t-k}

**Kind**: global constant  
**Returns**: <code>Array.&lt;number&gt;</code> - Fractionally differenced series.  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>Array.&lt;number&gt;</code> | Input series. |
| d | <code>number</code> | Differencing parameter. |
| lag | <code>number</code> | Maximum lag for approximation. |

<a name="MODEL_REGISTRY"></a>

## MODEL\_REGISTRY
Model registry for dynamic lookup.
Maps model names to their exported entry points.

**Kind**: global constant  
<a name="parseCSV"></a>

## parseCSV(csv, opts) ⇒ <code>Array.&lt;Object&gt;</code>
Parses a CSV string into an array of objects.
Expects the first row to be headers.
Handles basic quoting and comma separation.

**Kind**: global function  
**Returns**: <code>Array.&lt;Object&gt;</code> - Parsed rows.  

| Param | Type | Description |
| --- | --- | --- |
| csv | <code>string</code> | Raw CSV string. |
| opts | <code>Object</code> | Options. |
| opts.dateField | <code>string</code> | Field to parse as Date (default 'date'). |
| opts.numericFields | <code>Array.&lt;string&gt;</code> | Fields to parse as numbers. |

<a name="extractSeries"></a>

## extractSeries(rows, field, opts) ⇒ <code>Array.&lt;{date: Date, value: number}&gt;</code>
Extracts a numeric time series from parsed CSV rows.

**Kind**: global function  
**Returns**: <code>Array.&lt;{date: Date, value: number}&gt;</code> - Time series.  

| Param | Type | Description |
| --- | --- | --- |
| rows | <code>Array.&lt;Object&gt;</code> | Parsed rows. |
| field | <code>string</code> | Field name to extract. |
| opts | <code>Object</code> | Options. |
| opts.sortByDate | <code>boolean</code> | Sort by date field before extraction. |
| opts.dateField | <code>string</code> | Date field name (default 'date'). |

<a name="parseJSON"></a>

## parseJSON(json) ⇒ <code>Array.&lt;Object&gt;</code>
Loads and parses a JSON array of objects.

**Kind**: global function  
**Returns**: <code>Array.&lt;Object&gt;</code> - Parsed objects.  

| Param | Type | Description |
| --- | --- | --- |
| json | <code>string</code> | Raw JSON string. |

<a name="validateNoGaps"></a>

## validateNoGaps(series, maxGapMs) ⇒ <code>Object</code>
Validates that a time series has no gaps larger than a threshold.

**Kind**: global function  
**Returns**: <code>Object</code> - Validation result.  

| Param | Type | Description |
| --- | --- | --- |
| series | <code>Array.&lt;{date: Date}&gt;</code> | Time series with dates. |
| maxGapMs | <code>number</code> | Maximum allowed gap in milliseconds. |

<a name="downsample"></a>

## downsample(series, intervalMs) ⇒ <code>Array.&lt;{date: Date, value: number}&gt;</code>
Downsamples a time series to a target frequency by averaging.

**Kind**: global function  
**Returns**: <code>Array.&lt;{date: Date, value: number}&gt;</code> - Downsampled series.  

| Param | Type | Description |
| --- | --- | --- |
| series | <code>Array.&lt;{date: Date, value: number}&gt;</code> | Input series. |
| intervalMs | <code>number</code> | Target interval in milliseconds. |

<a name="computeRV"></a>

## computeRV(prices, interval) ⇒ <code>Array.&lt;number&gt;</code>
Computes 5-minute realized volatility from intraday log-returns.
RV = sum_i (r_i)^2 where r_i = log(P_{t_i}) - log(P_{t_{i-1}})

**Kind**: global function  
**Returns**: <code>Array.&lt;number&gt;</code> - Realized volatility series.  

| Param | Type | Description |
| --- | --- | --- |
| prices | <code>Array.&lt;number&gt;</code> | Price series (chronological order). |
| interval | <code>number</code> | Number of observations per 5-min bucket (default 1 if prices are already 5-min). |

<a name="computeRVParkinson"></a>

## computeRVParkinson(bars) ⇒ <code>Array.&lt;number&gt;</code>
Computes 5-minute RV from OHLC bars using the Parkinson estimator.
More efficient than tick-based RV when only OHLC is available.

**Kind**: global function  
**Returns**: <code>Array.&lt;number&gt;</code> - RV estimates.  

| Param | Type | Description |
| --- | --- | --- |
| bars | <code>Array.&lt;{open: number, high: number, low: number, close: number}&gt;</code> | OHLC bars. |

<a name="aggregateDailyRV"></a>

## aggregateDailyRV(intradayRVs) ⇒ <code>number</code>
Computes daily realized volatility from intraday 5-minute RVs.
Aggregates intraday RVs into a single daily RV figure.

**Kind**: global function  
**Returns**: <code>number</code> - Daily realized volatility.  

| Param | Type | Description |
| --- | --- | --- |
| intradayRVs | <code>Array.&lt;number&gt;</code> | Array of 5-minute RVs for one trading day. |

<a name="logTransform"></a>

## logTransform(rv) ⇒ <code>Array.&lt;number&gt;</code>
Applies log-transformation to a volatility series.
The paper uses log-volatility: X_t = log(sqrt(RV_t))

**Kind**: global function  
**Returns**: <code>Array.&lt;number&gt;</code> - Log-volatility series.  

| Param | Type | Description |
| --- | --- | --- |
| rv | <code>Array.&lt;number&gt;</code> | Realized volatility series. |

<a name="centerSeries"></a>

## centerSeries(series) ⇒ <code>Array.&lt;number&gt;</code>
Removes the mean (centers) a time series.

**Kind**: global function  
**Returns**: <code>Array.&lt;number&gt;</code> - Centered series.  

| Param | Type | Description |
| --- | --- | --- |
| series | <code>Array.&lt;number&gt;</code> | Input series. |

<a name="standardizeSeries"></a>

## standardizeSeries(series) ⇒ <code>Array.&lt;number&gt;</code>
Standardizes a time series to zero mean and unit variance.

**Kind**: global function  
**Returns**: <code>Array.&lt;number&gt;</code> - Standardized series.  

| Param | Type | Description |
| --- | --- | --- |
| series | <code>Array.&lt;number&gt;</code> | Input series. |

<a name="preprocessPipeline"></a>

## preprocessPipeline(prices, opts) ⇒ <code>Array.&lt;number&gt;</code>
Full preprocessing pipeline: prices -> RV -> log-vol -> center.

**Kind**: global function  
**Returns**: <code>Array.&lt;number&gt;</code> - Preprocessed log-volatility series.  

| Param | Type | Description |
| --- | --- | --- |
| prices | <code>Array.&lt;number&gt;</code> | Price series. |
| opts | <code>Object</code> | Options. |
| opts.interval | <code>number</code> | Aggregation interval. |
| opts.center | <code>boolean</code> | Whether to center the series. |

<a name="trainTestSplit"></a>

## trainTestSplit(series, trainRatio) ⇒ <code>Object</code>
Splits a series into train/test sets.

**Kind**: global function  
**Returns**: <code>Object</code> - Split data.  

| Param | Type | Description |
| --- | --- | --- |
| series | <code>Array.&lt;number&gt;</code> | Input series. |
| trainRatio | <code>number</code> | Proportion for training (default 0.8). |

<a name="createWindows"></a>

## createWindows(series, windowSize, step) ⇒ <code>Array.&lt;Array.&lt;number&gt;&gt;</code>
Creates overlapping windows from a series.

**Kind**: global function  
**Returns**: <code>Array.&lt;Array.&lt;number&gt;&gt;</code> - Array of windows.  

| Param | Type | Description |
| --- | --- | --- |
| series | <code>Array.&lt;number&gt;</code> | Input series. |
| windowSize | <code>number</code> | Window length. |
| step | <code>number</code> | Step size. |

<a name="generateVIXLogVol"></a>

## generateVIXLogVol(nDays, h, opts) ⇒ <code>Array.&lt;number&gt;</code>
Generates synthetic VIX-style daily log-volatility.
Uses fractional Brownian motion with H ~ 0.1 and realistic drift/noise.
This ensures the generated series has the exact target Hurst parameter
for estimator validation.

**Kind**: global function  
**Returns**: <code>Array.&lt;number&gt;</code> - Daily log-volatility series.  

| Param | Type | Description |
| --- | --- | --- |
| nDays | <code>number</code> | Number of trading days. |
| h | <code>number</code> | Hurst parameter (default 0.1 for VIX). |
| opts | <code>Object</code> | Options. |
| opts.seed | <code>number</code> | PRNG seed for reproducibility. |
| opts.noiseStd | <code>number</code> | Observation noise standard deviation. |
| opts.drift | <code>number</code> | Log-volatility drift. |

<a name="generateSPXLogVol"></a>

## generateSPXLogVol(nDays, h, opts) ⇒ <code>Array.&lt;number&gt;</code>
Generates synthetic S&P 500 realized volatility style data.
Uses fractional Brownian motion with H ~ 0.14 (empirical estimate from paper).

**Kind**: global function  
**Returns**: <code>Array.&lt;number&gt;</code> - Daily log-volatility series.  

| Param | Type | Description |
| --- | --- | --- |
| nDays | <code>number</code> | Number of trading days. |
| h | <code>number</code> | Hurst parameter (default 0.14 for SPX RV). |
| opts | <code>Object</code> | Options. |
| opts.seed | <code>number</code> | PRNG seed. |
| opts.noiseStd | <code>number</code> | Observation noise. |
| opts.drift | <code>number</code> | Log-volatility drift. |

<a name="generateIntradayPrices"></a>

## generateIntradayPrices(nIntraday, nDays, h, opts) ⇒ <code>Array.&lt;Array.&lt;number&gt;&gt;</code>
Generates synthetic intraday 5-minute prices for RV computation testing.
Uses a simple rough volatility + Brownian motion model.

**Kind**: global function  
**Returns**: <code>Array.&lt;Array.&lt;number&gt;&gt;</code> - Array of daily price arrays.  

| Param | Type | Description |
| --- | --- | --- |
| nIntraday | <code>number</code> | Number of 5-minute intervals per day (default 78 for US equities). |
| nDays | <code>number</code> | Number of trading days. |
| h | <code>number</code> | Hurst parameter. |
| opts | <code>Object</code> | Options. |
| opts.seed | <code>number</code> | PRNG seed. |
| opts.drift | <code>number</code> | Annualized drift. |

<a name="seriesToCSV"></a>

## seriesToCSV(series, dateHeader, valueHeader) ⇒ <code>string</code>
Exports a series as CSV string.

**Kind**: global function  
**Returns**: <code>string</code> - CSV string.  

| Param | Type | Description |
| --- | --- | --- |
| series | <code>Array.&lt;{date: (string\|Date), value: number}&gt;</code> | Time series. |
| dateHeader | <code>string</code> | Header for date column. |
| valueHeader | <code>string</code> | Header for value column. |

<a name="ksCriticalValue"></a>

## ksCriticalValue(n, m, alpha) ⇒ <code>number</code>
Computes the asymptotic critical value for the two-sample KS test.
D_alpha = sqrt(-0.5 * ln(alpha/2)) * sqrt((n+m)/(n*m))

**Kind**: global function  
**Returns**: <code>number</code> - Critical value.  

| Param | Type | Description |
| --- | --- | --- |
| n | <code>number</code> | Sample size 1. |
| m | <code>number</code> | Sample size 2. |
| alpha | <code>number</code> | Significance level (default 0.05). |

<a name="ksPvalue"></a>

## ksPvalue(D, n, m) ⇒ <code>number</code>
Approximate p-value for the two-sample KS statistic D.
Uses the asymptotic Kolmogorov distribution approximation.

**Kind**: global function  
**Returns**: <code>number</code> - Approximate p-value.  

| Param | Type | Description |
| --- | --- | --- |
| D | <code>number</code> | Observed KS distance. |
| n | <code>number</code> | Sample size 1. |
| m | <code>number</code> | Sample size 2. |

<a name="significanceTest"></a>

## significanceTest(D, n, m, alpha) ⇒ <code>Object</code>
Significance test for the minimized KS distance after H estimation.
Compares the minimized KS statistic D against the asymptotic critical value.

**Kind**: global function  
**Returns**: <code>Object</code> - Test result.  

| Param | Type | Description |
| --- | --- | --- |
| D | <code>number</code> | Minimized KS distance from the estimator. |
| n | <code>number</code> | Sample size at scale A1. |
| m | <code>number</code> | Sample size at scale A2. |
| alpha | <code>number</code> | Significance level (default 0.05). |

<a name="cusumTest"></a>

## cusumTest(hHistory, targetH, threshold) ⇒ <code>Object</code>
CUSUM test for detecting structural breaks in H(t) series.

**Kind**: global function  
**Returns**: <code>Object</code> - Result.  

| Param | Type | Description |
| --- | --- | --- |
| hHistory | <code>Array.&lt;number&gt;</code> | Array of H estimates. |
| targetH | <code>number</code> | Target H under null hypothesis. |
| threshold | <code>number</code> | Threshold for alarm (default 3.0). |

<a name="detectBreakpoints"></a>

## detectBreakpoints(hHistory, windowSize, threshold) ⇒ <code>Array.&lt;{index: number, H\_before: number, H\_after: number}&gt;</code>
Detects breakpoints in a time series of H estimates using
a sliding window CUSUM approach.

**Kind**: global function  
**Returns**: <code>Array.&lt;{index: number, H\_before: number, H\_after: number}&gt;</code> - Detected breakpoints.  

| Param | Type | Description |
| --- | --- | --- |
| hHistory | <code>Array.&lt;number&gt;</code> | Array of H estimates. |
| windowSize | <code>number</code> | Sliding window size. |
| threshold | <code>number</code> | CUSUM threshold. |

<a name="bootstrapCI"></a>

## bootstrapCI(estimator, window, nBoot, alpha) ⇒ <code>Object</code>
Bootstrap confidence interval for H estimate.

**Kind**: global function  
**Returns**: <code>Object</code> - CI.  

| Param | Type | Description |
| --- | --- | --- |
| estimator | <code>function</code> | Function that estimates H from a window. |
| window | <code>Array.&lt;number&gt;</code> | Data window. |
| nBoot | <code>number</code> | Number of bootstrap samples. |
| alpha | <code>number</code> | Significance level. |

<a name="asymptoticVariance"></a>

## asymptoticVariance(scaleA1, scaleA2, n, m) ⇒ <code>number</code>
Computes asymptotic variance based on Proposition 2.9.
Var(H_hat) = (2 * pi * e) / (ln(a))^2 * (1/sqrt(n) + 1/sqrt(m))^2

**Kind**: global function  
**Returns**: <code>number</code> - Asymptotic variance.  

| Param | Type | Description |
| --- | --- | --- |
| scaleA1 | <code>number</code> | Lower scale. |
| scaleA2 | <code>number</code> | Upper scale. |
| n | <code>number</code> | Sample size 1. |
| m | <code>number</code> | Sample size 2. |

<a name="standardError"></a>

## standardError(scaleA1, scaleA2, n, m) ⇒ <code>number</code>
Computes standard error of H estimate.

**Kind**: global function  
**Returns**: <code>number</code> - Standard error.  

| Param | Type | Description |
| --- | --- | --- |
| scaleA1 | <code>number</code> | Lower scale. |
| scaleA2 | <code>number</code> | Upper scale. |
| n | <code>number</code> | Sample size 1. |
| m | <code>number</code> | Sample size 2. |

<a name="confidenceInterval"></a>

## confidenceInterval(HEstimate, scaleA1, scaleA2, n, m, alpha) ⇒ <code>Object</code>
Constructs confidence interval for H.
Uses the asymptotic normality result from Prop 2.9.

**Kind**: global function  
**Returns**: <code>Object</code> - Confidence interval.  

| Param | Type | Description |
| --- | --- | --- |
| HEstimate | <code>number</code> | Point estimate. |
| scaleA1 | <code>number</code> | Lower scale. |
| scaleA2 | <code>number</code> | Upper scale. |
| n | <code>number</code> | Sample size 1. |
| m | <code>number</code> | Sample size 2. |
| alpha | <code>number</code> | Significance level (default 0.05). |

<a name="kalmanFilter"></a>

## kalmanFilter(observations, opts) ⇒ <code>Object</code>
Kalman filter for state-space modeling of H(t).
Simple 1D Kalman filter for tracking H over time.
State: x_t = H_t (Hurst parameter)
Transition: H_t = H_{t-1} + w_t, w_t ~ N(0, q)
Observation: z_t = H_t + v_t, v_t ~ N(0, r)

**Kind**: global function  
**Returns**: <code>Object</code> - Filtered and predicted states.  

| Param | Type | Description |
| --- | --- | --- |
| observations | <code>Array.&lt;number&gt;</code> | Array of H estimates. |
| opts | <code>Object</code> | Filter options. |
| opts.q | <code>number</code> | Process noise variance. |
| opts.r | <code>number</code> | Measurement noise variance. |

<a name="constancyTest"></a>

## constancyTest(observations, opts) ⇒ <code>Object</code>
Constancy test for H(t) using likelihood ratio on Kalman filter process noise.
Tests H0: q = 0 (constant H) vs H1: q > 0 (time-varying H).

**Kind**: global function  
**Returns**: <code>Object</code> - Test result.  

| Param | Type | Description |
| --- | --- | --- |
| observations | <code>Array.&lt;number&gt;</code> | Array of H estimates. |
| opts | <code>Object</code> | Filter options. |
| opts.q | <code>number</code> | Process noise variance under H1. |
| opts.r | <code>number</code> | Measurement noise variance. |

<a name="normalQuantile"></a>

## normalQuantile(p) ⇒ <code>number</code>
Inverse standard normal CDF (quantile function).

**Kind**: global function  
**Returns**: <code>number</code> - Quantile.  

| Param | Type | Description |
| --- | --- | --- |
| p | <code>number</code> | Probability. |

<a name="setLogLevel"></a>

## setLogLevel(level)
Sets the current log level.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| level | <code>number</code> | One of LogLevel values. |

<a name="getLogLevel"></a>

## getLogLevel() ⇒ <code>number</code>
Gets the current log level.

**Kind**: global function  
<a name="debug"></a>

## debug(...args)
**Kind**: global function  

| Param | Type |
| --- | --- |
| ...args | <code>\*</code> | 

<a name="info"></a>

## info(...args)
**Kind**: global function  

| Param | Type |
| --- | --- |
| ...args | <code>\*</code> | 

<a name="warn"></a>

## warn(...args)
**Kind**: global function  

| Param | Type |
| --- | --- |
| ...args | <code>\*</code> | 

<a name="error"></a>

## error(...args)
**Kind**: global function  

| Param | Type |
| --- | --- |
| ...args | <code>\*</code> | 

<a name="arfima"></a>

## arfima(opts) ⇒ <code>function</code>
ARFIMA(p, d, q) model for fractional differencing.

The ARFIMA model combines autoregressive (AR) and moving average (MA)
terms with fractional differencing (d) to capture long-memory processes.

**Kind**: global function  
**Returns**: <code>function</code> - Forecasting function.  

| Param | Type | Description |
| --- | --- | --- |
| opts | <code>Object</code> | Model parameters. |
| opts.p | <code>number</code> | AR order. |
| opts.d | <code>number</code> | Differencing parameter (fractional). |
| opts.q | <code>number</code> | MA order. |
| opts.window | <code>number</code> | Window size for rolling forecasts. |

<a name="holtWintersForecast"></a>

## holtWintersForecast(series, alpha, beta) ⇒ <code>number</code>
Holt-Winters exponential smoothing forecast.

**Kind**: global function  
**Returns**: <code>number</code> - One-step ahead forecast.  

| Param | Type | Description |
| --- | --- | --- |
| series | <code>Array.&lt;number&gt;</code> | Input time series. |
| alpha | <code>number</code> | Level smoothing factor (default 0.3). |
| beta | <code>number</code> | Trend smoothing factor (default 0.1). |

<a name="createLSTM"></a>

## createLSTM(opts) ⇒ <code>Object</code>
Creates a minimal LSTM-like recurrent cell for H forecasting.
Stateless: processes a full sequence and produces a hidden state.

**Kind**: global function  
**Returns**: <code>Object</code> - LSTM-like predictor.  

| Param | Type | Description |
| --- | --- | --- |
| opts | <code>Object</code> |  |
| opts.hiddenSize | <code>number</code> | Hidden state dimension (default 16). |
| opts.inputSize | <code>number</code> | Input dimension (default 1). |

<a name="createAttentionModel"></a>

## createAttentionModel(opts) ⇒ <code>Object</code>
Creates a minimal Transformer-style attention model for H forecasting.
Stateless: processes a full sequence and produces an aggregated hidden state.

**Kind**: global function  
**Returns**: <code>Object</code> - Attention predictor.  

| Param | Type | Description |
| --- | --- | --- |
| opts | <code>Object</code> |  |
| opts.hiddenSize | <code>number</code> | Hidden dimension (default 16). |
| opts.numHeads | <code>number</code> | Number of attention heads (default 4). |

<a name="fOU"></a>

## fOU(params) ⇒ <code>Object</code>
Generates fOU sample paths using Euler-Maruyama discretization.
For H = 0.5, uses exact discretization.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | Model parameters. |
| params.nSteps | <code>number</code> | Number of time steps. |
| params.T | <code>number</code> | Terminal time. |
| params.theta | <code>number</code> | Mean reversion speed. |
| params.mu | <code>number</code> | Long-term mean. |
| params.sigma | <code>number</code> | Volatility of the fBM driver. |
| params.h | <code>number</code> | Hurst parameter (default 0.5 for standard OU). |
| params.x0 | <code>number</code> | Initial value. |

<a name="exactOU"></a>

## exactOU(params) ⇒ <code>Object</code>
Alternative fOU using exact Riemann-Liouville integral representation.
More accurate but slower for long time series.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | Model parameters. |
| params.nSteps | <code>number</code> | Number of time steps. |
| params.T | <code>number</code> | Terminal time. |
| params.theta | <code>number</code> | Mean reversion speed. |
| params.mu | <code>number</code> | Long-term mean. |
| params.sigma | <code>number</code> | Volatility. |
| params.h | <code>number</code> | Hurst parameter. |
| params.x0 | <code>number</code> | Initial value. |

<a name="getModel"></a>

## getModel(name) ⇒ <code>Object</code> \| <code>undefined</code>
Retrieves a registered model by name.

**Kind**: global function  
**Returns**: <code>Object</code> \| <code>undefined</code> - Model entry or undefined.  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | Model identifier. |

<a name="registerModel"></a>

## registerModel(name, entry)
Registers a new model in the factory.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | Model identifier. |
| entry | <code>Object</code> | Model entry object. |

<a name="listModels"></a>

## listModels() ⇒ <code>Array.&lt;string&gt;</code>
Lists all registered model names.

**Kind**: global function  
**Returns**: <code>Array.&lt;string&gt;</code> - Registered model names.  
<a name="mpre"></a>

## mpre(params) ⇒ <code>Object</code>
Generates MPRE sample paths using approximation.
H evolves as an Ornstein-Uhlenbeck process.
The path is approximated using the local Hölder exponent at each point.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | Model parameters. |
| params.nSteps | <code>number</code> | Number of time steps. |
| params.T | <code>number</code> | Terminal time. |
| params.hMin | <code>number</code> | Minimum H (default 0.05). |
| params.hMax | <code>number</code> | Maximum H (default 0.95). |
| params.h0 | <code>number</code> | Initial H (default 0.1). |
| params.hProcess | <code>Object</code> | Options for H process dynamics. |
| params.hProcess.theta | <code>number</code> | OU speed. |
| params.hProcess.mu | <code>number</code> | OU mean. |
| params.hProcess.sigma | <code>number</code> | OU volatility. |
| params.x0 | <code>number</code> | Initial value. |

<a name="mpreExact"></a>

## mpreExact(params) ⇒ <code>Object</code>
MPRE with continuous H evolution using exact fractional representation.
More accurate but O(n^2) - use for short series only.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | Model parameters. |
| params.nSteps | <code>number</code> | Number of time steps. |
| params.T | <code>number</code> | Terminal time. |
| params.hMin | <code>number</code> | Minimum H. |
| params.hMax | <code>number</code> | Maximum H. |
| params.h0 | <code>number</code> | Initial H. |
| params.hProcess | <code>Object</code> | H process dynamics. |
| params.x0 | <code>number</code> | Initial value. |

<a name="rBergomi"></a>

## rBergomi(params) ⇒ <code>Object</code>
Generates rough Bergomi volatility paths.
The variance process follows:
  V_t = xi * exp(eta * I_t - (eta^2/2) * t^{2H})
where I_t is the Riemann-Liouville fractional integral of W^perp.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | Model parameters. |
| params.nPaths | <code>number</code> | Number of simulation paths. |
| params.nSteps | <code>number</code> | Number of time steps. |
| params.xi | <code>number</code> | Initial volatility level (xi_0). |
| params.eta | <code>number</code> | Volatility of volatility. |
| params.rho | <code>number</code> | Correlation between Brownian motions (-1 to 1). |
| params.h | <code>number</code> | Hurst parameter (0 < H <= 0.5 for rough). |
| params.T | <code>number</code> | Terminal time. |

<a name="rBergomiPrice"></a>

## rBergomiPrice(params) ⇒ <code>Object</code>
Generates log-price paths under rough volatility.
SDE: dS_t = vol_t * S_t * dW_t
where vol_t = sqrt(V_t) from rBergomi.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | Model parameters. |
| params.nPaths | <code>number</code> | Number of paths. |
| params.nSteps | <code>number</code> | Number of time steps. |
| params.mu | <code>number</code> | Drift (default 0 for martingale). |
| params.s0 | <code>number</code> | Initial price (default 100). |
| params.xi | <code>number</code> | Initial volatility. |
| params.eta | <code>number</code> | Vol of vol. |
| params.rho | <code>number</code> | Correlation. |
| params.h | <code>number</code> | Hurst parameter. |
| params.T | <code>number</code> | Terminal time. |

<a name="rFSV"></a>

## rFSV(params) ⇒ <code>Object</code>
Simulates rFSV process.
The volatility has both a classical Heston component and a rough component
driven by fractional Brownian motion.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | Model parameters. |
| params.nSteps | <code>number</code> | Number of time steps. |
| params.T | <code>number</code> | Terminal time. |
| params.h | <code>number</code> | Hurst parameter (roughness). |
| params.theta | <code>number</code> | Mean reversion speed. |
| params.mu | <code>number</code> | Long-term variance mean. |
| params.nu | <code>number</code> | Volatility of volatility. |
| params.alpha | <code>number</code> | Diffusion exponent (default 0.5 for square-root). |
| params.v0 | <code>number</code> | Initial variance. |

<a name="rFSVPrice"></a>

## rFSVPrice(params) ⇒ <code>Object</code>
Generates price path under rFSV.
dS_t = vol_t * S_t * dW_t

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | Model parameters. |
| params.drift | <code>number</code> | Drift (default 0). |
| params.s0 | <code>number</code> | Initial price (default 100). |
| params.nSteps | <code>number</code> | Number of time steps. |
| params.T | <code>number</code> | Terminal time. |
| params.h | <code>number</code> | Hurst parameter. |
| params.theta | <code>number</code> | Mean reversion speed. |
| params.mu | <code>number</code> | Long-term mean. |
| params.nu | <code>number</code> | Vol of vol. |
| params.v0 | <code>number</code> | Initial variance. |

<a name="preavgReturns"></a>

## preavgReturns(prices, windowSize) ⇒ <code>Array.&lt;number&gt;</code>
Preaveraging of returns to reduce microstructure noise.
Computes local averages of returns over a sliding window,
then differences these averages to obtain noise-robust returns.

**Kind**: global function  
**Returns**: <code>Array.&lt;number&gt;</code> - Preaveraged returns.  

| Param | Type | Description |
| --- | --- | --- |
| prices | <code>Array.&lt;number&gt;</code> | Price series. |
| windowSize | <code>number</code> | Preaveraging window (default 2). |

<a name="realizedKernel"></a>

## realizedKernel(returns, kernelType, bandwidth) ⇒ <code>number</code>
Realized kernel volatility estimator with Bartlett or other kernels.

**Kind**: global function  
**Returns**: <code>number</code> - Realized kernel estimate.  

| Param | Type | Description |
| --- | --- | --- |
| returns | <code>Array.&lt;number&gt;</code> | Return series. |
| kernelType | <code>string</code> | Kernel type: 'bartlett', 'parzen', 'tukey-hanning'. |
| bandwidth | <code>number</code> | Maximum lag (default auto). |

<a name="logVolDebias"></a>

## logVolDebias(rawHEstimates, sigmaObs, sigmaLatent) ⇒ <code>Array.&lt;number&gt;</code>
De-biases log-volatility H estimates by correcting for
observational noise in the volatility proxy.

**Kind**: global function  
**Returns**: <code>Array.&lt;number&gt;</code> - De-biased H estimates.  

| Param | Type | Description |
| --- | --- | --- |
| rawHEstimates | <code>Array.&lt;number&gt;</code> | Raw H estimates. |
| sigmaObs | <code>number</code> | Observed volatility standard deviation. |
| sigmaLatent | <code>number</code> | Latent volatility standard deviation. |

<a name="brentMinimize"></a>

## brentMinimize(f, ax, bx, cx, tol) ⇒ <code>Object</code>
Minimizes a function f(x) on the interval [ax, cx] using Brent's Method.

**Kind**: global function  
**Returns**: <code>Object</code> - Object containing minimum x and f(x).  

| Param | Type | Description |
| --- | --- | --- |
| f | <code>function</code> | The function to minimize. |
| ax | <code>number</code> | Lower bound. |
| bx | <code>number</code> | An initial guess. |
| cx | <code>number</code> | Upper bound. |
| tol | <code>number</code> | Tolerance. |

<a name="nelderMead"></a>

## nelderMead(f, x0, opts) ⇒ <code>Object</code>
Nelder-Mead (Simplex) method for multi-dimensional minimization.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| f | <code>function</code> | Objective function. |
| x0 | <code>Array.&lt;number&gt;</code> | Initial guess. |
| opts | <code>Object</code> | Options. |
| opts.maxIter | <code>number</code> | Maximum iterations (default 1000). |
| opts.tol | <code>number</code> | Convergence tolerance (default 1e-6). |
| opts.alpha | <code>number</code> | Reflection coefficient (default 1.0). |
| opts.gamma | <code>number</code> | Expansion coefficient (default 2.0). |
| opts.rho | <code>number</code> | Contraction coefficient (default 0.5). |
| opts.sigma | <code>number</code> | Shrink coefficient (default 0.5). |

<a name="simulatedAnnealing"></a>

## simulatedAnnealing(f, x0, opts) ⇒ <code>Object</code>
Simulated Annealing for global optimization.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| f | <code>function</code> | Objective function. |
| x0 | <code>Array.&lt;number&gt;</code> | Initial guess. |
| opts | <code>Object</code> | Options. |
| opts.maxIter | <code>number</code> | Maximum iterations (default 5000). |
| opts.initialTemp | <code>number</code> | Initial temperature (default 100). |
| opts.finalTemp | <code>number</code> | Final temperature (default 0.001). |
| opts.coolingRate | <code>number</code> | Cooling rate (default 0.995). |
| opts.stepSize | <code>number</code> | Step size for neighbors (default 0.1). |

<a name="differentialEvolution"></a>

## differentialEvolution(f, x0, opts) ⇒ <code>Object</code>
Differential Evolution for global optimization.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| f | <code>function</code> | Objective function. |
| x0 | <code>Array.&lt;number&gt;</code> | Initial guess (center of population). |
| opts | <code>Object</code> | Options. |
| opts.maxIter | <code>number</code> | Maximum iterations (default 500). |
| opts.popSize | <code>number</code> | Population size (default 20). |
| opts.cr | <code>number</code> | Crossover probability (default 0.7). |
| opts.f | <code>number</code> | Scale factor F (default 0.8). |
| opts.lb | <code>Array.&lt;number&gt;</code> | Lower bounds (default all -5). |
| opts.ub | <code>Array.&lt;number&gt;</code> | Upper bounds (default all 5). |

<a name="adaptiveGridSearch"></a>

## adaptiveGridSearch(f, min, max, opts) ⇒ <code>Object</code>
Adaptive Grid Search with Brent refinement.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| f | <code>function</code> | Objective function (1D). |
| min | <code>number</code> | Lower bound. |
| max | <code>number</code> | Upper bound. |
| opts | <code>Object</code> | Options. |
| opts.gridSize | <code>number</code> | Coarse grid points (default 50). |
| opts.refineIters | <code>number</code> | Refinement iterations (default 3). |
| opts.tol | <code>number</code> | Convergence tolerance (default 1e-7). |

<a name="safeOptimizer"></a>

## safeOptimizer(opt) ⇒ <code>function</code>
Wraps an optimizer so that failures return NaN instead of throwing.

**Kind**: global function  
**Returns**: <code>function</code> - Safe optimizer.  

| Param | Type | Description |
| --- | --- | --- |
| opt | <code>function</code> | Optimizer function. |

<a name="getOptimizerFactory"></a>

## getOptimizerFactory(name) ⇒ <code>function</code> \| <code>undefined</code>
Retrieves an optimizer factory by name.

**Kind**: global function  
**Returns**: <code>function</code> \| <code>undefined</code> - Factory or undefined.  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | Optimizer identifier. |

<a name="registerOptimizerFactory"></a>

## registerOptimizerFactory(name, factory)
Registers a custom optimizer factory.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | Optimizer identifier. |
| factory | <code>function</code> | Returns the optimizer function. |

<a name="mulberry32"></a>

## mulberry32(seed) ⇒ <code>function</code>
mulberry32 PRNG.

**Kind**: global function  

| Param | Type |
| --- | --- |
| seed | <code>number</code> | 

<a name="setSeed"></a>

## setSeed(seed)
Sets a global seed for reproducible simulations.
Pass null or call reset() to revert to Math.random().

**Kind**: global function  

| Param | Type |
| --- | --- |
| seed | <code>number</code> \| <code>null</code> | 

<a name="resetSeed"></a>

## resetSeed()
Resets the PRNG to use Math.random().

**Kind**: global function  
<a name="random"></a>

## random() ⇒ <code>number</code>
Returns a random number in [0, 1).
Uses the seeded generator if available, otherwise Math.random().

**Kind**: global function  
<a name="randn"></a>

## randn() ⇒ <code>number</code>
Standard normal via Box-Muller.

**Kind**: global function  
**Returns**: <code>number</code> - Standard normal random variable.  
<a name="randnBatch"></a>

## randnBatch(n) ⇒ <code>Float64Array</code>
Batch of standard normals.

**Kind**: global function  
**Returns**: <code>Float64Array</code> - Standard normals.  

| Param | Type | Description |
| --- | --- | --- |
| n | <code>number</code> | Number of samples. |

<a name="correlatedGaussian"></a>

## correlatedGaussian(n, rho) ⇒ <code>Array.&lt;Float64Array&gt;</code>
Correlated standard normals via Cholesky.

**Kind**: global function  
**Returns**: <code>Array.&lt;Float64Array&gt;</code> - [Z1, Z2] correlated normals.  

| Param | Type | Description |
| --- | --- | --- |
| n | <code>number</code> | Number of samples. |
| rho | <code>number</code> | Correlation (-1, 1). |

<a name="generateFGN"></a>

## generateFGN(n, H) ⇒ <code>Float64Array</code>
Generates Fractional Gaussian Noise (fGN) using Hosking's method.
O(n^2) but exact for any H in (0,1).

**Kind**: global function  
**Returns**: <code>Float64Array</code> - fGN sample.  

| Param | Type | Description |
| --- | --- | --- |
| n | <code>number</code> | Length. |
| H | <code>number</code> | Hurst parameter (0 < H < 1). |

<a name="generateFBM"></a>

## generateFBM(n, H) ⇒ <code>Float64Array</code>
Generates Fractional Brownian Motion (fBm) by cumulative sum of fGN.

**Kind**: global function  
**Returns**: <code>Float64Array</code> - fBm path.  

| Param | Type | Description |
| --- | --- | --- |
| n | <code>number</code> | Length. |
| H | <code>number</code> | Hurst parameter. |

<a name="fractionalKernel"></a>

## fractionalKernel(H, nSteps, dt) ⇒ <code>Float64Array</code>
Precomputes the Riemann-Liouville fractional kernel.
K(t) = sqrt(2H) * t^{H-0.5} for t > 0

**Kind**: global function  
**Returns**: <code>Float64Array</code> - Kernel values.  

| Param | Type | Description |
| --- | --- | --- |
| H | <code>number</code> | Hurst parameter. |
| nSteps | <code>number</code> | Number of time steps. |
| dt | <code>number</code> | Time step. |

<a name="fractionalIntegral"></a>

## fractionalIntegral(dW, kernel, t) ⇒ <code>number</code>
Computes fractional Brownian motion increment using precomputed kernel.
I_t = sum_{j=0}^{t-1} K(t-j) * dW_j

**Kind**: global function  
**Returns**: <code>number</code> - Fractional integral value at time t.  

| Param | Type | Description |
| --- | --- | --- |
| dW | <code>Float64Array</code> | Brownian increments. |
| kernel | <code>Float64Array</code> | Precomputed kernel. |
| t | <code>number</code> | Current time index (exclusive upper bound). |

<a name="defaultSampler"></a>

## defaultSampler()
Default Sampler: Random selection.

**Kind**: global function  
<a name="vectorizedKsObjective"></a>

## vectorizedKsObjective(sortedSamples, scales, H) ⇒ <code>number</code>
Vectorized KS objective for multi-scale analysis.
Pre-sorted samples, rescale only.

**Kind**: global function  
**Returns**: <code>number</code> - Mean KS distance across all scale pairs.  

| Param | Type | Description |
| --- | --- | --- |
| sortedSamples | <code>Array.&lt;Float64Array&gt;</code> | Pre-sorted samples at different scales. |
| scales | <code>Array.&lt;number&gt;</code> | Array of scale values. |
| H | <code>number</code> | Hurst parameter. |

<a name="computeScalePairDistance"></a>

## computeScalePairDistance(sortedSamples, scales, i, j, H) ⇒ <code>number</code>
Computes KS distance between a pair of rescaled samples.

**Kind**: global function  
**Returns**: <code>number</code> - KS distance between rescaled samples.  

| Param | Type | Description |
| --- | --- | --- |
| sortedSamples | <code>Array.&lt;Float64Array&gt;</code> | Pre-sorted samples. |
| scales | <code>Array.&lt;number&gt;</code> | Scale values. |
| i | <code>number</code> | First sample index. |
| j | <code>number</code> | Second sample index. |
| H | <code>number</code> | Hurst parameter. |

<a name="buildScaleProfile"></a>

## buildScaleProfile(sortedSamples, scales, H) ⇒ <code>Array.&lt;number&gt;</code>
Builds a flat profile array of all pairwise KS distances between
rescaled samples at the given scales for a fixed H.

**Kind**: global function  
**Returns**: <code>Array.&lt;number&gt;</code> - Flat profile array.  

| Param | Type | Description |
| --- | --- | --- |
| sortedSamples | <code>Array.&lt;Float64Array&gt;</code> | Pre-sorted samples. |
| scales | <code>Array.&lt;number&gt;</code> | Scale values. |
| H | <code>number</code> | Hurst parameter. |

<a name="weightedKsObjective"></a>

## weightedKsObjective(sortedSamples, scales, weights, H) ⇒ <code>number</code>
Weighted KS objective with scale weights.

**Kind**: global function  
**Returns**: <code>number</code> - Weighted KS distance.  

| Param | Type | Description |
| --- | --- | --- |
| sortedSamples | <code>Array.&lt;Float64Array&gt;</code> | Pre-sorted samples. |
| scales | <code>Array.&lt;number&gt;</code> | Scale values. |
| weights | <code>Array.&lt;number&gt;</code> | Scale weights. |
| H | <code>number</code> | Hurst parameter. |

<a name="ksDistance"></a>

## ksDistance(sample1, sample2, isSorted) ⇒ <code>number</code>
Computes the Kolmogorov-Smirnov distance between two samples.
D = sup_x |F_n(x) - G_m(x)| where F_n and G_m are empirical CDFs.
Uses the two-sample KS statistic computation.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| sample1 | <code>Array.&lt;number&gt;</code> \| <code>Float64Array</code> |  |
| sample2 | <code>Array.&lt;number&gt;</code> \| <code>Float64Array</code> |  |
| isSorted | <code>boolean</code> | Whether the samples are already sorted. |

<a name="ksDistanceRescaled"></a>

## ksDistanceRescaled(sortedA, sortedB, factorA, factorB) ⇒ <code>number</code>
Computes KS distance between two pre-sorted samples after rescaling by positive factors.
Avoids array allocation by applying factors during the pointer walk.
Multiplication by a positive scalar preserves ordering, so no re-sorting is needed.

**Kind**: global function  
**Returns**: <code>number</code> - KS distance between rescaled samples.  

| Param | Type | Description |
| --- | --- | --- |
| sortedA | <code>Array.&lt;number&gt;</code> \| <code>Float64Array</code> | Pre-sorted sample A. |
| sortedB | <code>Array.&lt;number&gt;</code> \| <code>Float64Array</code> | Pre-sorted sample B. |
| factorA | <code>number</code> | Positive rescaling factor for A. |
| factorB | <code>number</code> | Positive rescaling factor for B. |

<a name="shuffle"></a>

## shuffle(array) ⇒ <code>Array.&lt;\*&gt;</code>
Fisher-Yates shuffle.
Fisher-Yates shuffle.

**Kind**: global function  
**Returns**: <code>Array.&lt;\*&gt;</code> - Shuffled array.  

| Param | Type | Description |
| --- | --- | --- |
| array | <code>Array.&lt;\*&gt;</code> | Input array. |

<a name="blockPermutation"></a>

## blockPermutation(data, blockSize, randomPhase) ⇒ <code>Array.&lt;\*&gt;</code>
Block random permutation for decorrelating serial dependence.
Partitions data into blocks of length blockSize, shuffles the blocks,
and optionally applies a random phase offset to the starting index.
Preserves marginal distributions while stripping away autocorrelation.

**Kind**: global function  
**Returns**: <code>Array.&lt;\*&gt;</code> - Permuted array.  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>Array.&lt;\*&gt;</code> | Input array. |
| blockSize | <code>number</code> | Block length. |
| randomPhase | <code>boolean</code> | Whether to apply a random starting phase. |

<a name="randomSample"></a>

## randomSample(array, n) ⇒ <code>Array.&lt;\*&gt;</code>
Floyd's reservoir sampling for random sampling without replacement.
More efficient than Set-based collision detection.

**Kind**: global function  
**Returns**: <code>Array.&lt;\*&gt;</code> - Random sample.  

| Param | Type | Description |
| --- | --- | --- |
| array | <code>Array.&lt;\*&gt;</code> | Input array. |
| n | <code>number</code> | Number of elements to sample. |

