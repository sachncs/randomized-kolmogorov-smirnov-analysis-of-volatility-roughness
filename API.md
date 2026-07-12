## Classes

<dl>
<dt><a href="#RKSAVR">RKSAVR</a></dt>
<dd><p>Randomized Kolmogorov-Smirnov Analysis of Volatility Roughness estimator.</p>
<p>The class encapsulates a <em>configurable</em> estimator instance: the scales to
analyze, the sampler used inside each variance-reduction iteration, the
1D optimizer that minimizes the KS distance surface, and the safe bounds
the final estimate will be clamped to.</p>
<p>Lifecycle:</p>
<ol>
<li>The constructor stores the configuration and pulls a fresh optimizer
function from <a href="optimization/registry">optimization/registry</a>. The estimator is
therefore stateful across calls — each call to <a href="#RKSAVR+estimate">estimate</a>
draws a new independent PRNG state via <code>prng.js</code>.</li>
<li><a href="#RKSAVR+estimate">estimate</a> averages <code>iterations</code> independent
<a href="#RKSAVR+estimateSingle">estimateSingle</a> results for variance reduction.</li>
<li><a href="#RKSAVR+rolling">rolling</a> and <a href="#RKSAVR+rollingMultiScale">rollingMultiScale</a> are
convenience wrappers around a sliding window of these estimates.</li>
<li><a href="#RKSAVR+estimateBatch">estimateBatch</a> performs non-overlapping window
estimation for parallel processing pipelines.</li>
</ol>
<p>Thread-safety: the estimator does not share mutable state between its
methods (no internal counters) but it does rely on the <em>global</em> seeded
PRNG exposed by <a href="prng">prng</a>. Callers that need concurrent estimation
should serialize the calls (e.g. wrap in an async queue) or seed the
PRNG with a per-call seed.</p>
<p>Example:</p>
<pre><code class="language-javascript">import {RKSAVR} from &#39;rksavr&#39;;

const estimator = new RKSAVR({scaleA1: 1, scaleA2: 50,
                              sampleSize: 500, iterations: 16});
const H = estimator.estimate(logVolSeriesWindow);
</code></pre>
</dd>
</dl>

## Constants

<dl>
<dt><a href="#LogLevel">LogLevel</a></dt>
<dd><p>Severity levels, numerically ordered from most to least verbose.</p>
<ul>
<li><code>DEBUG</code> (0): per-step diagnostics, only useful for tracing algorithm
internals.</li>
<li><code>INFO</code> (1): high-level progress messages.</li>
<li><code>WARN</code> (2): recoverable issues (default cut-off).</li>
<li><code>ERROR</code> (3): unhandled failures during processing.</li>
<li><code>SILENT</code> (4): disables all logging; convenience for tests.</li>
</ul>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#parseCSV">parseCSV(csv, opts)</a> ⇒ <code>Array.&lt;Object&gt;</code></dt>
<dd><p>Parses a CSV string into an array of plain objects.</p>
<p>Expected input shape:</p>
<ul>
<li>The first non-empty line is the header row.</li>
<li>Each subsequent line is a record with the same column count as the
header.</li>
<li>Fields can be optionally wrapped in double quotes; quotes may embed
commas but not other escapes.</li>
</ul>
<p>Type coercion:</p>
<ul>
<li><code>opts.dateField</code> (default <code>&quot;date&quot;</code>) is parsed via <code>new Date(...)</code>.</li>
<li>Any field listed in <code>opts.numericFields</code> is parsed via <code>parseFloat</code>.</li>
<li>All other fields are kept as trimmed strings.</li>
</ul>
<p>Error handling:</p>
<ul>
<li>Empty input returns <code>[]</code>.</li>
<li>Mismatched column counts throw with a descriptive message.</li>
<li>Non-numeric values in declared numeric columns throw.</li>
</ul>
</dd>
<dt><a href="#extractSeries">extractSeries(rows, field, opts)</a> ⇒ <code>Array.&lt;{date: Date, value: number}&gt;</code></dt>
<dd><p>Extracts a <code>{date, value}</code> series from a parsed CSV array.</p>
<p>Rows that are missing <code>field</code> are skipped; the resulting series is
optionally sorted by <code>dateField</code> when the caller asks. Sorting uses
the standard JS <code>Date</code> arithmetic, so the dates must be real <code>Date</code>
instances.</p>
</dd>
<dt><a href="#parseJSON">parseJSON(json)</a> ⇒ <code>Array.&lt;Object&gt;</code></dt>
<dd><p>Parses a JSON string that must encode an array of objects.</p>
<p>The function deliberately refuses non-array JSON to keep the loader
simple. Empty or whitespace-only input returns <code>[]</code>.</p>
</dd>
<dt><a href="#validateNoGaps">validateNoGaps(series, maxGapMs)</a> ⇒ <code>Object</code></dt>
<dd><p>Validates that a time series does not contain temporal gaps larger
than <code>maxGapMs</code>.</p>
<p>Returns the maximum observed gap, the full list of pairwise gap
lengths, and a <code>valid</code> flag for the threshold check. Series with
fewer than two points are deemed valid by definition.</p>
</dd>
<dt><a href="#downsample">downsample(series, intervalMs)</a> ⇒ <code>Array.&lt;{date: Date, value: number}&gt;</code></dt>
<dd><p>Downsamples a time series by averaging values that fall into fixed
<code>intervalMs</code>-wide buckets.</p>
<p>The bucket index is computed as
    <code>floor(date.getTime() / intervalMs)</code>,
so all buckets share the same left edge (<code>0</code>, <code>intervalMs</code>,
<code>2 * intervalMs</code>, ...). The output is sorted by date and every
returned point carries the <em>bucket start</em> (not the average timestamp)
as its <code>date</code> value.</p>
</dd>
<dt><a href="#preavgReturns">preavgReturns(prices, [windowSize])</a> ⇒ <code>Array.&lt;number&gt;</code></dt>
<dd><p>Preaveraging of log-returns.</p>
<p>Implementation of the Jacod et al. (2009) preaveraging estimator
(simplified single-bar variant):</p>
<ol>
<li>Compute log-returns <code>r_t = log(P_t / P_{t-1})</code>.</li>
<li>For each <code>i</code>, average the <code>windowSize</code> consecutive returns ending at
<code>i</code> (<code>g_avg[i] = mean(r_{i - windowSize + 1}, ..., r_i)</code>).</li>
<li>The &quot;preaveraged return&quot; is the first-difference sequence
<code>g_avg[i] - g_avg[i - 1]</code>. This cancellation attenuates
microstructure noise by <code>1/sqrt(windowSize)</code> while preserving the
drift and diffusion up to <code>O(1 / windowSize)</code>.</li>
</ol>
<p>Note: the result has length <code>prices.length - windowSize - 1</code>; for
very short series the function throws rather than returning a few
noisy points.</p>
</dd>
<dt><a href="#realizedKernel">realizedKernel(returns, [kernelType], [bandwidth])</a> ⇒ <code>number</code></dt>
<dd><p>Realized-kernel variance estimator with pluggable kernels.</p>
<p>Given <code>n</code> returns, the estimator forms the autocorrelation sequence</p>
<pre><code>gamma_k = sum_{i=k+1}^{n} r_i * r_{i - k},  k = 0..h
</code></pre>
<p>and combines them through a weighted sum</p>
<pre><code>RV_K = gamma_0 + 2 * sum_{k=1..h} w_k * gamma_k
</code></pre>
<p>with weights <code>w_k</code> provided by the chosen kernel. The default
<code>bandwidth</code> is <code>floor(n^0.6)</code>, a rule-of-thumb that matches the
optimal scaling under i.i.d. microstructure noise.</p>
<p>Kernels shipped:</p>
<ul>
<li><code>bartlett</code>: <code>w_k = 1 - k / h</code> (default).</li>
<li><code>parzen</code>: the standard piecewise-cubic Parzen kernel.</li>
<li><code>tukey-hanning</code>: <code>0.5 (1 + cos(pi k / h))</code>.</li>
</ul>
<p>Any unknown kernel name falls back to Bartlett.</p>
</dd>
<dt><a href="#logVolDebias">logVolDebias(rawHEstimates, sigmaObs, sigmaLatent)</a> ⇒ <code>Array.&lt;number&gt;</code></dt>
<dd><p>Heuristic de-biasing of log-volatility H estimates.</p>
<p>Microstructure noise inflates the variance of the log-volatility proxy
relative to the latent signal, which in turn attenuates the
observed roughness. This routine adds a small correction</p>
<pre><code>h_debias = h + 0.01 * log(sigmaObs / sigmaLatent)
</code></pre>
<p>and clamps the result to <code>[0.01, 0.99]</code>. It is intentionally
conservative — the user is expected to validate the calibration
against a trust sample before relying on it for production.</p>
</dd>
<dt><a href="#computeRV">computeRV(prices, [interval])</a> ⇒ <code>Array.&lt;number&gt;</code></dt>
<dd><p>Computes per-bucket realized variance from a price series.</p>
<p>The realized variance is the sum of squared log-returns within each
non-overlapping bucket of <code>interval</code> observations:</p>
<pre><code>RV_k = sum_{i in bucket k} (log P_i - log P_{i-1})^2
</code></pre>
<p>With <code>interval = 1</code> the function emits one RV per log-return
directly, which is the canonical &quot;5-minute RV&quot; form when prices are
already sampled at 5-minute intervals.</p>
</dd>
<dt><a href="#computeRVParkinson">computeRVParkinson(bars)</a> ⇒ <code>Array.&lt;number&gt;</code></dt>
<dd><p>Parkinson (1980) high-low RV estimator from OHLC bars.</p>
<p>For each bar the within-period variance is approximated by</p>
<pre><code>sigma^2 ~= (log(H/L))^2 / (4 * ln 2)
</code></pre>
<p>which is <code>1/(4 ln 2) ~ 0.36</code> of the log-range-squared. Parkinson is
strictly less efficient than tick-based RV but only requires four
numbers per bar.</p>
</dd>
<dt><a href="#aggregateDailyRV">aggregateDailyRV(intradayRVs)</a> ⇒ <code>number</code></dt>
<dd><p>Aggregates intraday (5-minute) realized variances into a single daily
value via plain summation.</p>
<p>This is the standard &quot;sum of squared returns&quot; daily RV used in
financial econometrics. It assumes the input is already free of
overnight gaps.</p>
</dd>
<dt><a href="#logTransform">logTransform(rv)</a> ⇒ <code>Array.&lt;number&gt;</code></dt>
<dd><p>Maps realized variance to the log-volatility series consumed by
RK-SAVR.</p>
<p>The transformation is</p>
<pre><code>X_t = 0.5 * log(RV_t)
</code></pre>
<p>i.e. <code>log(sqrt(RV))</code>. This converts multiplicative variance dynamics
into a roughly additive (and therefore more stationary) signal, on
top of which the self-similarity property exploited by RK-SAVR is
expressed.</p>
</dd>
<dt><a href="#centerSeries">centerSeries(series)</a> ⇒ <code>Array.&lt;number&gt;</code></dt>
<dd><p>Subtracts the arithmetic mean from every element.</p>
<p>Useful as a final step in the preprocessing pipeline when the user
wants the series to mean-zero (which can stabilize variance-reducing
permutations inside <code>RKSAVR</code>).</p>
</dd>
<dt><a href="#standardizeSeries">standardizeSeries(series)</a> ⇒ <code>Array.&lt;number&gt;</code></dt>
<dd><p>Standardizes a time series to zero mean and unit variance.</p>
<p>Divides each centered value by the population standard deviation.
A constant series has zero variance and triggers an explicit error
rather than silently producing <code>NaN</code>s.</p>
</dd>
<dt><a href="#preprocessPipeline">preprocessPipeline(prices, opts)</a> ⇒ <code>Array.&lt;number&gt;</code></dt>
<dd><p>Bundled preprocessing pipeline: <code>prices -&gt; RV -&gt; log-vol -&gt; (optional) centering</code>.</p>
<p>Equivalent to running <a href="#computeRV">computeRV</a> + <a href="#logTransform">logTransform</a> +
(optionally) <a href="#centerSeries">centerSeries</a>, but more compact for callers who
want the canonical transformation.</p>
</dd>
<dt><a href="#trainTestSplit">trainTestSplit(series, [trainRatio])</a> ⇒ <code>Object</code></dt>
<dd><p>Splits a series into contiguous training and test arrays.</p>
<p>The split point is <code>floor(series.length * trainRatio)</code> so the training
set is the leftmost prefix of the series; this preserves temporal
ordering, which is what RK-SAVR forecasters and validation scripts
typically need.</p>
</dd>
<dt><a href="#createWindows">createWindows(series, windowSize, [step])</a> ⇒ <code>Array.&lt;Array.&lt;number&gt;&gt;</code></dt>
<dd><p>Builds overlapping windows from a single time series.</p>
<p>The i-th window is <code>series.slice(i, i + windowSize)</code> for <code>i = 0, step, 2*step, ...</code> until no full window fits. Used by offline batch
evaluation pipelines that want to score the estimator on every
available segment of the series.</p>
</dd>
<dt><a href="#generateVIXLogVol">generateVIXLogVol(nDays, h, opts)</a> ⇒ <code>Array.&lt;number&gt;</code></dt>
<dd><p>Synthetic VIX-style daily log-volatility.</p>
<p>Generates an fBM with the requested <code>h</code> and maps it to a log-volatility
level around <code>2.0</code> (i.e. <code>sqrt(RV) ~ 20%</code>) by adding a small drift
term and Gaussian observation noise:</p>
<pre><code>X_t = 2.0 + drift * (fbm[t] / sqrt(n)) + 0.5 * fbm[t] + noise
</code></pre>
<p>Default tuning matches the empirical VIX roughness (<code>h ~ 0.1</code>) and
annualized log-vol mean.</p>
</dd>
<dt><a href="#generateSPXLogVol">generateSPXLogVol(nDays, h, opts)</a> ⇒ <code>Array.&lt;number&gt;</code></dt>
<dd><p>Synthetic S&amp;P 500 realized-volatility style daily log-volatility.</p>
<p>Same construction as <a href="#generateVIXLogVol">generateVIXLogVol</a> but with a smoother
default Hurst (<code>h = 0.14</code>), a smaller drift, and a less volatile
observation-noise level. Empirically these choices match the rough
regime typically reported for SPX RV.</p>
</dd>
<dt><a href="#generateIntradayPrices">generateIntradayPrices([nIntraday], [nDays], h, opts)</a> ⇒ <code>Array.&lt;Array.&lt;number&gt;&gt;</code></dt>
<dd><p>Generates synthetic intraday 5-minute prices useful for testing
realized-variance pipelines.</p>
<p>For every (re-)sampled day the generator draws an fBM with the
requested <code>h</code>, exponentiates it into a volatility factor, and steps a
log-return process</p>
<pre><code>S_{i+1} = S_i * exp(drift + vol_i * z_i * sqrt(dt))
</code></pre>
<p>with <code>drift</code> set to the per-5-minute-bar annualized drift. The result
is a <code>nDays</code> x <code>nIntraday</code> array of prices suitable for feeding into
<a href="#computeRV">computeRV</a>.</p>
</dd>
<dt><a href="#seriesToCSV">seriesToCSV(series, [dateHeader], [valueHeader])</a> ⇒ <code>string</code></dt>
<dd><p>Serializes a <code>{date, value}</code> series as a CSV string.</p>
<p>Dates that are <code>Date</code> instances are formatted as their ISO yyyy-mm-dd
prefix; everything else is stringified verbatim. Empty series
produces a header-only CSV.</p>
</dd>
<dt><a href="#ksCriticalValue">ksCriticalValue(n, m, alpha)</a> ⇒ <code>number</code></dt>
<dd><p>Two-sample Kolmogorov-Smirnov asymptotic critical value.</p>
<p>Implements the classical asymptotic formula</p>
<pre><code>D_alpha = sqrt(-0.5 * ln(alpha/2)) * sqrt((n + m) / (n * m))
</code></pre>
<p>which is <code>O(1)</code> in <code>n, m</code> and accurate for moderately large samples.</p>
</dd>
<dt><a href="#ksPvalue">ksPvalue(D, n, m)</a> ⇒ <code>number</code></dt>
<dd><p>Approximate two-sample KS p-value via the asymptotic Kolmogorov
distribution.</p>
<p>Uses the truncated series
    Q(lambda) ~ 2 * sum_{j=1..J} (-1)^{j-1} * exp(-2 * j^2 * lambda^2)
with <code>J = 3</code> terms. The <code>lambda</code> correction</p>
<pre><code>lambda = (sqrt(nm) + 0.12 + 0.11 / sqrt(nm)) * D
</code></pre>
<p>matches the standard asymptotic accuracy improvement recommended by
numerical-statistics references.</p>
</dd>
<dt><a href="#significanceTest">significanceTest(D, n, m, alpha)</a> ⇒ <code>Object</code></dt>
<dd><p>Significance test for the minimized KS distance returned by the
RK-SAVR estimator.</p>
<p>Two views are returned:</p>
<ul>
<li><code>pValue</code> from <a href="#ksPvalue">ksPvalue</a>, comparable against any <code>alpha</code>.</li>
<li><code>criticalValue</code> from <a href="#ksCriticalValue">ksCriticalValue</a> at the same <code>alpha</code>.</li>
</ul>
<p>Interpretation: under the null of self-similarity at the estimated
<code>H</code>, the minimized KS distance should be roughly equal to the
critical value. A <code>significant</code> result means the null is rejected at
the chosen <code>alpha</code> level — i.e. the rescaled samples do <strong>not</strong>
appear identically distributed and the user should treat the
estimate with caution.</p>
</dd>
<dt><a href="#cusumTest">cusumTest(hHistory, targetH, threshold)</a> ⇒ <code>Object</code></dt>
<dd><p>Cumulative Sum (CUSUM) test for structural breaks in <code>H(t)</code> series.</p>
<p>This is a one-sided upper CUSUM on the standardized residuals
<code>r_i = (h_i - targetH) / sigma</code> (where <code>sigma</code> is the empirical
standard deviation of the residuals). A break is flagged when the
CUSUM exceeds <code>threshold</code>. The break index is the point of maximum
CUSUM value.</p>
<p>When the residual series has zero variance (a degenerate history),
returns <code>breakDetected: false</code> instead of dividing by zero.</p>
</dd>
<dt><a href="#detectBreakpoints">detectBreakpoints(hHistory, windowSize, threshold)</a> ⇒ <code>Array.&lt;{index: number, H_before: number, H_after: number}&gt;</code></dt>
<dd><p>Detects breakpoints in a series of H estimates via a sliding-window
CUSUM.</p>
<p>At every index <code>i</code> (with sufficient room on either side) two windows of
length <code>windowSize</code> are compared: <code>[i - windowSize, i)</code> and
<code>[i, i + windowSize)</code>. The &quot;after&quot; window is fed into
<a href="#cusumTest">cusumTest</a> with the &quot;before&quot; mean as the target. A breakpoint is
recorded whenever the CUSUM flags a significant shift at the same
<code>threshold</code>.</p>
<p>Windows whose <code>before</code> sample has zero variance are skipped to avoid
a divide-by-zero in the standardization step.</p>
</dd>
<dt><a href="#bootstrapCI">bootstrapCI(estimator, window, nBoot, alpha)</a> ⇒ <code>Object</code></dt>
<dd><p>Nonparametric bootstrap confidence interval for an arbitrary
<code>H</code> estimator.</p>
<p>Procedure:</p>
<ol>
<li>Evaluate the estimator on the full window to obtain <code>pointEstimate</code>.</li>
<li>Draw <code>nBoot</code> IID samples <strong>with replacement</strong> from the window. Each
bootstrap sample has the same length as the original.</li>
<li>Run the estimator on each bootstrap sample; failed iterations are
silently discarded.</li>
<li>Sort the successful bootstrap estimates and read the
<code>(alpha/2, 1 - alpha/2)</code> percentile pair.</li>
</ol>
<p>Notes:</p>
<ul>
<li>The percentile bounds are returned as <code>lower</code>/<code>upper</code>. When the
bootstrap set is empty (very small <code>nBoot</code> with a fragile estimator)
the bounds collapse to <code>pointEstimate</code> so the CI is well-defined.</li>
</ul>
</dd>
<dt><a href="#asymptoticVariance">asymptoticVariance(scaleA1, scaleA2, n, m)</a> ⇒ <code>number</code></dt>
<dd><p>Asymptotic variance of the RK-SAVR estimator.</p>
<p>Implements</p>
<pre><code>Var(H_hat) = (2 * pi * e) / (ln(a2/a1))^2 * (1/sqrt(n) + 1/sqrt(m))^2.
</code></pre>
<p>When <code>a1 == a2</code> (log ratio zero) the variance is degenerate and the
function returns <code>Infinity</code> rather than dividing by zero; callers that
intend to compute a SE/CI should reject equal scales up-front.</p>
</dd>
<dt><a href="#standardError">standardError(scaleA1, scaleA2, n, m)</a> ⇒ <code>number</code></dt>
<dd><p>Asymptotic standard error: square root of the asymptotic variance.</p>
<p>Thin convenience wrapper. The standard error has units of &quot;Hurst&quot; and
can be read against the <code>hMin</code>/<code>hMax</code> bounds the estimator was
configured with.</p>
</dd>
<dt><a href="#confidenceInterval">confidenceInterval(hEstimate, scaleA1, scaleA2, n, m, alpha)</a> ⇒ <code>Object</code></dt>
<dd><p>Two-sided asymptotic confidence interval for <code>H</code>.</p>
<p>Combines the asymptotic standard error with the standard-normal
critical value <code>z_{1 - alpha/2}</code> (computed by the internal
<code>normalQuantile</code>) to produce</p>
<pre><code>CI = H_hat +/- z * SE.
</code></pre>
<p>Note: this CI is <strong>not</strong> clipped to <code>[0, 1]</code>. For practical reporting
users may want to clamp to <code>[hMin, hMax]</code>.</p>
</dd>
<dt><a href="#kalmanFilter">kalmanFilter(observations, opts)</a> ⇒ <code>Object</code></dt>
<dd><p>One-dimensional Kalman filter for H(t) smoothing.</p>
<p>State: <code>x_t = H_t</code>. Transition: <code>H_t = H_{t-1} + w_t</code>, <code>w_t ~ N(0, q)</code>.
Observation: <code>z_t = H_t + v_t</code>, <code>v_t ~ N(0, r)</code>.</p>
<p>The filter is seeded with the first observation (<code>x_0 = z_0</code>) and a
unit prior covariance. Each subsequent step performs:</p>
<ol>
<li><strong>Predict:</strong> <code>xPred = x</code>, <code>pPred = p + q</code>.</li>
<li><strong>Update:</strong> <code>K = pPred / (pPred + r)</code>, <code>x = xPred + K * (z - xPred)</code>,
<code>p = (1 - K) * pPred</code>.</li>
</ol>
<p>The result captures both the one-step-ahead predictions (before
incorporating the observation) and the filtered states (after).</p>
</dd>
<dt><a href="#constancyTest">constancyTest(observations, opts)</a> ⇒ <code>Object</code></dt>
<dd><p>Constancy test for <code>H(t)</code> based on a Kalman-filter likelihood ratio.</p>
<p>Tests the null hypothesis <code>H0: q = 0</code> (constant Hurst exponent) against
the alternative <code>H1: q &gt; 0</code> (time-varying). Both branches run the same
1D Kalman filter; the test statistic is the likelihood-ratio</p>
<pre><code>LR = 2 * (ll(q = q1) - ll(q = 0))
</code></pre>
<p>which, under <code>H0</code>, is asymptotically <code>chi-squared</code> with one degree of
freedom. The p-value is computed via the standard survival-function
identity <code>P(chi2_1 &gt; x) = 2 * (1 - Phi(sqrt(x)))</code>.</p>
<p>Notes:</p>
<ul>
<li>The constant-vs-time-varying decision uses a fixed <code>alpha = 0.05</code>
cut-off on <code>pValue</code>.</li>
<li>The test is most powerful when <code>n</code> is large and <code>q1</code> is well-chosen;
in practice, sweep over a grid of <code>q1</code> values for robustness.</li>
</ul>
</dd>
<dt><a href="#normalQuantile">normalQuantile(p)</a> ⇒ <code>number</code></dt>
<dd><p>Inverse standard normal CDF (quantile function).</p>
<p>Implementation: piecewise rational approximation due to Beasley &amp;
Springer (1977) / Acklam (2010). The central region
<code>p in [pLow, 1 - pLow]</code> uses a degree-5/4 rational function of
<code>r2 = (p - 0.5)^2</code>; the tails use a degree-3/3 rational function of
<code>q = sqrt(-2 ln p)</code> (or <code>q = sqrt(-2 ln (1 - p))</code> for the upper tail).</p>
<ul>
<li><code>p &lt;= 0</code> returns <code>-Infinity</code>.</li>
<li><code>p &gt;= 1</code> returns <code>Infinity</code>.</li>
<li><code>p === 0.5</code> returns exactly <code>0</code>.</li>
</ul>
<p>Numerical accuracy is <code>~1e-9</code> across the open interval <code>(0, 1)</code>.</p>
</dd>
<dt><a href="#setLogLevel">setLogLevel(level)</a></dt>
<dd><p>Sets the current log level.</p>
</dd>
<dt><a href="#getLogLevel">getLogLevel()</a> ⇒ <code>number</code></dt>
<dd><p>Reads the current log level.</p>
</dd>
<dt><a href="#debug">debug(...args)</a></dt>
<dd><p>Emits a message at <code>DEBUG</code> level.</p>
</dd>
<dt><a href="#info">info(...args)</a></dt>
<dd><p>Emits a message at <code>INFO</code> level.</p>
</dd>
<dt><a href="#warn">warn(...args)</a></dt>
<dd><p>Emits a message at <code>WARN</code> level (visible by default).</p>
</dd>
<dt><a href="#error">error(...args)</a></dt>
<dd><p>Emits a message at <code>ERROR</code> level (visible by default).</p>
</dd>
<dt><a href="#arfima">arfima(opts)</a> ⇒ <code>function</code></dt>
<dd><p>ARFIMA(p, d, q) forecaster factory.</p>
<p>Returns a function that maps a history of <code>H</code> estimates to a
one-step-ahead forecast. The model is the canonical long-memory
combination of autoregressive, fractionally-integrated, and moving-
average components. Implementation steps:</p>
<ol>
<li><p>If the history is shorter than <code>window</code>, fall back to its simple
arithmetic mean.</p>
</li>
<li><p>Take the last <code>window</code> samples and apply fractional differencing
with parameter <code>d</code> via</p>
<pre><code>(1 - L)^d X_t = sum_{k=0..L} binomial(d, k) (-1)^k X_{t - k}
</code></pre>
<p>using a capped lag of 50 to keep the per-step cost bounded.</p>
</li>
<li><p>Add a small AR contribution (weights <code>0.3</code> per lag, capped at three
lags) and a tiny MA correction.</p>
</li>
<li><p>Clamp to <code>[0.01, 0.99]</code> so the forecast remains in the legal
Hurst-parameter range.</p>
</li>
</ol>
<p>The forecaster weights are deliberately conservative defaults; the
goal here is a <em>demonstration</em> model rather than a state-of-the-art
fit.</p>
</dd>
<dt><a href="#holtWintersForecast">holtWintersForecast(series, alpha, beta)</a> ⇒ <code>number</code></dt>
<dd><p>Holt-Winters (level + trend) one-step-ahead forecast.</p>
<p>The recursion updates a level <code>L_t</code> and trend <code>T_t</code> according to</p>
<pre><code>L_t = alpha * X_t + (1 - alpha) * (L_{t-1} + T_{t-1})
T_t = beta  * (L_t - L_{t-1}) + (1 - beta) * T_{t-1}
</code></pre>
<p>then returns <code>L + T</code> as the forecast for the next observation. The
smoothing factors <code>alpha</code> and <code>beta</code> are interpreted as the standard
Holt (1957) hyperparameters.</p>
</dd>
<dt><a href="#createLSTM">createLSTM(opts)</a> ⇒ <code>Object</code></dt>
<dd><p>Creates a minimal stateless LSTM-like recurrent cell for H
forecasting.</p>
<p>This is a <strong>demonstration</strong> model rather than a fully trained LSTM:</p>
<ul>
<li>The cell has four gates (<code>f</code>, <code>i</code>, <code>c~</code>, <code>o</code>) each driven by an
independent Xavier-initialized projection <code>[inputSize + hiddenSize -&gt; hiddenSize]</code>.</li>
<li>Biases are initialized to zero.</li>
<li>The cell is &quot;stateless&quot; in the sense that each call to <code>predict</code>
starts from a zero hidden state and hidden-state at the end of the
sequence is returned, not used as a recurrent seed.</li>
</ul>
<p>The intent is to provide an offline-illustrative model for
forecasting examples. Train weights externally by exposing the
returned <code>step</code> closure and running backprop.</p>
</dd>
<dt><a href="#createAttentionModel">createAttentionModel(opts)</a> ⇒ <code>Object</code></dt>
<dd><p>Creates a minimal stateless Transformer-style self-attention block for
<code>H</code> forecasting.</p>
<p>The model projects each scalar input to a <code>hiddenSize</code>-dimensional
vector via a deterministic linear map (alternating signs and a small
bias), then runs a single head of scaled dot-product self-attention
over the resulting sequence and finally projects back via a learnable
matrix. The output is averaged across the sequence length so the
returned vector has fixed dimension.</p>
<p>Note: <code>numHeads</code> is accepted for API symmetry with full Transformer
implementations but is intentionally unused here — this is a single-
head attention block.</p>
</dd>
<dt><a href="#fOU">fOU(params)</a> ⇒ <code>Object</code></dt>
<dd><p>Simulates an fOU path using Euler-Maruyama (or exact Vasicek when
<code>H = 0.5</code>).</p>
<p>The exact Vasicek recursion for <code>H = 0.5</code> is</p>
<pre><code>X_{t+1} = mu + (X_t - mu) * exp(-theta * dt)
                 + sigma * sqrt((1 - exp(-2 theta dt)) / (2 theta))
                   * Z_{t+1}
</code></pre>
<p>which avoids the bias introduced by naive EM for the standard OU
process.</p>
</dd>
<dt><a href="#exactOU">exactOU(params)</a> ⇒ <code>Object</code></dt>
<dd><p>&quot;Exact&quot; Riemann-Liouville fractional-integral fOU simulator.</p>
<p>Replaces the Euler-Maruyama diffusion of <a href="#fOU">fOU</a> with an exact
Riemann-Liouville integral of the Brownian increments against a
precomputed kernel</p>
<pre><code>K(i) = sqrt(2H) * (i * dt)^{H - 0.5}
</code></pre>
<p>Path update becomes</p>
<pre><code>X_{t+1} = X_t + theta * (mu - X_t) * dt + sigma * sqrt(dt) * I_{t+1}
I_{t+1} = sum_{j &lt;= t} K(t - j) * dW_j
</code></pre>
<p>The integral is <code>O(t)</code> per step and the entire path is <code>O(n^2)</code> in
<code>nSteps</code>, so this is reserved for short series or experiments that
need to isolate discretization error.</p>
</dd>
<dt><a href="#getModel">getModel(name)</a> ⇒ <code>Object</code> | <code>undefined</code></dt>
<dd><p>Retrieves a registered model by name.</p>
</dd>
<dt><a href="#registerModel">registerModel(name, entry)</a></dt>
<dd><p>Adds a new entry to the model registry.</p>
<p>Use this to expose user-defined simulators under the same dispatch
surface as the built-in models. Be aware the registry is in-memory
only — registrations are lost when the module is reloaded.</p>
</dd>
<dt><a href="#listModels">listModels()</a> ⇒ <code>Array.&lt;string&gt;</code></dt>
<dd><p>Lists the identifiers of all currently registered models.</p>
</dd>
<dt><a href="#mPRE">mPRE(params)</a> ⇒ <code>Object</code></dt>
<dd><p>Simulates an MPRE path using the local-Holder approximation.</p>
<p>The process generates two trajectories sharing the same time grid:</p>
<ul>
<li><code>hPath</code>: a mean-reverting OU process in <code>[hMin, hMax]</code>.</li>
<li><code>path</code>: the cumulative sum of <code>sqrt(dt^{2 H_avg}) * randn()</code> where
<code>H_avg = (hPath[t] + hPath[t - 1]) / 2</code>.</li>
</ul>
<p>The variance of each increment is therefore time-varying, which models
the rough/smooth regime changes that motivate the model.</p>
</dd>
<dt><a href="#mPREExact">mPREExact(params)</a> ⇒ <code>Object</code></dt>
<dd><p>&quot;Exact&quot; MPRE simulator using a time-varying Riemann-Liouville kernel.</p>
<p>Each lag <code>(t, j)</code> evaluates the kernel</p>
<pre><code>K_{H(t)}(t - j) = sqrt(2 * (H(t) + H(j)) / 2) * ((t - j) * dt)^{H(t)/2 + H(j)/2 - 1}
</code></pre>
<p>where the exponent is built from the average of the endpoint Holder
values. The path accumulates the corresponding weighted Brownian
increments, so every lag of every step is <code>O(t)</code> and the full path is
<code>O(n^2)</code>. The kernel is <strong>not</strong> cached across time-steps — the
<code>H(t)</code>-dependence makes caching ineffective.</p>
</dd>
<dt><a href="#rBergomi">rBergomi(params)</a> ⇒ <code>Object</code></dt>
<dd><p>Generates <code>nPaths</code> rBergomi volatility paths.</p>
<p>Returns both the variance paths and the time grid. The Brownian
increments are also retained in the <code>brownians</code> field so that
<a href="#rBergomiPrice">rBergomiPrice</a> can drive a price SDE with the same noise
realization.</p>
</dd>
<dt><a href="#rBergomiPrice">rBergomiPrice(params)</a> ⇒ <code>Object</code></dt>
<dd><p>Generates log-price (or price) paths under rBergomi variance.</p>
<p>Given a previously simulated variance path <code>V_t</code> from
<a href="#rBergomi">rBergomi</a>, the price SDE</p>
<pre><code>dS_t / S_t = exp(V_t^{0.5}) * dW_t + mu dt
</code></pre>
<p>is integrated in log form (so that the price cannot drift below zero)
using the same Brownian realization that was used to build the
variance path.</p>
</dd>
<dt><a href="#rFSV">rFSV(params)</a> ⇒ <code>Object</code></dt>
<dd><p>Simulates a single rFSV variance path.</p>
<p>The Euler-Maruyama step writes</p>
<pre><code>V_t = V_{t-1} + theta * (mu - V_{t-1}) * dt
            + nu * V_{t-1}^alpha * sqrt(dt) * Z_t
            + roughness contribution
</code></pre>
<p>where the roughness term is <code>nu * 0.1 * sqrt(dt) * ∑_{j&lt;t} K(t-j) * fGn_j</code>.
The constant <code>0.1</code> is a small multiplier that prevents the rough term
from dominating the path at typical calibration scales.</p>
<p>Path values are floored at <code>1e-6</code> for numerical robustness.</p>
</dd>
<dt><a href="#rFSVPrice">rFSVPrice(params)</a> ⇒ <code>Object</code></dt>
<dd><p>Generates an arithmetic-Brownian-motion price path under an
independently simulated rFSV variance.</p>
<p>Steps:</p>
<ol>
<li><p>Call <a href="#rFSV">rFSV</a> to obtain a variance trajectory.</p>
</li>
<li><p>Iterate the SDE</p>
<pre><code>dS_t = vol_t * S_t * (drift * dt + dW_t * sqrt(dt))
</code></pre>
<p>using freshly drawn normals (no correlation with the variance
driver — the <code>Price</code> flavor assumes independent drivers, which is a
convenient simplification for offline testing).</p>
</li>
</ol>
<p>Note that this routine generates an <em>independent</em> noise realization
from the one used inside <a href="#rFSV">rFSV</a>; the paper-faithful correlated
version would require regenerating the drivers with shared Brownian
motion. For experiments that demand correlation, use
<a href="#rBergomiPrice">rBergomiPrice</a> instead.</p>
</dd>
<dt><a href="#adaptiveGridSearch">adaptiveGridSearch(f, min, max, opts)</a> ⇒ <code>Object</code></dt>
<dd><p>Adaptive grid search with Brent refinement for 1D minimization.</p>
<p>Algorithm:</p>
<ol>
<li>Initialize with the midpoint of <code>[min, max]</code>.</li>
<li>Repeat <code>refineIters</code> times:<ul>
<li>Sample <code>gridSize</code> evenly spaced points across <code>[a, b]</code>.</li>
<li>Track the best point.</li>
<li>Shrink <code>[a, b]</code> to <code>[best - 2*step, best + 2*step]</code> clamped to the
original interval.</li>
<li>Stop early if <code>[a, b]</code> shrinks below <code>tol</code>.</li>
</ul>
</li>
<li>Polish the local minimum with Brent&#39;s method using <code>bestX</code> as the
initial guess.</li>
</ol>
<p>The Brent refinement makes the function value at the returned <code>x</code>
accurate to machine epsilon in nearly all cases.</p>
</dd>
<dt><a href="#brentMinimize">brentMinimize(f, ax, bx, cx, tol)</a> ⇒ <code>Object</code></dt>
<dd><p>Minimizes <code>f(x)</code> on the interval <code>[ax, cx]</code> using Brent&#39;s method.</p>
<p>The algorithm tracks the best point <code>x</code>, the second-best <code>w</code>, and the
third-best <code>v</code>; it uses a parabolic fit whenever the parabolic step is
safe, otherwise falls back to a golden-section step. Convergence is
declared when <code>|x - midpoint| &lt;= 2 * tol * |x| + EPS</code> or when the
iteration cap of 100 is reached.</p>
<p>Invariants:</p>
<ul>
<li>The bracket <code>[a, b]</code> always contains the minimum.</li>
<li><code>f(x) &lt;= f(w) &lt;= f(v)</code> at every iteration.</li>
</ul>
</dd>
<dt><a href="#differentialEvolution">differentialEvolution(f, x0, opts)</a> ⇒ <code>Object</code></dt>
<dd><p>Differential-evolution minimization over an arbitrary-dimensional
space.</p>
<p>The initial population is drawn uniformly inside <code>[lb, ub]</code>. Each
member produces one trial per generation; the trial survives to the
next generation only when its objective is strictly better.</p>
</dd>
<dt><a href="#nelderMead">nelderMead(f, x0, opts)</a> ⇒ <code>Object</code></dt>
<dd><p>Nelder-Mead minimization over a multidimensional space.</p>
<p>Builds an initial simplex by perturbing each axis of <code>x0</code> by <code>1e-4</code>
and then iterates the standard reflection / expansion / contraction /
shrink move until either the spread of function values is below <code>tol</code>
or <code>maxIter</code> iterations have been performed.</p>
</dd>
<dt><a href="#safeOptimizer">safeOptimizer(opt)</a> ⇒ <code>function</code></dt>
<dd><p>Wraps an optimizer so that any thrown error becomes <code>NaN</code> instead of
propagating. The intent is to keep <code>RKSAVR.estimate</code> resilient: a bad
iteration should be logged and skipped, not abort the whole batch.</p>
</dd>
<dt><a href="#getOptimizerFactory">getOptimizerFactory(name)</a> ⇒ <code>function</code> | <code>undefined</code></dt>
<dd><p>Retrieves an optimizer factory by name.</p>
</dd>
<dt><a href="#registerOptimizerFactory">registerOptimizerFactory(name, factory)</a></dt>
<dd><p>Registers (or overrides) a custom optimizer factory.</p>
<p>Use this to plug a proprietary or experimental optimizer into the
registry without modifying the library source. The factory must
return a function with the standard RK-SAVR signature
<code>(f, hMin, hMax, [h0]) =&gt; number</code>.</p>
</dd>
<dt><a href="#simulatedAnnealing">simulatedAnnealing(f, x0, opts)</a> ⇒ <code>Object</code></dt>
<dd><p>Simulated-annealing minimization over an arbitrary-dimensional space.</p>
<p>The neighbor for each iteration is generated by perturbing every
coordinate by a uniform offset in <code>[-stepSize, stepSize]</code>. The
acceptance temperature decays geometrically: <code>temp *= coolingRate</code>. The
loop terminates once either <code>maxIter</code> iterations are performed or the
temperature drops below <code>finalTemp</code>.</p>
</dd>
<dt><a href="#setSeed">setSeed(seed)</a></dt>
<dd><p>Sets a global seed for reproducible simulations.</p>
<p>Passing <code>null</code> or <code>undefined</code> clears the seed and reverts to
<code>Math.random()</code>. Calling <code>setSeed</code> twice restarts the deterministic
sequence from scratch.</p>
</dd>
<dt><a href="#resetSeed">resetSeed()</a></dt>
<dd><p>Resets the PRNG to use <code>Math.random()</code> for all subsequent draws.</p>
<p>Equivalent to <code>setSeed(null)</code>. Use this at the end of a deterministic
experiment to restore nondeterministic behavior.</p>
</dd>
<dt><a href="#random">random()</a> ⇒ <code>number</code></dt>
<dd><p>Returns a uniform random number in <code>[0, 1)</code>.</p>
<p>Uses the seeded generator when one has been installed via <code>setSeed</code>,
otherwise falls through to <code>Math.random()</code>. Because this dispatcher is
called from every stochastic primitive in the library, the <em>entire</em>
computation tree is reproducible from a single seed.</p>
</dd>
<dt><a href="#randn">randn()</a> ⇒ <code>number</code></dt>
<dd><p>Draws a single standard normal via Box-Muller.</p>
<p>The polar variant is implemented by guarding against degenerate
<code>u === 0</code> draws from <code>random()</code>. One Box-Muller pair yields two
independent standard normals; this routine keeps the cosine component
and discards the sine. Use <a href="#correlatedGaussian">correlatedGaussian</a> if you need both
halves, or call <code>randn</code> twice with distinct <code>random()</code> outputs.</p>
</dd>
<dt><a href="#randnBatch">randnBatch(n)</a> ⇒ <code>Float64Array</code></dt>
<dd><p>Pre-allocates a <code>Float64Array</code> of standard normals.</p>
<p>Useful when an inner loop needs a contiguous buffer of normals; the
allocation is amortized across a single batch draw, whereas repeated
<a href="#randn">randn</a> calls would each allocate internally.</p>
</dd>
<dt><a href="#correlatedGaussian">correlatedGaussian(n, rho)</a> ⇒ <code>Array.&lt;Float64Array&gt;</code></dt>
<dd><p>Generates two correlated standard-normal streams via Cholesky.</p>
<p>Mathematically the model is <code>(Z1, Z2)</code> with unit marginals and
<code>Corr(Z1, Z2) = rho</code>. Implementation: draw an i.i.d. Box-Muller pair
<code>(z1, z2)</code>; set <code>Z1 = z1</code>; set <code>Z2 = rho * z1 + sqrt(1 - rho^2) * z2</code>.
Both <code>Z1</code> and <code>Z2</code> have unit variance and exactly correlation <code>rho</code>.</p>
<p>Important: <code>rho</code> must be <strong>strictly</strong> in <code>(-1, 1)</code>; the implementation
silently clamps <code>1 - rho^2</code> to zero via <code>Math.max(0, ...)</code> so the
endpoints collapse to the trivial deterministic case.</p>
</dd>
<dt><a href="#generateFGN">generateFGN(n, H)</a> ⇒ <code>Float64Array</code></dt>
<dd><p>Fractional Gaussian Noise via Hosking&#39;s method.</p>
<p>Hosking&#39;s method is an exact <code>O(n^2)</code> Cholesky-style recursion that
generates samples from the autocovariance
    <code>gamma(k) = 0.5 (|k+1|^{2H} - 2|k|^{2H} + |k-1|^{2H})</code>.</p>
<p>It uses <code>O(n)</code> recursion updates to compute the conditional mean and
variance <code>(phi, v)</code> incrementally, so the per-step cost is <code>O(k)</code> and
the total <code>O(n^2)</code>. This is fine for the scales used in the paper
(a few hundred to a few thousand samples) but dominates for <code>n &gt;&gt; 1e4</code>.</p>
<p>Assumptions:</p>
<ul>
<li><code>n &gt; 0</code> and <code>H in (0, 1)</code>.</li>
<li>The result is mean-zero (the recursion conditions on <code>x_0 ~ N(0, 1)</code>).</li>
</ul>
</dd>
<dt><a href="#generateFBM">generateFBM(n, H)</a> ⇒ <code>Float64Array</code></dt>
<dd><p>Fractional Brownian Motion by cumulative summation of fGN.</p>
<p>The implementation delegates the heavy lifting to <a href="#generateFGN">generateFGN</a>
and then performs a single <code>O(n)</code> cumulative-sum pass. The first sample
is fixed at 0 (the standard convention for <code>fBM(0) = 0</code>), so paths
always start at the origin.</p>
<p>For non-zero means, simply add a constant afterwards — <code>fGn</code> is
mean-zero by construction.</p>
</dd>
<dt><a href="#fractionalKernel">fractionalKernel(H, nSteps, dt)</a> ⇒ <code>Float64Array</code></dt>
<dd><p>Precomputes the Riemann-Liouville fractional kernel used by the
rough-volatility simulators.</p>
<p>Mathematically <code>K(t) = sqrt(2 H) * t^{H - 0.5}</code> for <code>t &gt; 0</code>. The result is
a length-<code>nSteps</code> array where entry <code>i</code> corresponds to <code>t = (i + 1) * dt</code>.</p>
<p>Reusing a precomputed kernel for every path avoids the O(n^2) cost of
re-evaluating the power function per integration step.</p>
</dd>
<dt><a href="#fractionalIntegral">fractionalIntegral(dW, kernel, t)</a> ⇒ <code>number</code></dt>
<dd><p>Computes a single time-step of the Riemann-Liouville fractional integral.</p>
<p>Given precomputed Brownian increments <code>dW</code> and a kernel from
<a href="#fractionalKernel">fractionalKernel</a>, returns
    <code>I_t = sum_{j=0}^{t-1} K(t - j) * dW_j</code>.</p>
<p>Used inside the rBergomi path generator and the exact <code>fOU</code> driver.</p>
<p>Complexity: <code>O(t)</code> per call, so building a full path is <code>O(n^2)</code>. This
is acceptable for paths up to a few hundred steps; for long simulations
switch to a circulant-embedding FFT approximation (not implemented here).</p>
</dd>
<dt><a href="#defaultSampler">defaultSampler(data, n)</a> ⇒ <code>Array.&lt;*&gt;</code></dt>
<dd><p>Default sampler used when the caller does not provide one. It is just a
thin wrapper around <code>randomSample</code> (Floyd&#39;s reservoir sampling) so the
variance-reduction iterations get IID draws of increments without
replacement.</p>
</dd>
<dt><a href="#vectorizedKsObjective">vectorizedKsObjective(sortedSamples, scales, H)</a> ⇒ <code>number</code></dt>
<dd><p>Builds a vectorized KS objective function for multi-scale estimation.</p>
<p>For <code>K &gt; 2</code> scales the mean KS distance across every unordered scale pair
is what gets minimized over <code>H</code> (this is the statistic the RK-SAVR paper
argues for). The implementation assumes the samples have already been
sorted (sorting dominates the inner loop cost in practice and is hoisted
to the caller).</p>
</dd>
<dt><a href="#computeScalePairDistance">computeScalePairDistance(sortedSamples, scales, i, j, H)</a> ⇒ <code>number</code></dt>
<dd><p>KS distance between a single rescaled pair of samples.</p>
<p>Rescales <code>sortedSamples[i]</code> by <code>scales[i]^{-H}</code> and <code>sortedSamples[j]</code> by
<code>scales[j]^{-H}</code> and walks the two empirical CDFs in lock-step via
<code>ksDistanceRescaled</code>. Multiplication by a positive scalar preserves the
ordering, so the inputs are <em>not</em> re-sorted here.</p>
</dd>
<dt><a href="#buildScaleProfile">buildScaleProfile(sortedSamples, scales, H)</a> ⇒ <code>Array.&lt;number&gt;</code></dt>
<dd><p>Builds a flat &quot;profile&quot; of all pairwise KS distances at a fixed <code>H</code>.</p>
<p>Given <code>K</code> sorted samples, the profile has <code>K * (K - 1) / 2</code> entries
corresponding to every unordered scale pair. It is useful for diagnostics
(e.g. plotting the KS distance surface) and is exposed via
<code>rollingMultiScale</code>.</p>
</dd>
<dt><a href="#weightedKsObjective">weightedKsObjective(sortedSamples, scales, weights, H)</a> ⇒ <code>number</code></dt>
<dd><p>Weighted generalization of <a href="#vectorizedKsObjective">vectorizedKsObjective</a>.</p>
<p>Allows callers to up-weight finer scales (which are noisier but more
numerous) or down-weight scales that are highly contaminated by
microstructure effects. The objective computes a weighted arithmetic mean
where each pair&#39;s KS distance is weighted by <code>weights[i] * weights[j]</code>.
The result is normalized so the weights do not change the effective
magnitude of the objective (only the relative emphasis).</p>
</dd>
<dt><a href="#ksDistance">ksDistance(sample1, sample2, isSorted)</a> ⇒ <code>number</code></dt>
<dd><p>Computes the two-sample Kolmogorov-Smirnov distance.</p>
<p>Algorithm: a linear merged-pointer walk over the sorted order statistics.
As we walk through the sorted union we maintain the empirical CDF values
<code>F_n(x) = (i + 1) / n</code> and <code>G_m(x) = j / m</code> at the current position and
record the absolute difference. Sorting first dominates the cost; the
walk itself is <code>O(n + m)</code> where <code>n = sample1.length</code> and
<code>m = sample2.length</code>.</p>
<p>Input validation:</p>
<ul>
<li>Both samples must be non-empty arrays or <code>Float64Array</code>s.</li>
<li>All values must be finite (no <code>NaN</code>, <code>+Infinity</code>, <code>-Infinity</code>).</li>
</ul>
<p>Ties: when values are equal the walk advances both pointers and uses
<code>(i + 1) / n</code> vs. <code>(j + 1) / m</code> for the distance — this matches the
standard two-sided statistic.</p>
</dd>
<dt><a href="#ksDistanceRescaled">ksDistanceRescaled(sortedA, sortedB, factorA, factorB)</a> ⇒ <code>number</code></dt>
<dd><p>Kolmogorov-Smirnov distance for <strong>already sorted</strong> samples that need
rescaling.</p>
<p>Equivalent to <code>ksDistance(a, b, true)</code> but applies the rescaling factors
during the merged-pointer walk so no auxiliary allocation is needed.
Multiplication by a positive scalar is order-preserving, so the
pre-sorting of the inputs is unaffected by the choice of <code>factorA</code> and
<code>factorB</code>.</p>
<p>This is the hot path of the RK-SAVR estimator&#39;s inner loop:
<code>O(n + m)</code> per evaluation, no allocations beyond the locals below.</p>
</dd>
<dt><a href="#shuffle">shuffle(array)</a> ⇒ <code>Array.&lt;*&gt;</code></dt>
<dd><p>Unbiased Fisher-Yates shuffle.</p>
<p>Returns a new array; the input is never mutated. Uses the seeded PRNG
exposed by <code>prng.js</code>, so the result is reproducible when a seed is set.</p>
<p>Complexity: <code>O(n)</code> time, <code>O(n)</code> extra memory.</p>
</dd>
<dt><a href="#blockPermutation">blockPermutation(data, blockSize, randomPhase)</a> ⇒ <code>Array.&lt;*&gt;</code></dt>
<dd><p>Block random permutation for decorrelating serial dependence.</p>
<p>Conceptually this is the paper&#39;s &quot;preserves marginals, kills short-range
autocorrelation&quot; operation:</p>
<ol>
<li>(Optional) shift the starting index by a uniform <code>[-0, blockSize)</code>
offset so two calls with the same seed still produce different
alignments.</li>
<li>Slice the resulting series into blocks of length <code>blockSize</code> (the
first block may be shorter than <code>blockSize</code> when a phase offset was
applied).</li>
<li>Apply a Fisher-Yates shuffle to the block list.</li>
<li>Concatenate the shuffled blocks back into a single sequence.</li>
</ol>
<p>Picking <code>blockSize</code> is the user&#39;s responsibility: it should be larger than
the dominant autocorrelation length in <code>data</code>. Too small and serial
dependence survives; too large and the number of blocks — and therefore
the effective randomization — shrinks.</p>
</dd>
<dt><a href="#randomSample">randomSample(array, n)</a> ⇒ <code>Array.&lt;*&gt;</code></dt>
<dd><p>Floyd&#39;s Algorithm R reservoir sampler.</p>
<p>Streams over the input producing a uniformly random sample of size <code>n</code>
<strong>without replacement</strong>. Equivalent to <code>shuffle(array).slice(0, n)</code> but
uses only <code>O(n)</code> auxiliary memory and a single pass through <code>array</code>,
which matters when sampling from very large arrays (e.g. millions of
increments).</p>
<p>Edge cases:</p>
<ul>
<li><code>n &gt;= array.length</code>: returns a shuffled full copy of <code>array</code>.</li>
<li><code>n &lt;= 0</code>: returns an empty array.</li>
</ul>
</dd>
</dl>

<a name="LogLevel"></a>

## LogLevel
Severity levels, numerically ordered from most to least verbose.

- `DEBUG` (0): per-step diagnostics, only useful for tracing algorithm
  internals.
- `INFO` (1): high-level progress messages.
- `WARN` (2): recoverable issues (default cut-off).
- `ERROR` (3): unhandled failures during processing.
- `SILENT` (4): disables all logging; convenience for tests.

**Kind**: global constant  
<a name="parseCSV"></a>

## parseCSV(csv, opts) ⇒ <code>Array.&lt;Object&gt;</code>
Parses a CSV string into an array of plain objects.

Expected input shape:
- The first non-empty line is the header row.
- Each subsequent line is a record with the same column count as the
  header.
- Fields can be optionally wrapped in double quotes; quotes may embed
  commas but not other escapes.

Type coercion:
- `opts.dateField` (default `"date"`) is parsed via `new Date(...)`.
- Any field listed in `opts.numericFields` is parsed via `parseFloat`.
- All other fields are kept as trimmed strings.

Error handling:
- Empty input returns `[]`.
- Mismatched column counts throw with a descriptive message.
- Non-numeric values in declared numeric columns throw.

**Kind**: global function  
**Returns**: <code>Array.&lt;Object&gt;</code> - Parsed rows, one per non-empty CSV line.  
**Throws**:

- <code>Error</code> When the input is malformed.


| Param | Type | Description |
| --- | --- | --- |
| csv | <code>string</code> | Raw CSV content. |
| opts | <code>Object</code> | Parser options. |
| [opts.dateField] | <code>string</code> | Date column name (default `"date"`). |
| [opts.numericFields] | <code>Array.&lt;string&gt;</code> | Columns to coerce to numbers. |

<a name="extractSeries"></a>

## extractSeries(rows, field, opts) ⇒ <code>Array.&lt;{date: Date, value: number}&gt;</code>
Extracts a `{date, value}` series from a parsed CSV array.

Rows that are missing `field` are skipped; the resulting series is
optionally sorted by `dateField` when the caller asks. Sorting uses
the standard JS `Date` arithmetic, so the dates must be real `Date`
instances.

**Kind**: global function  
**Returns**: <code>Array.&lt;{date: Date, value: number}&gt;</code> - Series of `{date, value}`
  points.  
**Throws**:

- <code>Error</code> When `rows` is not an array or `field` is not a string.


| Param | Type | Description |
| --- | --- | --- |
| rows | <code>Array.&lt;Object&gt;</code> | Parsed CSV rows. |
| field | <code>string</code> | Numeric field name to extract. |
| opts | <code>Object</code> | Extraction options. |
| [opts.sortByDate] | <code>boolean</code> | When `true`, sort by the date field   before extraction (default `false`). |
| [opts.dateField] | <code>string</code> | Date field name (default `"date"`). |

<a name="parseJSON"></a>

## parseJSON(json) ⇒ <code>Array.&lt;Object&gt;</code>
Parses a JSON string that must encode an array of objects.

The function deliberately refuses non-array JSON to keep the loader
simple. Empty or whitespace-only input returns `[]`.

**Kind**: global function  
**Returns**: <code>Array.&lt;Object&gt;</code> - Parsed objects (empty if the input is empty).  
**Throws**:

- <code>Error</code> When the input is not valid JSON or does not decode
  to an array.


| Param | Type | Description |
| --- | --- | --- |
| json | <code>string</code> | Raw JSON string. |

<a name="validateNoGaps"></a>

## validateNoGaps(series, maxGapMs) ⇒ <code>Object</code>
Validates that a time series does not contain temporal gaps larger
than `maxGapMs`.

Returns the maximum observed gap, the full list of pairwise gap
lengths, and a `valid` flag for the threshold check. Series with
fewer than two points are deemed valid by definition.

**Kind**: global function  
**Returns**: <code>Object</code> - Validation result.  

| Param | Type | Description |
| --- | --- | --- |
| series | <code>Array.&lt;{date: Date}&gt;</code> | Time series with `Date` fields. |
| maxGapMs | <code>number</code> | Maximum allowed gap in milliseconds. |

<a name="downsample"></a>

## downsample(series, intervalMs) ⇒ <code>Array.&lt;{date: Date, value: number}&gt;</code>
Downsamples a time series by averaging values that fall into fixed
`intervalMs`-wide buckets.

The bucket index is computed as
    `floor(date.getTime() / intervalMs)`,
so all buckets share the same left edge (`0`, `intervalMs`,
`2 * intervalMs`, ...). The output is sorted by date and every
returned point carries the *bucket start* (not the average timestamp)
as its `date` value.

**Kind**: global function  
**Returns**: <code>Array.&lt;{date: Date, value: number}&gt;</code> - One entry per non-empty
  bucket, sorted chronologically.  
**Throws**:

- <code>Error</code> When `series` is not an array or `intervalMs <= 0`.


| Param | Type | Description |
| --- | --- | --- |
| series | <code>Array.&lt;{date: Date, value: number}&gt;</code> | Input series. |
| intervalMs | <code>number</code> | Bucket length in milliseconds. |

<a name="preavgReturns"></a>

## preavgReturns(prices, [windowSize]) ⇒ <code>Array.&lt;number&gt;</code>
Preaveraging of log-returns.

Implementation of the Jacod et al. (2009) preaveraging estimator
(simplified single-bar variant):

1. Compute log-returns `r_t = log(P_t / P_{t-1})`.
2. For each `i`, average the `windowSize` consecutive returns ending at
   `i` (`g_avg[i] = mean(r_{i - windowSize + 1}, ..., r_i)`).
3. The "preaveraged return" is the first-difference sequence
   `g_avg[i] - g_avg[i - 1]`. This cancellation attenuates
   microstructure noise by `1/sqrt(windowSize)` while preserving the
   drift and diffusion up to `O(1 / windowSize)`.

Note: the result has length `prices.length - windowSize - 1`; for
very short series the function throws rather than returning a few
noisy points.

**Kind**: global function  
**Returns**: <code>Array.&lt;number&gt;</code> - Preaveraged-returns series.  
**Throws**:

- <code>Error</code> When `prices` has fewer than `windowSize + 1`
  elements.


| Param | Type | Description |
| --- | --- | --- |
| prices | <code>Array.&lt;number&gt;</code> | Price series. |
| [windowSize] | <code>number</code> | Preaveraging window (default `2`). |

<a name="realizedKernel"></a>

## realizedKernel(returns, [kernelType], [bandwidth]) ⇒ <code>number</code>
Realized-kernel variance estimator with pluggable kernels.

Given `n` returns, the estimator forms the autocorrelation sequence

    gamma_k = sum_{i=k+1}^{n} r_i * r_{i - k},  k = 0..h

and combines them through a weighted sum

    RV_K = gamma_0 + 2 * sum_{k=1..h} w_k * gamma_k

with weights `w_k` provided by the chosen kernel. The default
`bandwidth` is `floor(n^0.6)`, a rule-of-thumb that matches the
optimal scaling under i.i.d. microstructure noise.

Kernels shipped:

- `bartlett`: `w_k = 1 - k / h` (default).
- `parzen`: the standard piecewise-cubic Parzen kernel.
- `tukey-hanning`: `0.5 (1 + cos(pi k / h))`.

Any unknown kernel name falls back to Bartlett.

**Kind**: global function  
**Returns**: <code>number</code> - Realized-kernel variance (clamped to be
  non-negative).  
**Throws**:

- <code>Error</code> When `returns` is empty.


| Param | Type | Description |
| --- | --- | --- |
| returns | <code>Array.&lt;number&gt;</code> | Log-return series. |
| [kernelType] | <code>string</code> | One of `"bartlett"`, `"parzen"`,   `"tukey-hanning"` (default `"bartlett"`). |
| [bandwidth] | <code>number</code> | Optional explicit bandwidth; defaults to   `floor(n^0.6)`. |

<a name="logVolDebias"></a>

## logVolDebias(rawHEstimates, sigmaObs, sigmaLatent) ⇒ <code>Array.&lt;number&gt;</code>
Heuristic de-biasing of log-volatility H estimates.

Microstructure noise inflates the variance of the log-volatility proxy
relative to the latent signal, which in turn attenuates the
observed roughness. This routine adds a small correction

    h_debias = h + 0.01 * log(sigmaObs / sigmaLatent)

and clamps the result to `[0.01, 0.99]`. It is intentionally
conservative — the user is expected to validate the calibration
against a trust sample before relying on it for production.

**Kind**: global function  
**Returns**: <code>Array.&lt;number&gt;</code> - De-biased H estimates.  
**Throws**:

- <code>Error</code> When `sigmaLatent <= 0`.


| Param | Type | Description |
| --- | --- | --- |
| rawHEstimates | <code>Array.&lt;number&gt;</code> | Raw H estimates from   `RKSAVR.estimate` or `rolling`. |
| sigmaObs | <code>number</code> | Standard deviation of the observed log-vol   series. |
| sigmaLatent | <code>number</code> | Standard deviation of the latent   (denoised) log-vol series. |

<a name="computeRV"></a>

## computeRV(prices, [interval]) ⇒ <code>Array.&lt;number&gt;</code>
Computes per-bucket realized variance from a price series.

The realized variance is the sum of squared log-returns within each
non-overlapping bucket of `interval` observations:

    RV_k = sum_{i in bucket k} (log P_i - log P_{i-1})^2

With `interval = 1` the function emits one RV per log-return
directly, which is the canonical "5-minute RV" form when prices are
already sampled at 5-minute intervals.

**Kind**: global function  
**Returns**: <code>Array.&lt;number&gt;</code> - Realized-variance series.  
**Throws**:

- <code>Error</code> When `prices` is missing, has fewer than two
  elements, contains non-finite or non-positive values, or
  `interval` is not a positive integer.


| Param | Type | Description |
| --- | --- | --- |
| prices | <code>Array.&lt;number&gt;</code> | Chronological price series (strictly   positive, finite). |
| [interval] | <code>number</code> | Bucket size (default `1`; must be a   positive integer). |

<a name="computeRVParkinson"></a>

## computeRVParkinson(bars) ⇒ <code>Array.&lt;number&gt;</code>
Parkinson (1980) high-low RV estimator from OHLC bars.

For each bar the within-period variance is approximated by

    sigma^2 ~= (log(H/L))^2 / (4 * ln 2)

which is `1/(4 ln 2) ~ 0.36` of the log-range-squared. Parkinson is
strictly less efficient than tick-based RV but only requires four
numbers per bar.

**Kind**: global function  
**Returns**: <code>Array.&lt;number&gt;</code> - One Parkinson variance estimate per bar.  
**Throws**:

- <code>Error</code> When `bars` is not an array or any bar has
  non-positive/non-finite `high`/`low` values.


| Param | Type | Description |
| --- | --- | --- |
| bars | <code>Array.&lt;{open: number, high: number, low: number, close: number}&gt;</code> | OHLC bars. |

<a name="aggregateDailyRV"></a>

## aggregateDailyRV(intradayRVs) ⇒ <code>number</code>
Aggregates intraday (5-minute) realized variances into a single daily
value via plain summation.

This is the standard "sum of squared returns" daily RV used in
financial econometrics. It assumes the input is already free of
overnight gaps.

**Kind**: global function  
**Returns**: <code>number</code> - Sum of the intraday RVs (zero for an empty input).  
**Throws**:

- <code>Error</code> When `intradayRVs` is not an array.


| Param | Type | Description |
| --- | --- | --- |
| intradayRVs | <code>Array.&lt;number&gt;</code> | Sequence of 5-minute RVs. |

<a name="logTransform"></a>

## logTransform(rv) ⇒ <code>Array.&lt;number&gt;</code>
Maps realized variance to the log-volatility series consumed by
RK-SAVR.

The transformation is

    X_t = 0.5 * log(RV_t)

i.e. `log(sqrt(RV))`. This converts multiplicative variance dynamics
into a roughly additive (and therefore more stationary) signal, on
top of which the self-similarity property exploited by RK-SAVR is
expressed.

**Kind**: global function  
**Returns**: <code>Array.&lt;number&gt;</code> - Log-volatility series.  
**Throws**:

- <code>Error</code> When `rv` is not an array or contains non-positive
  / non-finite values.


| Param | Type | Description |
| --- | --- | --- |
| rv | <code>Array.&lt;number&gt;</code> | Realized-variance series. |

<a name="centerSeries"></a>

## centerSeries(series) ⇒ <code>Array.&lt;number&gt;</code>
Subtracts the arithmetic mean from every element.

Useful as a final step in the preprocessing pipeline when the user
wants the series to mean-zero (which can stabilize variance-reducing
permutations inside `RKSAVR`).

**Kind**: global function  
**Returns**: <code>Array.&lt;number&gt;</code> - New array of length `series.length` with the
  mean subtracted. Empty input yields `[]`.  

| Param | Type | Description |
| --- | --- | --- |
| series | <code>Array.&lt;number&gt;</code> | Input series. |

<a name="standardizeSeries"></a>

## standardizeSeries(series) ⇒ <code>Array.&lt;number&gt;</code>
Standardizes a time series to zero mean and unit variance.

Divides each centered value by the population standard deviation.
A constant series has zero variance and triggers an explicit error
rather than silently producing `NaN`s.

**Kind**: global function  
**Returns**: <code>Array.&lt;number&gt;</code> - Standardized copy of `series`.  
**Throws**:

- <code>Error</code> When `series` has fewer than two elements or
  population variance zero.


| Param | Type | Description |
| --- | --- | --- |
| series | <code>Array.&lt;number&gt;</code> | Input series (needs at least two   points). |

<a name="preprocessPipeline"></a>

## preprocessPipeline(prices, opts) ⇒ <code>Array.&lt;number&gt;</code>
Bundled preprocessing pipeline: `prices -> RV -> log-vol -> (optional)
centering`.

Equivalent to running [computeRV](#computeRV) + [logTransform](#logTransform) +
(optionally) [centerSeries](#centerSeries), but more compact for callers who
want the canonical transformation.

**Kind**: global function  
**Returns**: <code>Array.&lt;number&gt;</code> - Preprocessed log-volatility series.  

| Param | Type | Description |
| --- | --- | --- |
| prices | <code>Array.&lt;number&gt;</code> | Chronological price series. |
| opts | <code>Object</code> | Pipeline options. |
| [opts.interval] | <code>number</code> | RV aggregation interval (default `1`). |
| [opts.center] | <code>boolean</code> | When `true`, subtract the mean from the   log-volatility series at the end (default `false`). |

<a name="trainTestSplit"></a>

## trainTestSplit(series, [trainRatio]) ⇒ <code>Object</code>
Splits a series into contiguous training and test arrays.

The split point is `floor(series.length * trainRatio)` so the training
set is the leftmost prefix of the series; this preserves temporal
ordering, which is what RK-SAVR forecasters and validation scripts
typically need.

**Kind**: global function  
**Returns**: <code>Object</code> - Train/test
  arrays.  
**Throws**:

- <code>Error</code> When `series` is not an array or `trainRatio` is out
  of range.


| Param | Type | Description |
| --- | --- | --- |
| series | <code>Array.&lt;number&gt;</code> | Input series. |
| [trainRatio] | <code>number</code> | Training fraction in `(0, 1)` (default   `0.8`). |

<a name="createWindows"></a>

## createWindows(series, windowSize, [step]) ⇒ <code>Array.&lt;Array.&lt;number&gt;&gt;</code>
Builds overlapping windows from a single time series.

The i-th window is `series.slice(i, i + windowSize)` for `i = 0, step,
2*step, ...` until no full window fits. Used by offline batch
evaluation pipelines that want to score the estimator on every
available segment of the series.

**Kind**: global function  
**Returns**: <code>Array.&lt;Array.&lt;number&gt;&gt;</code> - One entry per non-truncated window.  
**Throws**:

- <code>Error</code> When `series` is not an array or `windowSize`/`step`
  are non-positive.


| Param | Type | Description |
| --- | --- | --- |
| series | <code>Array.&lt;number&gt;</code> | Input series. |
| windowSize | <code>number</code> | Window length (positive integer). |
| [step] | <code>number</code> | Stride between consecutive windows (default   `1`). |

<a name="generateVIXLogVol"></a>

## generateVIXLogVol(nDays, h, opts) ⇒ <code>Array.&lt;number&gt;</code>
Synthetic VIX-style daily log-volatility.

Generates an fBM with the requested `h` and maps it to a log-volatility
level around `2.0` (i.e. `sqrt(RV) ~ 20%`) by adding a small drift
term and Gaussian observation noise:

    X_t = 2.0 + drift * (fbm[t] / sqrt(n)) + 0.5 * fbm[t] + noise

Default tuning matches the empirical VIX roughness (`h ~ 0.1`) and
annualized log-vol mean.

**Kind**: global function  
**Returns**: <code>Array.&lt;number&gt;</code> - Daily log-volatility series. Empty when
  `nDays <= 0`.  
**Throws**:

- <code>Error</code> When `h` is out of `(0, 1)`.


| Param | Type | Description |
| --- | --- | --- |
| nDays | <code>number</code> | Number of trading days. |
| h | <code>number</code> | Hurst parameter (default `0.1`). |
| opts | <code>Object</code> | Generation options. |
| [opts.seed] | <code>number</code> | PRNG seed for reproducibility. |
| [opts.noiseStd] | <code>number</code> | Observation-noise standard deviation   (default `0.05`). |
| [opts.drift] | <code>number</code> | Log-volatility drift (default `0.02`). |

<a name="generateSPXLogVol"></a>

## generateSPXLogVol(nDays, h, opts) ⇒ <code>Array.&lt;number&gt;</code>
Synthetic S&P 500 realized-volatility style daily log-volatility.

Same construction as [generateVIXLogVol](#generateVIXLogVol) but with a smoother
default Hurst (`h = 0.14`), a smaller drift, and a less volatile
observation-noise level. Empirically these choices match the rough
regime typically reported for SPX RV.

**Kind**: global function  
**Returns**: <code>Array.&lt;number&gt;</code> - Daily log-volatility series. Empty when
  `nDays <= 0`.  
**Throws**:

- <code>Error</code> When `h` is out of `(0, 1)`.


| Param | Type | Description |
| --- | --- | --- |
| nDays | <code>number</code> | Number of trading days. |
| h | <code>number</code> | Hurst parameter (default `0.14`). |
| opts | <code>Object</code> | Generation options. |
| [opts.seed] | <code>number</code> | PRNG seed. |
| [opts.noiseStd] | <code>number</code> | Observation-noise standard deviation   (default `0.03`). |
| [opts.drift] | <code>number</code> | Log-volatility drift (default `0.015`). |

<a name="generateIntradayPrices"></a>

## generateIntradayPrices([nIntraday], [nDays], h, opts) ⇒ <code>Array.&lt;Array.&lt;number&gt;&gt;</code>
Generates synthetic intraday 5-minute prices useful for testing
realized-variance pipelines.

For every (re-)sampled day the generator draws an fBM with the
requested `h`, exponentiates it into a volatility factor, and steps a
log-return process

    S_{i+1} = S_i * exp(drift + vol_i * z_i * sqrt(dt))

with `drift` set to the per-5-minute-bar annualized drift. The result
is a `nDays` x `nIntraday` array of prices suitable for feeding into
[computeRV](#computeRV).

**Kind**: global function  
**Returns**: <code>Array.&lt;Array.&lt;number&gt;&gt;</code> - Array of daily price arrays.  
**Throws**:

- <code>Error</code> When `nIntraday <= 0`, `nDays <= 0`, or `h` is out of
  `(0, 1)`.


| Param | Type | Description |
| --- | --- | --- |
| [nIntraday] | <code>number</code> | Number of 5-minute bars per day   (default `78`, the typical US-equities count). |
| [nDays] | <code>number</code> | Number of days to simulate (default `1`). |
| h | <code>number</code> | Hurst parameter. |
| opts | <code>Object</code> | Generation options. |
| [opts.seed] | <code>number</code> | PRNG seed for reproducibility. |
| [opts.drift] | <code>number</code> | Annualized drift (default `0.05`). |

<a name="seriesToCSV"></a>

## seriesToCSV(series, [dateHeader], [valueHeader]) ⇒ <code>string</code>
Serializes a `{date, value}` series as a CSV string.

Dates that are `Date` instances are formatted as their ISO yyyy-mm-dd
prefix; everything else is stringified verbatim. Empty series
produces a header-only CSV.

**Kind**: global function  
**Returns**: <code>string</code> - CSV-encoded content joined with `\n`.  
**Throws**:

- <code>Error</code> When `series` is not an array.


| Param | Type | Description |
| --- | --- | --- |
| series | <code>Array.&lt;Object&gt;</code> | Time series with `date` and `value`   fields. |
| [dateHeader] | <code>string</code> | Header for the date column (default   `"date"`). |
| [valueHeader] | <code>string</code> | Header for the value column (default   `"value"`). |

<a name="ksCriticalValue"></a>

## ksCriticalValue(n, m, alpha) ⇒ <code>number</code>
Two-sample Kolmogorov-Smirnov asymptotic critical value.

Implements the classical asymptotic formula

    D_alpha = sqrt(-0.5 * ln(alpha/2)) * sqrt((n + m) / (n * m))

which is `O(1)` in `n, m` and accurate for moderately large samples.

**Kind**: global function  
**Returns**: <code>number</code> - Critical value `D_alpha`.  
**Throws**:

- <code>Error</code> When `n`, `m` are non-positive or `alpha` is outside
  the open interval `(0, 1)`.


| Param | Type | Description |
| --- | --- | --- |
| n | <code>number</code> | First sample size. |
| m | <code>number</code> | Second sample size. |
| alpha | <code>number</code> | Significance level (default `0.05`). |

<a name="ksPvalue"></a>

## ksPvalue(D, n, m) ⇒ <code>number</code>
Approximate two-sample KS p-value via the asymptotic Kolmogorov
distribution.

Uses the truncated series
    Q(lambda) ~ 2 * sum_{j=1..J} (-1)^{j-1} * exp(-2 * j^2 * lambda^2)
with `J = 3` terms. The `lambda` correction

    lambda = (sqrt(nm) + 0.12 + 0.11 / sqrt(nm)) * D

matches the standard asymptotic accuracy improvement recommended by
numerical-statistics references.

**Kind**: global function  
**Returns**: <code>number</code> - Approximate p-value in `[0, 1]`. Returns `1` when
  `D < 0` (defensive guard against invalid negative inputs).  

| Param | Type | Description |
| --- | --- | --- |
| D | <code>number</code> | Observed KS distance. |
| n | <code>number</code> | First sample size. |
| m | <code>number</code> | Second sample size. |

<a name="significanceTest"></a>

## significanceTest(D, n, m, alpha) ⇒ <code>Object</code>
Significance test for the minimized KS distance returned by the
RK-SAVR estimator.

Two views are returned:

- `pValue` from [ksPvalue](#ksPvalue), comparable against any `alpha`.
- `criticalValue` from [ksCriticalValue](#ksCriticalValue) at the same `alpha`.

Interpretation: under the null of self-similarity at the estimated
`H`, the minimized KS distance should be roughly equal to the
critical value. A `significant` result means the null is rejected at
the chosen `alpha` level — i.e. the rescaled samples do **not**
appear identically distributed and the user should treat the
estimate with caution.

**Kind**: global function  
**Returns**: <code>Object</code> - Test result bundle.  
**Throws**:

- <code>Error</code> When `D` is non-finite or negative.


| Param | Type | Description |
| --- | --- | --- |
| D | <code>number</code> | Minimized KS distance from `RKSAVR.estimateSingle`   or `estimateSingleWithDiagnostics`. |
| n | <code>number</code> | Sample size at scale `a_1`. |
| m | <code>number</code> | Sample size at scale `a_2`. |
| alpha | <code>number</code> | Significance level (default `0.05`). |

<a name="cusumTest"></a>

## cusumTest(hHistory, targetH, threshold) ⇒ <code>Object</code>
Cumulative Sum (CUSUM) test for structural breaks in `H(t)` series.

This is a one-sided upper CUSUM on the standardized residuals
`r_i = (h_i - targetH) / sigma` (where `sigma` is the empirical
standard deviation of the residuals). A break is flagged when the
CUSUM exceeds `threshold`. The break index is the point of maximum
CUSUM value.

When the residual series has zero variance (a degenerate history),
returns `breakDetected: false` instead of dividing by zero.

**Kind**: global function  
**Returns**: <code>Object</code> - Test result; `breakIndex = -1` when no break is detected.  
**Throws**:

- <code>Error</code> When `hHistory` is empty.


| Param | Type | Description |
| --- | --- | --- |
| hHistory | <code>Array.&lt;number&gt;</code> | Time-ordered series of `H` estimates. |
| targetH | <code>number</code> | Target value of `H` under the null of structural   stability (typically the mean of the series). |
| threshold | <code>number</code> | Alarm threshold (default `3.0`). |

<a name="detectBreakpoints"></a>

## detectBreakpoints(hHistory, windowSize, threshold) ⇒ <code>Array.&lt;{index: number, H\_before: number, H\_after: number}&gt;</code>
Detects breakpoints in a series of H estimates via a sliding-window
CUSUM.

At every index `i` (with sufficient room on either side) two windows of
length `windowSize` are compared: `[i - windowSize, i)` and
`[i, i + windowSize)`. The "after" window is fed into
[cusumTest](#cusumTest) with the "before" mean as the target. A breakpoint is
recorded whenever the CUSUM flags a significant shift at the same
`threshold`.

Windows whose `before` sample has zero variance are skipped to avoid
a divide-by-zero in the standardization step.

**Kind**: global function  
**Returns**: <code>Array.&lt;{index: number, H\_before: number, H\_after: number}&gt;</code> - Detected breakpoints in chronological order; empty if none.  

| Param | Type | Description |
| --- | --- | --- |
| hHistory | <code>Array.&lt;number&gt;</code> | Time-ordered series of `H` estimates. |
| windowSize | <code>number</code> | Sliding window size (default `50`). |
| threshold | <code>number</code> | CUSUM threshold (default `3.0`). |

<a name="bootstrapCI"></a>

## bootstrapCI(estimator, window, nBoot, alpha) ⇒ <code>Object</code>
Nonparametric bootstrap confidence interval for an arbitrary
`H` estimator.

Procedure:

1. Evaluate the estimator on the full window to obtain `pointEstimate`.
2. Draw `nBoot` IID samples **with replacement** from the window. Each
   bootstrap sample has the same length as the original.
3. Run the estimator on each bootstrap sample; failed iterations are
   silently discarded.
4. Sort the successful bootstrap estimates and read the
   `(alpha/2, 1 - alpha/2)` percentile pair.

Notes:
- The percentile bounds are returned as `lower`/`upper`. When the
  bootstrap set is empty (very small `nBoot` with a fragile estimator)
  the bounds collapse to `pointEstimate` so the CI is well-defined.

**Kind**: global function  
**Returns**: <code>Object</code> - Centile bootstrap CI.  
**Throws**:

- <code>Error</code> When `window` is empty.


| Param | Type | Description |
| --- | --- | --- |
| estimator | <code>function</code> | Function that   returns `H` from a window. |
| window | <code>Array.&lt;number&gt;</code> | Data window. |
| nBoot | <code>number</code> | Bootstrap iterations (default `1000`). |
| alpha | <code>number</code> | Significance level (default `0.05`). |

<a name="asymptoticVariance"></a>

## asymptoticVariance(scaleA1, scaleA2, n, m) ⇒ <code>number</code>
Asymptotic variance of the RK-SAVR estimator.

Implements

    Var(H_hat) = (2 * pi * e) / (ln(a2/a1))^2 * (1/sqrt(n) + 1/sqrt(m))^2.

When `a1 == a2` (log ratio zero) the variance is degenerate and the
function returns `Infinity` rather than dividing by zero; callers that
intend to compute a SE/CI should reject equal scales up-front.

**Kind**: global function  
**Returns**: <code>number</code> - Non-negative asymptotic variance (`Infinity` if the
  scales coincide).  

| Param | Type | Description |
| --- | --- | --- |
| scaleA1 | <code>number</code> | Lower scale `a_1`. |
| scaleA2 | <code>number</code> | Upper scale `a_2`. |
| n | <code>number</code> | Sample size at `a_1`. |
| m | <code>number</code> | Sample size at `a_2`. |

<a name="standardError"></a>

## standardError(scaleA1, scaleA2, n, m) ⇒ <code>number</code>
Asymptotic standard error: square root of the asymptotic variance.

Thin convenience wrapper. The standard error has units of "Hurst" and
can be read against the `hMin`/`hMax` bounds the estimator was
configured with.

**Kind**: global function  
**Returns**: <code>number</code> - Non-negative standard error (`Infinity` for degenerate
  scale choices).  

| Param | Type | Description |
| --- | --- | --- |
| scaleA1 | <code>number</code> | Lower scale `a_1`. |
| scaleA2 | <code>number</code> | Upper scale `a_2`. |
| n | <code>number</code> | Sample size at `a_1`. |
| m | <code>number</code> | Sample size at `a_2`. |

<a name="confidenceInterval"></a>

## confidenceInterval(hEstimate, scaleA1, scaleA2, n, m, alpha) ⇒ <code>Object</code>
Two-sided asymptotic confidence interval for `H`.

Combines the asymptotic standard error with the standard-normal
critical value `z_{1 - alpha/2}` (computed by the internal
`normalQuantile`) to produce

    CI = H_hat +/- z * SE.

Note: this CI is **not** clipped to `[0, 1]`. For practical reporting
users may want to clamp to `[hMin, hMax]`.

**Kind**: global function  
**Returns**: <code>Object</code> - Confidence interval bounds.  

| Param | Type | Description |
| --- | --- | --- |
| hEstimate | <code>number</code> | Point estimate of `H`. |
| scaleA1 | <code>number</code> | Lower scale `a_1`. |
| scaleA2 | <code>number</code> | Upper scale `a_2`. |
| n | <code>number</code> | Sample size at `a_1`. |
| m | <code>number</code> | Sample size at `a_2`. |
| alpha | <code>number</code> | Significance level (default `0.05`). |

<a name="kalmanFilter"></a>

## kalmanFilter(observations, opts) ⇒ <code>Object</code>
One-dimensional Kalman filter for H(t) smoothing.

State: `x_t = H_t`. Transition: `H_t = H_{t-1} + w_t`, `w_t ~ N(0, q)`.
Observation: `z_t = H_t + v_t`, `v_t ~ N(0, r)`.

The filter is seeded with the first observation (`x_0 = z_0`) and a
unit prior covariance. Each subsequent step performs:

1. **Predict:** `xPred = x`, `pPred = p + q`.
2. **Update:** `K = pPred / (pPred + r)`, `x = xPred + K * (z - xPred)`,
   `p = (1 - K) * pPred`.

The result captures both the one-step-ahead predictions (before
incorporating the observation) and the filtered states (after).

**Kind**: global function  
**Returns**: <code>Object</code> - Filtered and one-step-predicted states, each of length `n`.  

| Param | Type | Description |
| --- | --- | --- |
| observations | <code>Array.&lt;number&gt;</code> | Time-ordered `H` estimates. |
| opts | <code>Object</code> | Filter options. |
| [opts.q] | <code>number</code> | Process noise variance (default `0.01`). |
| [opts.r] | <code>number</code> | Measurement noise variance (default `0.1`). |

<a name="constancyTest"></a>

## constancyTest(observations, opts) ⇒ <code>Object</code>
Constancy test for `H(t)` based on a Kalman-filter likelihood ratio.

Tests the null hypothesis `H0: q = 0` (constant Hurst exponent) against
the alternative `H1: q > 0` (time-varying). Both branches run the same
1D Kalman filter; the test statistic is the likelihood-ratio

    LR = 2 * (ll(q = q1) - ll(q = 0))

which, under `H0`, is asymptotically `chi-squared` with one degree of
freedom. The p-value is computed via the standard survival-function
identity `P(chi2_1 > x) = 2 * (1 - Phi(sqrt(x)))`.

Notes:

- The constant-vs-time-varying decision uses a fixed `alpha = 0.05`
  cut-off on `pValue`.
- The test is most powerful when `n` is large and `q1` is well-chosen;
  in practice, sweep over a grid of `q1` values for robustness.

**Kind**: global function  
**Returns**: <code>Object</code> - Test
  bundle; `constant = true` when the null is **not** rejected at the
  5% level.  

| Param | Type | Description |
| --- | --- | --- |
| observations | <code>Array.&lt;number&gt;</code> | Time-ordered `H` estimates. |
| opts | <code>Object</code> | Filter options. |
| [opts.q] | <code>number</code> | Process-noise variance under `H1` (default   `0.01`). |
| [opts.r] | <code>number</code> | Measurement-noise variance (default `0.1`). |

<a name="normalQuantile"></a>

## normalQuantile(p) ⇒ <code>number</code>
Inverse standard normal CDF (quantile function).

Implementation: piecewise rational approximation due to Beasley &
Springer (1977) / Acklam (2010). The central region
`p in [pLow, 1 - pLow]` uses a degree-5/4 rational function of
`r2 = (p - 0.5)^2`; the tails use a degree-3/3 rational function of
`q = sqrt(-2 ln p)` (or `q = sqrt(-2 ln (1 - p))` for the upper tail).

- `p <= 0` returns `-Infinity`.
- `p >= 1` returns `Infinity`.
- `p === 0.5` returns exactly `0`.

Numerical accuracy is `~1e-9` across the open interval `(0, 1)`.

**Kind**: global function  
**Returns**: <code>number</code> - Quantile `Phi^{-1}(p)`.  

| Param | Type | Description |
| --- | --- | --- |
| p | <code>number</code> | Probability in `[0, 1]`. |

<a name="setLogLevel"></a>

## setLogLevel(level)
Sets the current log level.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| level | <code>number</code> | One of the `LogLevel` numeric constants. |

<a name="getLogLevel"></a>

## getLogLevel() ⇒ <code>number</code>
Reads the current log level.

**Kind**: global function  
**Returns**: <code>number</code> - Active `LogLevel` value.  
<a name="debug"></a>

## debug(...args)
Emits a message at `DEBUG` level.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| ...args | <code>\*</code> | Values forwarded to `console.debug`. |

<a name="info"></a>

## info(...args)
Emits a message at `INFO` level.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| ...args | <code>\*</code> | Values forwarded to `console.info`. |

<a name="warn"></a>

## warn(...args)
Emits a message at `WARN` level (visible by default).

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| ...args | <code>\*</code> | Values forwarded to `console.warn`. |

<a name="error"></a>

## error(...args)
Emits a message at `ERROR` level (visible by default).

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| ...args | <code>\*</code> | Values forwarded to `console.error`. |

<a name="arfima"></a>

## arfima(opts) ⇒ <code>function</code>
ARFIMA(p, d, q) forecaster factory.

Returns a function that maps a history of `H` estimates to a
one-step-ahead forecast. The model is the canonical long-memory
combination of autoregressive, fractionally-integrated, and moving-
average components. Implementation steps:

1. If the history is shorter than `window`, fall back to its simple
   arithmetic mean.
2. Take the last `window` samples and apply fractional differencing
   with parameter `d` via

       (1 - L)^d X_t = sum_{k=0..L} binomial(d, k) (-1)^k X_{t - k}

   using a capped lag of 50 to keep the per-step cost bounded.
3. Add a small AR contribution (weights `0.3` per lag, capped at three
   lags) and a tiny MA correction.
4. Clamp to `[0.01, 0.99]` so the forecast remains in the legal
   Hurst-parameter range.

The forecaster weights are deliberately conservative defaults; the
goal here is a *demonstration* model rather than a state-of-the-art
fit.

**Kind**: global function  
**Returns**: <code>function</code> - Forecasting function
  `history -> predicted H`.  

| Param | Type | Description |
| --- | --- | --- |
| opts | <code>Object</code> | Model parameters. |
| [opts.p] | <code>number</code> | AR order (default `1`). |
| [opts.d] | <code>number</code> | Differencing parameter (default `0.3`). |
| [opts.q] | <code>number</code> | MA order (default `1`). |
| [opts.window] | <code>number</code> | Window size for rolling forecasts   (default `100`). |

<a name="holtWintersForecast"></a>

## holtWintersForecast(series, alpha, beta) ⇒ <code>number</code>
Holt-Winters (level + trend) one-step-ahead forecast.

The recursion updates a level `L_t` and trend `T_t` according to

    L_t = alpha * X_t + (1 - alpha) * (L_{t-1} + T_{t-1})
    T_t = beta  * (L_t - L_{t-1}) + (1 - beta) * T_{t-1}

then returns `L + T` as the forecast for the next observation. The
smoothing factors `alpha` and `beta` are interpreted as the standard
Holt (1957) hyperparameters.

**Kind**: global function  
**Returns**: <code>number</code> - Forecast for the next observation.  
**Throws**:

- <code>Error</code> When `series` is empty or `alpha`/`beta` are outside
  `[0, 1]`.


| Param | Type | Description |
| --- | --- | --- |
| series | <code>Array.&lt;number&gt;</code> | Non-empty input series. |
| alpha | <code>number</code> | Level smoothing factor in `[0, 1]` (default   `0.3`). |
| beta | <code>number</code> | Trend smoothing factor in `[0, 1]` (default   `0.1`). |

<a name="createLSTM"></a>

## createLSTM(opts) ⇒ <code>Object</code>
Creates a minimal stateless LSTM-like recurrent cell for H
forecasting.

This is a **demonstration** model rather than a fully trained LSTM:

- The cell has four gates (`f`, `i`, `c~`, `o`) each driven by an
  independent Xavier-initialized projection `[inputSize + hiddenSize
  -> hiddenSize]`.
- Biases are initialized to zero.
- The cell is "stateless" in the sense that each call to `predict`
  starts from a zero hidden state and hidden-state at the end of the
  sequence is returned, not used as a recurrent seed.

The intent is to provide an offline-illustrative model for
forecasting examples. Train weights externally by exposing the
returned `step` closure and running backprop.

**Kind**: global function  
**Returns**: <code>Object</code> - A predictor with `predict(series)` returning the final hidden state.  

| Param | Type | Description |
| --- | --- | --- |
| opts | <code>Object</code> | Architecture options. |
| [opts.hiddenSize] | <code>number</code> | Hidden state dimension (default `16`). |
| [opts.inputSize] | <code>number</code> | Input dimension (default `1`). |

<a name="createAttentionModel"></a>

## createAttentionModel(opts) ⇒ <code>Object</code>
Creates a minimal stateless Transformer-style self-attention block for
`H` forecasting.

The model projects each scalar input to a `hiddenSize`-dimensional
vector via a deterministic linear map (alternating signs and a small
bias), then runs a single head of scaled dot-product self-attention
over the resulting sequence and finally projects back via a learnable
matrix. The output is averaged across the sequence length so the
returned vector has fixed dimension.

Note: `numHeads` is accepted for API symmetry with full Transformer
implementations but is intentionally unused here — this is a single-
head attention block.

**Kind**: global function  
**Returns**: <code>Object</code> - Predictor
  with `predict(series)` returning the aggregated hidden vector.  

| Param | Type | Description |
| --- | --- | --- |
| opts | <code>Object</code> | Architecture options. |
| [opts.hiddenSize] | <code>number</code> | Hidden dimension (default `16`). |
| [opts.numHeads] | <code>number</code> | Reserved for future multi-head   support; not used in this minimal implementation. |

<a name="fOU"></a>

## fOU(params) ⇒ <code>Object</code>
Simulates an fOU path using Euler-Maruyama (or exact Vasicek when
`H = 0.5`).

The exact Vasicek recursion for `H = 0.5` is

    X_{t+1} = mu + (X_t - mu) * exp(-theta * dt)
                     + sigma * sqrt((1 - exp(-2 theta dt)) / (2 theta))
                       * Z_{t+1}

which avoids the bias introduced by naive EM for the standard OU
process.

**Kind**: global function  
**Returns**: <code>Object</code> - Simulated path
  and time grid.  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | Model parameters. |
| [params.nSteps] | <code>number</code> | Number of time steps (default `252`). |
| [params.T] | <code>number</code> | Terminal time (default `1.0`). |
| [params.theta] | <code>number</code> | Mean-reversion speed (default `1.0`). |
| [params.mu] | <code>number</code> | Long-term mean (default `0.0`). |
| [params.sigma] | <code>number</code> | Diffusion scale (default `1.0`). |
| [params.h] | <code>number</code> | Hurst parameter (default `0.5`). |
| [params.x0] | <code>number</code> | Initial value (default `0.0`). |

<a name="exactOU"></a>

## exactOU(params) ⇒ <code>Object</code>
"Exact" Riemann-Liouville fractional-integral fOU simulator.

Replaces the Euler-Maruyama diffusion of [fOU](#fOU) with an exact
Riemann-Liouville integral of the Brownian increments against a
precomputed kernel

    K(i) = sqrt(2H) * (i * dt)^{H - 0.5}

Path update becomes

    X_{t+1} = X_t + theta * (mu - X_t) * dt + sigma * sqrt(dt) * I_{t+1}
    I_{t+1} = sum_{j <= t} K(t - j) * dW_j

The integral is `O(t)` per step and the entire path is `O(n^2)` in
`nSteps`, so this is reserved for short series or experiments that
need to isolate discretization error.

**Kind**: global function  
**Returns**: <code>Object</code> - Simulated path
  and time grid.  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | Same shape as [fOU](#fOU). |
| [params.nSteps] | <code>number</code> | Number of time steps (default `252`). |
| [params.T] | <code>number</code> | Terminal time (default `1.0`). |
| [params.theta] | <code>number</code> | Mean-reversion speed (default `1.0`). |
| [params.mu] | <code>number</code> | Long-term mean (default `0.0`). |
| [params.sigma] | <code>number</code> | Diffusion scale (default `1.0`). |
| [params.h] | <code>number</code> | Hurst parameter (default `0.5`). |
| [params.x0] | <code>number</code> | Initial value (default `0.0`). |

<a name="getModel"></a>

## getModel(name) ⇒ <code>Object</code> \| <code>undefined</code>
Retrieves a registered model by name.

**Kind**: global function  
**Returns**: <code>Object</code> \| <code>undefined</code> - The registry entry; `undefined` when the
  name is unknown.  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | Model identifier (one of the keys in   `MODEL_REGISTRY`, or a custom name registered via   [registerModel](#registerModel)). |

<a name="registerModel"></a>

## registerModel(name, entry)
Adds a new entry to the model registry.

Use this to expose user-defined simulators under the same dispatch
surface as the built-in models. Be aware the registry is in-memory
only — registrations are lost when the module is reloaded.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | Unique identifier under which to register. |
| entry | <code>Object</code> | Entry object (`{simulate, price}`, `{forecast}`,   or `{predict}` depending on the role of the model). |

<a name="listModels"></a>

## listModels() ⇒ <code>Array.&lt;string&gt;</code>
Lists the identifiers of all currently registered models.

**Kind**: global function  
**Returns**: <code>Array.&lt;string&gt;</code> - Snapshot of the registry's keys.  
<a name="mPRE"></a>

## mPRE(params) ⇒ <code>Object</code>
Simulates an MPRE path using the local-Holder approximation.

The process generates two trajectories sharing the same time grid:

- `hPath`: a mean-reverting OU process in `[hMin, hMax]`.
- `path`: the cumulative sum of `sqrt(dt^{2 H_avg}) * randn()` where
  `H_avg = (hPath[t] + hPath[t - 1]) / 2`.

The variance of each increment is therefore time-varying, which models
the rough/smooth regime changes that motivate the model.

**Kind**: global function  
**Returns**: <code>Object</code> - Simulated path, latent `H(t)` path, and time grid.  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | Model parameters. |
| [params.nSteps] | <code>number</code> | Number of time steps (default `252`). |
| [params.T] | <code>number</code> | Terminal time (default `1.0`). |
| [params.hMin] | <code>number</code> | Lower clamp on `H(t)` (default `0.05`). |
| [params.hMax] | <code>number</code> | Upper clamp on `H(t)` (default `0.95`). |
| [params.h0] | <code>number</code> | Initial `H` (default `0.1`). |
| [params.hProcess] | <code>Object</code> | OU options for `H(t)`. |
| [params.hProcess.theta] | <code>number</code> | Mean-reversion speed   (default `1.0`). |
| [params.hProcess.mu] | <code>number</code> | Long-term mean (default `0.2`). |
| [params.hProcess.sigma] | <code>number</code> | Diffusion scale (default   `0.1`). |
| [params.x0] | <code>number</code> | Initial value of the path (default `0`). |

<a name="mPREExact"></a>

## mPREExact(params) ⇒ <code>Object</code>
"Exact" MPRE simulator using a time-varying Riemann-Liouville kernel.

Each lag `(t, j)` evaluates the kernel

    K_{H(t)}(t - j) = sqrt(2 * (H(t) + H(j)) / 2) * ((t - j) * dt)^{H(t)/2 + H(j)/2 - 1}

where the exponent is built from the average of the endpoint Holder
values. The path accumulates the corresponding weighted Brownian
increments, so every lag of every step is `O(t)` and the full path is
`O(n^2)`. The kernel is **not** cached across time-steps — the
`H(t)`-dependence makes caching ineffective.

**Kind**: global function  
**Returns**: <code>Object</code> - Simulated path, latent `H(t)` path, and time grid.  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | Same shape as [mPRE](#mPRE). |
| [params.nSteps] | <code>number</code> | Number of time steps (default `252`). |
| [params.T] | <code>number</code> | Terminal time (default `1.0`). |
| [params.hMin] | <code>number</code> | Lower clamp on `H(t)` (default `0.05`). |
| [params.hMax] | <code>number</code> | Upper clamp on `H(t)` (default `0.95`). |
| [params.h0] | <code>number</code> | Initial `H` (default `0.1`). |
| [params.hProcess] | <code>Object</code> | OU options for `H(t)`. |
| [params.x0] | <code>number</code> | Initial value of the path (default `0`). |

<a name="rBergomi"></a>

## rBergomi(params) ⇒ <code>Object</code>
Generates `nPaths` rBergomi volatility paths.

Returns both the variance paths and the time grid. The Brownian
increments are also retained in the `brownians` field so that
[rBergomiPrice](#rBergomiPrice) can drive a price SDE with the same noise
realization.

**Kind**: global function  
**Returns**: <code>Object</code> - Simulated variance paths, time grid, and the
  underlying Brownian increments for downstream use.  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | Model parameters. |
| [params.nPaths] | <code>number</code> | Number of simulation paths (default `1`). |
| [params.nSteps] | <code>number</code> | Number of time steps (default `252`). |
| [params.xi] | <code>number</code> | Initial variance level `xi` (default `0.04`). |
| [params.eta] | <code>number</code> | Volatility-of-volatility (default `2.0`). |
| [params.rho] | <code>number</code> | Correlation between price and volatility   Brownian motions (default `-0.8`). |
| [params.h] | <code>number</code> | Hurst parameter; should satisfy   `0 < H <= 0.5` for the rough regime (default `0.1`). |
| [params.T] | <code>number</code> | Terminal time (default `1.0`). |

<a name="rBergomiPrice"></a>

## rBergomiPrice(params) ⇒ <code>Object</code>
Generates log-price (or price) paths under rBergomi variance.

Given a previously simulated variance path `V_t` from
[rBergomi](#rBergomi), the price SDE

    dS_t / S_t = exp(V_t^{0.5}) * dW_t + mu dt

is integrated in log form (so that the price cannot drift below zero)
using the same Brownian realization that was used to build the
variance path.

**Kind**: global function  
**Returns**: <code>Object</code> - Simulated price paths,
  their variance paths, and the shared time grid.  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | Model parameters. Inherits every rBergomi   parameter from [rBergomi](#rBergomi) (`xi`, `eta`, `rho`, `h`, `T`) and   adds the price-specific ones below. |
| [params.nPaths] | <code>number</code> | Number of paths (default `1`). |
| [params.nSteps] | <code>number</code> | Number of time steps (default `252`). |
| [params.mu] | <code>number</code> | Drift (default `0`, martingale). |
| [params.s0] | <code>number</code> | Initial price (default `100`). |
| [params.xi] | <code>number</code> | Initial variance (default `0.04`). |
| [params.eta] | <code>number</code> | Vol-of-vol (default `2.0`). |
| [params.rho] | <code>number</code> | Correlation (default `-0.8`). |
| [params.h] | <code>number</code> | Hurst (default `0.1`). |
| [params.T] | <code>number</code> | Terminal time (default `1.0`). |

<a name="rFSV"></a>

## rFSV(params) ⇒ <code>Object</code>
Simulates a single rFSV variance path.

The Euler-Maruyama step writes

    V_t = V_{t-1} + theta * (mu - V_{t-1}) * dt
                + nu * V_{t-1}^alpha * sqrt(dt) * Z_t
                + roughness contribution

where the roughness term is `nu * 0.1 * sqrt(dt) * ∑_{j<t} K(t-j) * fGn_j`.
The constant `0.1` is a small multiplier that prevents the rough term
from dominating the path at typical calibration scales.

Path values are floored at `1e-6` for numerical robustness.

**Kind**: global function  
**Returns**: <code>Object</code> - Simulated
  variance path and time grid.  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | Model parameters. |
| [params.nSteps] | <code>number</code> | Number of time steps (default `252`). |
| [params.T] | <code>number</code> | Terminal time (default `1.0`). |
| [params.h] | <code>number</code> | Hurst parameter (default `0.1`). |
| [params.theta] | <code>number</code> | Mean-reversion speed (default `2.0`). |
| [params.mu] | <code>number</code> | Long-term variance mean (default `0.04`). |
| [params.nu] | <code>number</code> | Vol-of-vol (default `0.5`). |
| [params.alpha] | <code>number</code> | Diffusion exponent (default `0.5`,   matching the Heston square-root form). |
| [params.v0] | <code>number</code> | Initial variance (default `0.04`). |

<a name="rFSVPrice"></a>

## rFSVPrice(params) ⇒ <code>Object</code>
Generates an arithmetic-Brownian-motion price path under an
independently simulated rFSV variance.

Steps:

1. Call [rFSV](#rFSV) to obtain a variance trajectory.
2. Iterate the SDE

       dS_t = vol_t * S_t * (drift * dt + dW_t * sqrt(dt))

   using freshly drawn normals (no correlation with the variance
   driver — the `Price` flavor assumes independent drivers, which is a
   convenient simplification for offline testing).

Note that this routine generates an *independent* noise realization
from the one used inside [rFSV](#rFSV); the paper-faithful correlated
version would require regenerating the drivers with shared Brownian
motion. For experiments that demand correlation, use
[rBergomiPrice](#rBergomiPrice) instead.

**Kind**: global function  
**Returns**: <code>Object</code> - Simulated price, the underlying variance path, and
  the shared time grid.  

| Param | Type | Description |
| --- | --- | --- |
| params | <code>Object</code> | Model parameters. |
| [params.drift] | <code>number</code> | Drift (default `0`). |
| [params.s0] | <code>number</code> | Initial price (default `100`). |
| [params.nSteps] | <code>number</code> | Number of time steps (default `252`). |
| [params.T] | <code>number</code> | Terminal time (default `1.0`). |
| [params.h] | <code>number</code> | Hurst parameter (default `0.1`). |
| [params.theta] | <code>number</code> | Mean-reversion speed (default `2.0`). |
| [params.mu] | <code>number</code> | Long-term variance mean (default `0.04`). |
| [params.nu] | <code>number</code> | Vol-of-vol (default `0.5`). |
| [params.v0] | <code>number</code> | Initial variance (default `0.04`). |

<a name="adaptiveGridSearch"></a>

## adaptiveGridSearch(f, min, max, opts) ⇒ <code>Object</code>
Adaptive grid search with Brent refinement for 1D minimization.

Algorithm:

1. Initialize with the midpoint of `[min, max]`.
2. Repeat `refineIters` times:
   - Sample `gridSize` evenly spaced points across `[a, b]`.
   - Track the best point.
   - Shrink `[a, b]` to `[best - 2*step, best + 2*step]` clamped to the
     original interval.
   - Stop early if `[a, b]` shrinks below `tol`.
3. Polish the local minimum with Brent's method using `bestX` as the
   initial guess.

The Brent refinement makes the function value at the returned `x`
accurate to machine epsilon in nearly all cases.

**Kind**: global function  
**Returns**: <code>Object</code> - Best point and its objective value.  
**Throws**:

- <code>Error</code> When `gridSize <= 1`.


| Param | Type | Description |
| --- | --- | --- |
| f | <code>function</code> | Objective function (1D). |
| min | <code>number</code> | Lower bound. |
| max | <code>number</code> | Upper bound. |
| opts | <code>Object</code> | Algorithm options. |
| [opts.gridSize] | <code>number</code> | Number of coarse-grid points per   refinement (default `50`). |
| [opts.refineIters] | <code>number</code> | Number of refinement rounds   (default `3`). |
| [opts.tol] | <code>number</code> | Convergence tolerance (default `1e-7`). |

<a name="brentMinimize"></a>

## brentMinimize(f, ax, bx, cx, tol) ⇒ <code>Object</code>
Minimizes `f(x)` on the interval `[ax, cx]` using Brent's method.

The algorithm tracks the best point `x`, the second-best `w`, and the
third-best `v`; it uses a parabolic fit whenever the parabolic step is
safe, otherwise falls back to a golden-section step. Convergence is
declared when `|x - midpoint| <= 2 * tol * |x| + EPS` or when the
iteration cap of 100 is reached.

Invariants:

- The bracket `[a, b]` always contains the minimum.
- `f(x) <= f(w) <= f(v)` at every iteration.

**Kind**: global function  
**Returns**: <code>Object</code> - The argmin `x` and the value `f(x)`.  
**Throws**:

- <code>Error</code> When the bounds are equal or do not bracket `bx`.


| Param | Type | Description |
| --- | --- | --- |
| f | <code>function</code> | The function to minimize. |
| ax | <code>number</code> | Lower bound of the search interval. |
| bx | <code>number</code> | Initial guess within `[ax, cx]`. |
| cx | <code>number</code> | Upper bound of the search interval. |
| tol | <code>number</code> | Convergence tolerance (default `1e-6`). |

<a name="differentialEvolution"></a>

## differentialEvolution(f, x0, opts) ⇒ <code>Object</code>
Differential-evolution minimization over an arbitrary-dimensional
space.

The initial population is drawn uniformly inside `[lb, ub]`. Each
member produces one trial per generation; the trial survives to the
next generation only when its objective is strictly better.

**Kind**: global function  
**Returns**: <code>Object</code> - Best point found and its
  objective value.  

| Param | Type | Description |
| --- | --- | --- |
| f | <code>function</code> | Objective function. |
| x0 | <code>Array.&lt;number&gt;</code> | Initial guess; used only to size the search   space and the lower-bound default (`x0[i]` is ignored otherwise). |
| opts | <code>Object</code> | Algorithm options. |
| [opts.maxIter] | <code>number</code> | Maximum generations (default `500`). |
| [opts.popSize] | <code>number</code> | Population size (default `max(20, 10 *   dim)`). |
| [opts.cr] | <code>number</code> | Crossover probability (default `0.7`). |
| [opts.f] | <code>number</code> | Differential scale factor `F` (default `0.8`). |
| [opts.lb] | <code>Array.&lt;number&gt;</code> | Per-dimension lower bounds (default   `-5` for every dimension). |
| [opts.ub] | <code>Array.&lt;number&gt;</code> | Per-dimension upper bounds (default   `5` for every dimension). |

<a name="nelderMead"></a>

## nelderMead(f, x0, opts) ⇒ <code>Object</code>
Nelder-Mead minimization over a multidimensional space.

Builds an initial simplex by perturbing each axis of `x0` by `1e-4`
and then iterates the standard reflection / expansion / contraction /
shrink move until either the spread of function values is below `tol`
or `maxIter` iterations have been performed.

**Kind**: global function  
**Returns**: <code>Object</code> - Best point, its
  function value, and the iteration count at termination.  

| Param | Type | Description |
| --- | --- | --- |
| f | <code>function</code> | Objective function. |
| x0 | <code>Array.&lt;number&gt;</code> | Initial guess (length determines dimension). |
| opts | <code>Object</code> | Algorithm options. |
| [opts.maxIter] | <code>number</code> | Maximum iterations (default `1000`). |
| [opts.tol] | <code>number</code> | Convergence tolerance on the spread of `f`   values across the simplex (default `1e-6`). |
| [opts.alpha] | <code>number</code> | Reflection coefficient (default `1.0`). |
| [opts.gamma] | <code>number</code> | Expansion coefficient (default `2.0`). |
| [opts.rho] | <code>number</code> | Contraction coefficient (default `0.5`). |
| [opts.sigma] | <code>number</code> | Shrink coefficient (default `0.5`). |

<a name="safeOptimizer"></a>

## safeOptimizer(opt) ⇒ <code>function</code>
Wraps an optimizer so that any thrown error becomes `NaN` instead of
propagating. The intent is to keep `RKSAVR.estimate` resilient: a bad
iteration should be logged and skipped, not abort the whole batch.

**Kind**: global function  
**Returns**: <code>function</code> - Wrapped optimizer that returns `NaN` on failure.  

| Param | Type | Description |
| --- | --- | --- |
| opt | <code>function</code> | Optimizer function with the standard RK-SAVR   signature `(f, hMin, hMax, [h0]) -> number`. |

<a name="getOptimizerFactory"></a>

## getOptimizerFactory(name) ⇒ <code>function</code> \| <code>undefined</code>
Retrieves an optimizer factory by name.

**Kind**: global function  
**Returns**: <code>function</code> \| <code>undefined</code> - The factory, or `undefined` if the name is
  unknown (in which case `RKSAVR` falls back to `'brent'`).  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | Optimizer identifier. |

<a name="registerOptimizerFactory"></a>

## registerOptimizerFactory(name, factory)
Registers (or overrides) a custom optimizer factory.

Use this to plug a proprietary or experimental optimizer into the
registry without modifying the library source. The factory must
return a function with the standard RK-SAVR signature
`(f, hMin, hMax, [h0]) => number`.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | Optimizer identifier (used in   `RKSAVR({optimizerType: name})`). |
| factory | <code>function</code> | Factory returning the optimizer   function. |

<a name="simulatedAnnealing"></a>

## simulatedAnnealing(f, x0, opts) ⇒ <code>Object</code>
Simulated-annealing minimization over an arbitrary-dimensional space.

The neighbor for each iteration is generated by perturbing every
coordinate by a uniform offset in `[-stepSize, stepSize]`. The
acceptance temperature decays geometrically: `temp *= coolingRate`. The
loop terminates once either `maxIter` iterations are performed or the
temperature drops below `finalTemp`.

**Kind**: global function  
**Returns**: <code>Object</code> - The best point found and its
  function value.  

| Param | Type | Description |
| --- | --- | --- |
| f | <code>function</code> | Objective function. |
| x0 | <code>Array.&lt;number&gt;</code> | Initial guess. |
| opts | <code>Object</code> | Algorithm options. |
| [opts.maxIter] | <code>number</code> | Maximum iterations (default `5000`). |
| [opts.initialTemp] | <code>number</code> | Initial temperature (default `100`). |
| [opts.finalTemp] | <code>number</code> | Temperature cut-off (default `0.001`). |
| [opts.coolingRate] | <code>number</code> | Per-iteration multiplier (default   `0.995`). |
| [opts.stepSize] | <code>number</code> | Half-width of the uniform proposal   distribution (default `0.1`). |

<a name="setSeed"></a>

## setSeed(seed)
Sets a global seed for reproducible simulations.

Passing `null` or `undefined` clears the seed and reverts to
`Math.random()`. Calling `setSeed` twice restarts the deterministic
sequence from scratch.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| seed | <code>number</code> \| <code>null</code> \| <code>undefined</code> | Integer seed (coerced to 32-bit).   `null`/`undefined` clears the seed. |

<a name="resetSeed"></a>

## resetSeed()
Resets the PRNG to use `Math.random()` for all subsequent draws.

Equivalent to `setSeed(null)`. Use this at the end of a deterministic
experiment to restore nondeterministic behavior.

**Kind**: global function  
<a name="random"></a>

## random() ⇒ <code>number</code>
Returns a uniform random number in `[0, 1)`.

Uses the seeded generator when one has been installed via `setSeed`,
otherwise falls through to `Math.random()`. Because this dispatcher is
called from every stochastic primitive in the library, the *entire*
computation tree is reproducible from a single seed.

**Kind**: global function  
**Returns**: <code>number</code> - A pseudo-random number in `[0, 1)`.  
<a name="randn"></a>

## randn() ⇒ <code>number</code>
Draws a single standard normal via Box-Muller.

The polar variant is implemented by guarding against degenerate
`u === 0` draws from `random()`. One Box-Muller pair yields two
independent standard normals; this routine keeps the cosine component
and discards the sine. Use [correlatedGaussian](#correlatedGaussian) if you need both
halves, or call `randn` twice with distinct `random()` outputs.

**Kind**: global function  
**Returns**: <code>number</code> - A standard normal random variable.  
<a name="randnBatch"></a>

## randnBatch(n) ⇒ <code>Float64Array</code>
Pre-allocates a `Float64Array` of standard normals.

Useful when an inner loop needs a contiguous buffer of normals; the
allocation is amortized across a single batch draw, whereas repeated
[randn](#randn) calls would each allocate internally.

**Kind**: global function  
**Returns**: <code>Float64Array</code> - Buffer of `n` independent standard normals.  

| Param | Type | Description |
| --- | --- | --- |
| n | <code>number</code> | Number of samples (`n >= 0`). |

<a name="correlatedGaussian"></a>

## correlatedGaussian(n, rho) ⇒ <code>Array.&lt;Float64Array&gt;</code>
Generates two correlated standard-normal streams via Cholesky.

Mathematically the model is `(Z1, Z2)` with unit marginals and
`Corr(Z1, Z2) = rho`. Implementation: draw an i.i.d. Box-Muller pair
`(z1, z2)`; set `Z1 = z1`; set `Z2 = rho * z1 + sqrt(1 - rho^2) * z2`.
Both `Z1` and `Z2` have unit variance and exactly correlation `rho`.

Important: `rho` must be **strictly** in `(-1, 1)`; the implementation
silently clamps `1 - rho^2` to zero via `Math.max(0, ...)` so the
endpoints collapse to the trivial deterministic case.

**Kind**: global function  
**Returns**: <code>Array.&lt;Float64Array&gt;</code> - `[Z1, Z2]` of length `n`.  

| Param | Type | Description |
| --- | --- | --- |
| n | <code>number</code> | Number of samples. |
| rho | <code>number</code> | Target correlation in `(-1, 1)`. |

<a name="generateFGN"></a>

## generateFGN(n, H) ⇒ <code>Float64Array</code>
Fractional Gaussian Noise via Hosking's method.

Hosking's method is an exact `O(n^2)` Cholesky-style recursion that
generates samples from the autocovariance
    `gamma(k) = 0.5 (|k+1|^{2H} - 2|k|^{2H} + |k-1|^{2H})`.

It uses `O(n)` recursion updates to compute the conditional mean and
variance `(phi, v)` incrementally, so the per-step cost is `O(k)` and
the total `O(n^2)`. This is fine for the scales used in the paper
(a few hundred to a few thousand samples) but dominates for `n >> 1e4`.

Assumptions:
- `n > 0` and `H in (0, 1)`.
- The result is mean-zero (the recursion conditions on `x_0 ~ N(0, 1)`).

**Kind**: global function  
**Returns**: <code>Float64Array</code> - A contiguous fGN sample of length `n`.  
**Throws**:

- <code>Error</code> When `n` is not a positive finite integer or `H` is out of range.


| Param | Type | Description |
| --- | --- | --- |
| n | <code>number</code> | Length of the desired sample. |
| H | <code>number</code> | Hurst parameter; must satisfy `0 < H < 1`. |

<a name="generateFBM"></a>

## generateFBM(n, H) ⇒ <code>Float64Array</code>
Fractional Brownian Motion by cumulative summation of fGN.

The implementation delegates the heavy lifting to [generateFGN](#generateFGN)
and then performs a single `O(n)` cumulative-sum pass. The first sample
is fixed at 0 (the standard convention for `fBM(0) = 0`), so paths
always start at the origin.

For non-zero means, simply add a constant afterwards — `fGn` is
mean-zero by construction.

**Kind**: global function  
**Returns**: <code>Float64Array</code> - fBm path of length `n` (`Float64Array(0)` when `n <= 0`).  
**Throws**:

- <code>Error</code> When `H` is out of range (propagated from `generateFGN`).


| Param | Type | Description |
| --- | --- | --- |
| n | <code>number</code> | Length of the path. |
| H | <code>number</code> | Hurst parameter; must satisfy `0 < H < 1`. |

<a name="fractionalKernel"></a>

## fractionalKernel(H, nSteps, dt) ⇒ <code>Float64Array</code>
Precomputes the Riemann-Liouville fractional kernel used by the
rough-volatility simulators.

Mathematically `K(t) = sqrt(2 H) * t^{H - 0.5}` for `t > 0`. The result is
a length-`nSteps` array where entry `i` corresponds to `t = (i + 1) * dt`.

Reusing a precomputed kernel for every path avoids the O(n^2) cost of
re-evaluating the power function per integration step.

**Kind**: global function  
**Returns**: <code>Float64Array</code> - Kernel values of length `nSteps`.  

| Param | Type | Description |
| --- | --- | --- |
| H | <code>number</code> | Hurst parameter. |
| nSteps | <code>number</code> | Number of time steps covered by the kernel. |
| dt | <code>number</code> | Per-step time increment. |

<a name="fractionalIntegral"></a>

## fractionalIntegral(dW, kernel, t) ⇒ <code>number</code>
Computes a single time-step of the Riemann-Liouville fractional integral.

Given precomputed Brownian increments `dW` and a kernel from
[fractionalKernel](#fractionalKernel), returns
    `I_t = sum_{j=0}^{t-1} K(t - j) * dW_j`.

Used inside the rBergomi path generator and the exact `fOU` driver.

Complexity: `O(t)` per call, so building a full path is `O(n^2)`. This
is acceptable for paths up to a few hundred steps; for long simulations
switch to a circulant-embedding FFT approximation (not implemented here).

**Kind**: global function  
**Returns**: <code>number</code> - Fractional integral value at time `t`.  

| Param | Type | Description |
| --- | --- | --- |
| dW | <code>Float64Array</code> | Brownian increments. |
| kernel | <code>Float64Array</code> | Precomputed kernel of length `>= t`. |
| t | <code>number</code> | Current time index (exclusive upper bound). |

<a name="defaultSampler"></a>

## defaultSampler(data, n) ⇒ <code>Array.&lt;\*&gt;</code>
Default sampler used when the caller does not provide one. It is just a
thin wrapper around `randomSample` (Floyd's reservoir sampling) so the
variance-reduction iterations get IID draws of increments without
replacement.

**Kind**: global function  
**Returns**: <code>Array.&lt;\*&gt;</code> - Random sample of `n` elements from `data`.  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>Array.&lt;\*&gt;</code> | Source data (typically an increment array). |
| n | <code>number</code> | Sample size to draw. |

<a name="vectorizedKsObjective"></a>

## vectorizedKsObjective(sortedSamples, scales, H) ⇒ <code>number</code>
Builds a vectorized KS objective function for multi-scale estimation.

For `K > 2` scales the mean KS distance across every unordered scale pair
is what gets minimized over `H` (this is the statistic the RK-SAVR paper
argues for). The implementation assumes the samples have already been
sorted (sorting dominates the inner loop cost in practice and is hoisted
to the caller).

**Kind**: global function  
**Returns**: <code>number</code> - Arithmetic mean of the KS distances over all scale pairs.  

| Param | Type | Description |
| --- | --- | --- |
| sortedSamples | <code>Array.&lt;Float64Array&gt;</code> | Pre-sorted samples at different scales. |
| scales | <code>Array.&lt;number&gt;</code> | Scale values corresponding to `sortedSamples`. |
| H | <code>number</code> | Trial Hurst parameter for the objective evaluation. |

<a name="computeScalePairDistance"></a>

## computeScalePairDistance(sortedSamples, scales, i, j, H) ⇒ <code>number</code>
KS distance between a single rescaled pair of samples.

Rescales `sortedSamples[i]` by `scales[i]^{-H}` and `sortedSamples[j]` by
`scales[j]^{-H}` and walks the two empirical CDFs in lock-step via
`ksDistanceRescaled`. Multiplication by a positive scalar preserves the
ordering, so the inputs are *not* re-sorted here.

**Kind**: global function  
**Returns**: <code>number</code> - KS distance between the two rescaled samples in `[0, 1]`.  

| Param | Type | Description |
| --- | --- | --- |
| sortedSamples | <code>Array.&lt;Float64Array&gt;</code> | Pre-sorted samples (per scale). |
| scales | <code>Array.&lt;number&gt;</code> | Scale values corresponding to `sortedSamples`. |
| i | <code>number</code> | Index of the first sample. |
| j | <code>number</code> | Index of the second sample. |
| H | <code>number</code> | Trial Hurst parameter. |

<a name="buildScaleProfile"></a>

## buildScaleProfile(sortedSamples, scales, H) ⇒ <code>Array.&lt;number&gt;</code>
Builds a flat "profile" of all pairwise KS distances at a fixed `H`.

Given `K` sorted samples, the profile has `K * (K - 1) / 2` entries
corresponding to every unordered scale pair. It is useful for diagnostics
(e.g. plotting the KS distance surface) and is exposed via
`rollingMultiScale`.

**Kind**: global function  
**Returns**: <code>Array.&lt;number&gt;</code> - Flat array of pairwise KS distances.  

| Param | Type | Description |
| --- | --- | --- |
| sortedSamples | <code>Array.&lt;Float64Array&gt;</code> | Pre-sorted samples (per scale). |
| scales | <code>Array.&lt;number&gt;</code> | Scale values corresponding to `sortedSamples`. |
| H | <code>number</code> | Hurst parameter at which to evaluate the profile. |

<a name="weightedKsObjective"></a>

## weightedKsObjective(sortedSamples, scales, weights, H) ⇒ <code>number</code>
Weighted generalization of [vectorizedKsObjective](#vectorizedKsObjective).

Allows callers to up-weight finer scales (which are noisier but more
numerous) or down-weight scales that are highly contaminated by
microstructure effects. The objective computes a weighted arithmetic mean
where each pair's KS distance is weighted by `weights[i] * weights[j]`.
The result is normalized so the weights do not change the effective
magnitude of the objective (only the relative emphasis).

**Kind**: global function  
**Returns**: <code>number</code> - Normalized weighted KS distance in `[0, 1]`.  

| Param | Type | Description |
| --- | --- | --- |
| sortedSamples | <code>Array.&lt;Float64Array&gt;</code> | Pre-sorted samples. |
| scales | <code>Array.&lt;number&gt;</code> | Scale values. |
| weights | <code>Array.&lt;number&gt;</code> | Per-scale weights (positive numbers). |
| H | <code>number</code> | Trial Hurst parameter. |

<a name="ksDistance"></a>

## ksDistance(sample1, sample2, isSorted) ⇒ <code>number</code>
Computes the two-sample Kolmogorov-Smirnov distance.

Algorithm: a linear merged-pointer walk over the sorted order statistics.
As we walk through the sorted union we maintain the empirical CDF values
`F_n(x) = (i + 1) / n` and `G_m(x) = j / m` at the current position and
record the absolute difference. Sorting first dominates the cost; the
walk itself is `O(n + m)` where `n = sample1.length` and
`m = sample2.length`.

Input validation:
- Both samples must be non-empty arrays or `Float64Array`s.
- All values must be finite (no `NaN`, `+Infinity`, `-Infinity`).

Ties: when values are equal the walk advances both pointers and uses
`(i + 1) / n` vs. `(j + 1) / m` for the distance — this matches the
standard two-sided statistic.

**Kind**: global function  
**Returns**: <code>number</code> - KS distance `sup_x |F_n(x) - G_m(x)|` in `[0, 1]`.  
**Throws**:

- <code>Error</code> When either input is not an array/typed array, is empty,
  or contains non-finite values.


| Param | Type | Description |
| --- | --- | --- |
| sample1 | <code>Array.&lt;number&gt;</code> \| <code>Float64Array</code> | First empirical sample. |
| sample2 | <code>Array.&lt;number&gt;</code> \| <code>Float64Array</code> | Second empirical sample. |
| isSorted | <code>boolean</code> | If `true`, skip sorting both samples. Off by   default; setting this to `true` is the user's responsibility and is   the hot path used inside `rkSAVR`'s prepared-samples loop. |

<a name="ksDistanceRescaled"></a>

## ksDistanceRescaled(sortedA, sortedB, factorA, factorB) ⇒ <code>number</code>
Kolmogorov-Smirnov distance for **already sorted** samples that need
rescaling.

Equivalent to `ksDistance(a, b, true)` but applies the rescaling factors
during the merged-pointer walk so no auxiliary allocation is needed.
Multiplication by a positive scalar is order-preserving, so the
pre-sorting of the inputs is unaffected by the choice of `factorA` and
`factorB`.

This is the hot path of the RK-SAVR estimator's inner loop:
`O(n + m)` per evaluation, no allocations beyond the locals below.

**Kind**: global function  
**Returns**: <code>number</code> - KS distance between the rescaled samples in `[0, 1]`.  
**Throws**:

- <code>Error</code> When either input is not an array/typed array or is empty.


| Param | Type | Description |
| --- | --- | --- |
| sortedA | <code>Array.&lt;number&gt;</code> \| <code>Float64Array</code> | Pre-sorted sample A. |
| sortedB | <code>Array.&lt;number&gt;</code> \| <code>Float64Array</code> | Pre-sorted sample B. |
| factorA | <code>number</code> | Positive rescaling factor for A (typically   `a^{-H}`). |
| factorB | <code>number</code> | Positive rescaling factor for B. |

<a name="shuffle"></a>

## shuffle(array) ⇒ <code>Array.&lt;\*&gt;</code>
Unbiased Fisher-Yates shuffle.

Returns a new array; the input is never mutated. Uses the seeded PRNG
exposed by `prng.js`, so the result is reproducible when a seed is set.

Complexity: `O(n)` time, `O(n)` extra memory.

**Kind**: global function  
**Returns**: <code>Array.&lt;\*&gt;</code> - Shuffled copy of `array`.  

| Param | Type | Description |
| --- | --- | --- |
| array | <code>Array.&lt;\*&gt;</code> | Input array (not modified). |

<a name="blockPermutation"></a>

## blockPermutation(data, blockSize, randomPhase) ⇒ <code>Array.&lt;\*&gt;</code>
Block random permutation for decorrelating serial dependence.

Conceptually this is the paper's "preserves marginals, kills short-range
autocorrelation" operation:

1. (Optional) shift the starting index by a uniform `[-0, blockSize)`
   offset so two calls with the same seed still produce different
   alignments.
2. Slice the resulting series into blocks of length `blockSize` (the
   first block may be shorter than `blockSize` when a phase offset was
   applied).
3. Apply a Fisher-Yates shuffle to the block list.
4. Concatenate the shuffled blocks back into a single sequence.

Picking `blockSize` is the user's responsibility: it should be larger than
the dominant autocorrelation length in `data`. Too small and serial
dependence survives; too large and the number of blocks — and therefore
the effective randomization — shrinks.

**Kind**: global function  
**Returns**: <code>Array.&lt;\*&gt;</code> - Permuted array containing exactly the same elements as
  `data`.  
**Throws**:

- <code>Error</code> When `data` is not array-like or `blockSize` is out of range.


| Param | Type | Description |
| --- | --- | --- |
| data | <code>Array.&lt;\*&gt;</code> | Input array (not modified). |
| blockSize | <code>number</code> | Block length; must satisfy `0 < blockSize <= data.length`. |
| randomPhase | <code>boolean</code> | Whether to apply a random starting phase   offset. |

<a name="randomSample"></a>

## randomSample(array, n) ⇒ <code>Array.&lt;\*&gt;</code>
Floyd's Algorithm R reservoir sampler.

Streams over the input producing a uniformly random sample of size `n`
**without replacement**. Equivalent to `shuffle(array).slice(0, n)` but
uses only `O(n)` auxiliary memory and a single pass through `array`,
which matters when sampling from very large arrays (e.g. millions of
increments).

Edge cases:
- `n >= array.length`: returns a shuffled full copy of `array`.
- `n <= 0`: returns an empty array.

**Kind**: global function  
**Returns**: <code>Array.&lt;\*&gt;</code> - Random sample of size `min(n, array.length)`.  

| Param | Type | Description |
| --- | --- | --- |
| array | <code>Array.&lt;\*&gt;</code> | Input array. |
| n | <code>number</code> | Number of elements to sample. |

