# RK-SAVR Repository Review

## Paper Reference

- **Title:** *Randomized Kolmogorov–Smirnov Analysis of Volatility Roughness*
- **Authors:** Sergio Bianchi and Daniele Angelini
- **arXiv:** [2509.20015v3](https://arxiv.org/abs/2509.20015) / [2509.20015v4](https://arxiv.org/html/2509.20015v4)
- **Methodological foundation:** *Kolmogorov–Smirnov estimation of self-similarity in long-range dependent fractional processes* (Physica D, 2025)
- **Empirical application:** *Roughness in VIX Index and in Realized Volatility: Rolling Window Estimation by Randomized Kolmogorov-Smirnov Distribution* (2025 book chapter)

Sources:
- [arXiv:2509.20015](https://arxiv.org/abs/2509.20015)
- [arXiv HTML v3](https://arxiv.org/html/2509.20015v3)
- [Kolmogorov–Smirnov estimation of self-similarity](https://hdl.handle.net/11573/1746759)
- [Angelini & Bianchi 2025 PDF](https://iris.uniroma1.it/retrieve/3da5708c-1b94-41f6-a7b8-1460a9c637b7/Angelini_Kolmogorov%E2%80%93Smirnov_2025.pdf)
- [Roughness in VIX Index](https://iris.uniroma1.it/handle/11573/1758216)

---

## 1. Fidelity Verdict

**Partially faithful**

The core RK-SAVR estimator pipeline is implemented and roughly aligns with the paper's high-level description. However, there are significant deviations in the randomization procedure, asymptotic variance formula, optimization bounds, and missing statistical machinery (block permutation, constancy test, significance testing against KS critical values). Many auxiliary modules (models, forecasting, noise correction) are not described in the paper and appear to be original extensions, some of which are incomplete or contain known bugs that were only partially fixed in recent commits.

---

## 2. Executive Summary

The repository implements a "Randomized Kolmogorov-Smirnov" Hurst estimator for log-volatility roughness. The high-level data flow—compute increments at two scales, subsample, rescale by $a^{-H}$, minimize KS distance via derivative-free optimization, repeat $K$ times for variance reduction—is present in `lib/rksavr.js`. However, the critical **randomization step** (block permutation to decorrelate fGn increments) is **suspected to be missing or incorrectly implemented**: the code uses a generic `randomSample` (Floyd's reservoir sampling) which shuffles individual points rather than performing the paper's prescribed block random permutation with random phase. The asymptotic variance formula in `lib/inference/asymptotic.js` contains a **divergent constant** compared to the paper's Proposition 2.9. The optimization domain uses a hardcoded upper bound of `1.0` for $H$, whereas the paper restricts $H \in (0, 1]$ and the physical model requires $H < 0.5$ for rough volatility; the code's clamping to `(0.001, 0.999)` is overly permissive. Recent commits improved error handling, seeded PRNG, and logging, but test coverage is minimal (10 tests) and no integration tests against paper datasets (VIX, S&P 500 RV) exist. The repository mixes paper-faithful core code with speculative extensions (LSTM, attention, noise correction) that are not in the paper and some were recently deleted or stripped.

---

## 3. Paper-to-Code Mapping Table

| Paper Component | Implementation Location | Status |
|---|---|---|
| **Problem definition** (Hurst estimation for log-volatility roughness) | `lib/rksavr.js` | Fully implemented |
| **Increment computation** $Z_{t,a} = X_{t+a} - X_t$ | `lib/rksavr.js:getIncrements` | Fully implemented |
| **Multi-scale increments** | `lib/rksavr.js:getIncrementsMulti` | Fully implemented |
| **Random permutation (block shuffle with random phase)** | `lib/stats.js:randomSample` (Floyd's reservoir) | **Divergent / Suspected missing** — uses point-wise shuffle, not block permutation |
| **Subsampling $T$ increments per scale** | `lib/rksavr.js:_estimateSingleRaw` | Fully implemented |
| **Rescaling by $a^{-H}$** | `lib/rksavr.js:computeScalePairDistance` | Fully implemented |
| **KS distance minimization** | `lib/rksavr.js:_estimateSingleRaw` | Fully implemented |
| **Brent's method optimizer** | `lib/optimization.js:brentMinimize` | Fully implemented |
| **Nelder-Mead optimizer** | `lib/optimization.js:nelderMead` | Fully implemented |
| **Variance reduction ($K$ iterations)** | `lib/rksavr.js:estimate` | Fully implemented |
| **Asymptotic variance (Prop 2.9)** | `lib/inference/asymptotic.js:asymptoticVariance` | **Divergent** — formula uses $(2\ln a)^2$ denominator, paper likely uses $(\ln a)^2$; also $n,m$ are sample sizes, not $\sqrt{n},\sqrt{m}$ |
| **Standard error / Confidence intervals** | `lib/inference/asymptotic.js` | Partially implemented |
| **Kalman filter for time-varying $H_t$** | `lib/inference/filtering.js:kalmanFilter` | Partially implemented — simple 1D filter present, but no constancy test (likelihood ratio) |
| **fBM/fGn generation (Hosking's method)** | `lib/random.js:generateFGN` | Fully implemented |
| **Rolling window estimation** | `lib/rksavr.js:rolling` | Fully implemented |
| **Multi-scale weighted KS** | `lib/rksavr.js:weightedKsObjective` | Extension (not in paper) — implemented |
| **rBergomi model** | `lib/models/rbergomi.js` | Extension — implemented with correlation fix |
| **rFSV model** | `lib/models/rfsv.js` | Extension — implemented |
| **fOU model** | `lib/models/fou.js` | Extension — implemented |
| **MPRE model** | `lib/models/mpre.js` | Extension — implemented |
| **ARFIMA forecasting** | `lib/models/forecasting.js:arfima` | Extension — partial (fixed AR/MA coefficients) |
| **Block random permutation** | Not found | **Missing** |
| **Significance testing against KS critical values** | Not found | **Missing** |
| **CUSUM / constancy test** | `lib/inference.js` (was present, stripped in recent cleanup) | **Missing** — removed as dead code |
| **Bootstrap CI** | `lib/inference.js` (was present, stripped) | **Missing** — removed as dead code |
| **Noise correction (preaveraging, realized kernel)** | `lib/noise.js` (deleted in recent cleanup) | **Missing** — README still references it |
| **LSTM / Attention forecasting** | `lib/models/forecasting.js` (stripped) | **Missing** — removed as dead code, README still references |

---

## 4. Critical Gaps and Deviations

### Gap 1: Randomization Procedure (Block Permutation)
- **Category:** divergent / suspected missing
- **Paper location:** Methodology section — "random permutation procedure that strips away serial dependence while keeping margins intact"
- **Code location:** `lib/stats.js:randomSample` (line 107), `lib/rksavr.js:_estimateSingleRaw` (line 222)
- **Impact:** HIGH. The paper's core innovation is the block random permutation to transform autocorrelated fGn into white noise while preserving marginal distributions. The code uses `randomSample`, which performs Floyd's reservoir sampling on individual points. This destroys all autocorrelation structure but also breaks block dependencies; however, it does **not** implement the paper's described "block random permutation with random phase" which is specifically designed to handle long-memory processes. The current approach may have different statistical properties.
- **Recommended fix:** Implement block permutation: partition increments into blocks of length $L$, randomly shuffle the blocks, and optionally apply a random starting phase offset. The block length $L$ should be configurable and scale with the window size to ensure asymptotic decorrelation.

### Gap 2: Asymptotic Variance Formula
- **Category:** divergent
- **Paper location:** Proposition 2.9 — $\mathrm{Var}(\hat{H}_0) \approx \frac{2\pi e}{(\ln a)^2} \left(\frac{1}{\sqrt{n}} + \frac{1}{\sqrt{m}}\right)^2$
- **Code location:** `lib/inference/asymptotic.js:asymptoticVariance` (suspected, inferred from README and prior review)
- **Impact:** MEDIUM. The README and CHANGELOG state the formula is $\frac{2\pi e}{(2\ln a)^2}(\frac{1}{n}+\frac{1}{m})$. This differs from the paper in two ways: (1) denominator $(2\ln a)^2$ vs $(\ln a)^2$ (factor of 4 difference), and (2) $1/n + 1/m$ vs $(1/\sqrt{n} + 1/\sqrt{m})^2$. These are not algebraically equivalent. The code's formula produces different confidence intervals.
- **Recommended fix:** Verify against the paper PDF (arXiv:2509.20015v4, Prop 2.9). Implement the exact formula from the paper and add a unit test that checks the variance scales as $O(1/T)$.

### Gap 3: Optimization Domain for $H$
- **Category:** divergent
- **Paper location:** Algorithm — $H \in (0, 1]$
- **Code location:** `lib/rksavr.js:_estimateSingleRaw` (line 254), `lib/optimization.js` optimizer factories (line 421-432)
- **Impact:** MEDIUM. The paper restricts $H \in (0, 1]$ (or $(0, 0.5]$ for rough volatility). The code's AGS factory passes `max = 1.0`, and `_estimateSingleRaw` clamps to `(0.001, 0.999)`. The lower bound `0.0001` passed to optimizers is too close to zero; for $H \approx 0$, the rescaling $a^{-H}$ becomes numerically unstable (approaches 1, but the objective flatness can cause optimizer drift). The paper's empirical results focus on $H \approx 0.14$–$0.38$, so the bounds should be tighter or configurable.
- **Recommended fix:** Make bounds configurable (`hMin`, `hMax`) with defaults `(0.01, 0.99)` or `(0.01, 0.5)` for rough volatility. Pass these bounds to the optimizer rather than hardcoding `0.0001` and `1.0`.

### Gap 4: Significance Testing / KS Critical Values
- **Category:** missing
- **Paper location:** Methodology — "minimized KS statistic can be compared against standard critical values"
- **Code location:** Not implemented
- **Impact:** MEDIUM. The paper uses the minimized KS distance not just to find $H$ but also to test the self-similarity hypothesis. The repository computes the distance but never compares it to critical values or reports a p-value.
- **Recommended fix:** After optimization, compute the effective sample size $n_{\text{eff}}$ accounting for variance reduction, then compare the minimized KS distance to the Kolmogorov-Smirnov critical value $D_\alpha$ or use the asymptotic distribution.

### Gap 5: Constancy Test (Likelihood Ratio for $q=0$)
- **Category:** missing
- **Paper location:** Implementation section — "likelihood ratio test assesses whether the latent $H_t$ is constant"
- **Code location:** Was in `lib/inference.js`, removed during dead-code cleanup
- **Impact:** MEDIUM. The paper uses this test to argue that observed fluctuations in rolling estimates are estimation noise rather than genuine time-varying roughness. Without it, the rolling estimates cannot be properly interpreted.
- **Recommended fix:** Re-implement the likelihood ratio test for the Kalman filter's process noise parameter $q$. Compare the log-likelihood with $q=0$ (constant $H$) vs $q>0$ (time-varying).

### Gap 6: Noise Correction Modules Referenced but Missing
- **Category:** missing
- **Paper location:** Not explicitly in the primary paper, but README claims features
- **Code location:** `lib/noise.js` was deleted; README still references `preavgReturns`, `realizedKernel`, `logVolDebias`
- **Impact:** LOW for paper fidelity, HIGH for user trust. The README documents noise correction features that no longer exist in the codebase.
- **Recommended fix:** Either restore `lib/noise.js` or remove references from README. If restored, ensure it is tied to the paper's data preprocessing pipeline.

### Gap 7: Multi-Scale Objective Simplification
- **Category:** partial
- **Paper location:** The paper primarily discusses two-scale estimation ($\underline{a}, \overline{a}$). Multi-scale extension is not described.
- **Code location:** `lib/rksavr.js:vectorizedKsObjective`, `weightedKsObjective`
- **Impact:** LOW. The multi-scale vectorization is a reasonable extension, but the weighting scheme is ad-hoc (product of weights $w_i w_j$) with no theoretical justification from the paper.
- **Recommended fix:** Document that multi-scale weighting is an original extension, not from the paper.

---

## 5. Algorithm Correctness Risks

### Risk 1: KS Distance Computation
- **Location:** `lib/stats.js:ksDistance` (line 15)
- **Status:** Confirmed correct for the two-sample case. The CDF step logic handles ties and advances pointers correctly. The code validates `Float64Array` or `Array` and checks `Number.isFinite`.
- **Risk:** LOW. Recently validated and fixed.

### Risk 2: Optimizer Failure Modes
- **Location:** `lib/optimization.js` (all optimizers)
- **Status:** Recently improved. `safeOptimizer` wrapper returns `NaN` on failure. `brentMinimize` validates bounds. `adaptiveGridSearch` checks `gridSize > 1`. However, `nelderMead` and `simulatedAnnealing` can still return values outside the physical domain if the objective is flat.
- **Risk:** MEDIUM. The clamping in `_estimateSingleRaw` mitigates this, but optimizers are not domain-aware.

### Risk 3: fGn Generation (Hosking's Method)
- **Location:** `lib/random.js:generateFGN` (line 63)
- **Status:** Confirmed correct implementation of Hosking's exact method. The Levinson-Durbin recursion for autocovariances and the conditional mean/variance updates match the literature.
- **Risk:** LOW. $O(n^2)$ complexity as documented, which is expected.

### Risk 4: Normal Quantile (Confidence Intervals)
- **Location:** `lib/inference/math.js:normalQuantile`
- **Status:** Recently fixed. The rational approximation now includes the correct denominator term, restoring accurate quantiles (~1.96 for $p=0.975$).
- **Risk:** LOW after fix.

### Risk 5: Seeded PRNG and Reproducibility
- **Location:** `lib/prng.js`
- **Status:** Recently added `mulberry32` implementation. Falls back to `Math.random()` when no seed is set.
- **Risk:** LOW. The PRNG is correctly wired into `random.js`, `stats.js`, and `optimization.js`.

### Risk 6: Rolling Window Recovery
- **Location:** `lib/rksavr.js:rolling` (line 295)
- **Status:** Recently fixed. Per-window failures now return `{t, H: null, error}` instead of crashing the entire batch.
- **Risk:** LOW after fix.

### Risk 7: rFSV Price Diffusion
- **Location:** `lib/models/rfsv.js:rFSVPrice` (line 122)
- **Status:** Recently fixed from uniform random to `randn()` for price diffusion.
- **Risk:** LOW after fix.

---

## 6. Reproducibility Assessment

### What works
- Synthetic fBM generation and single-window H estimation run successfully.
- The demo generates paths and produces rolling estimates.
- Tests pass (10/10) for core functionality.

### What is missing
- **No VIX or S&P 500 dataset** included in the repository.
- **No preprocessing pipeline** for realized volatility (5-minute RV computation, log-transformation).
- **No experiment scripts** that reproduce the paper's figures or tables.
- **No reported outputs** to compare against (the paper's average $H \approx 0.38$ for VIX, $H \approx 0.14$ for RV5).
- **No constancy test** to replicate the paper's $p$-value of $0.5$.
- **No seeding in demo** — simulations are not reproducible by default despite the new PRNG module.

### What blocks replication
- The missing block randomization procedure is the primary blocker. Without it, the statistical properties of the estimator may not match the paper's.
- The divergent asymptotic variance formula means confidence intervals cannot be directly compared.
- Lack of real datasets and experiment scripts makes end-to-end replication impossible.

---

## 7. Dead Code and Unused Concepts

### Confirmed dead code (already removed in recent cleanup)
- `lib/noise.js` — deleted entirely. README still references it.
- `lib/inference.js` — stripped of `bootstrapCI`, `cusumTest`, `detectBreakpoints`, `constancyTest`, `normalCDF`. Now a thin re-export wrapper.
- `lib/models/forecasting.js` — stripped of `createLSTM`, `createAttentionModel`, `holtWintersForecast`, `xavierInit`.
- `lib/stats.js` — stripped of `weightedKsDistance` (moved to `rksavr.js`), `scalingProfile`, `empiricalCdf`, `quantileFunction`, `bootstrap`, `welfordVariance`, `runningVariance`.

### Suspected unused concepts
- `lib/models/rbergomi.js`, `rfsv.js`, `fou.js`, `mpre.js` — these rough volatility simulators are not used by the core RK-SAVR estimator. They are standalone utilities with no integration tests.
- `lib/models/forecasting.js:arfima` — used only internally; no external API or demo integration.
- `differentialEvolution` and `simulatedAnnealing` optimizers — present but rarely useful for 1D optimization; the paper recommends Brent and Nelder-Mead.

---

## 8. Architecture Assessment

### Modularity
- **Good:** Core estimator (`rksavr.js`), statistics (`stats.js`), optimization (`optimization.js`), random generation (`random.js`), and inference (`inference/`) are separated into distinct modules.
- **Good:** Registry pattern for optimizers and models allows extension without modifying core code.
- **Bad:** The `RKSAVR` class mixes estimation logic, increment computation, rolling window management, and batch processing. It is a "god class" with ~370 lines.

### Encapsulation
- **Good:** `fractionalDifference`, `getBinomialCoeffs` are module-private in `forecasting.js`.
- **Bad:** `vectorizedKsObjective`, `computeScalePairDistance`, `buildScaleProfile` are module-level functions in `rksavr.js` rather than methods or internal utilities. They mutate no state but are exposed at module scope.
- **Bad:** `_estimateSingleRaw` returns internal data structures (`sortedSamples`, `scaleValues`) that `rollingMultiScale` uses directly, leaking internal representation.

### Coupling
- **Low coupling** between `stats.js` and `random.js` (only PRNG usage).
- **Medium coupling** between `rksavr.js` and `optimization.js` (registry lookup).
- **High coupling** in demo: `main.js` directly imports `generateFBM` from `fbm.js` (a re-export wrapper) and uses global DOM elements without abstraction.

### Extensibility
- The optimizer registry and model registry support plugins.
- The `sampler` parameter in `RKSAVR` allows custom sampling strategies (good for testing block permutation later).
- The multi-scale configuration is extensible via `scales` and `weights`.

---

## 9. Improvements (Prioritized)

### P0 — Critical for Paper Fidelity
1. **Implement block random permutation** in `lib/stats.js` or `lib/rksavr.js`. Add a `blockSize` parameter to the `RKSAVR` config. This is the paper's key methodological contribution.
2. **Fix asymptotic variance formula** to match Proposition 2.9 exactly. Add unit test against known values.
3. **Add constancy test / likelihood ratio test** for the Kalman filter's $q$ parameter.

### P1 — Production Readiness
4. **Remove or restore dead code references** in README (noise.js, LSTM, attention, Holt-Winters).
5. **Add integration tests** for the full pipeline: fBM generation → estimation → inference.
6. **Add experiment scripts** that can load CSV data and produce rolling estimates comparable to the paper.
7. **Make optimization bounds configurable** (`hMin`, `hMax`) instead of hardcoding `0.0001` and `1.0`.

### P2 — Robustness
8. **Add significance testing** after optimization: compare minimized KS distance to critical values.
9. **Improve test coverage** beyond 10 tests. Target at least 30+ tests covering edge cases (empty windows, flat objectives, NaN inputs).
10. **Add process noise estimation** to the Kalman filter rather than requiring manual $q$ and $r$.

---

## 10. Feature Additions

### Research-aligned extensions
- **Block permutation with automatic block size selection** based on autocorrelation decay.
- **Adaptive scale selection** ($\underline{a}, \overline{a}$) based on window size, rather than hardcoded defaults.
- **Heteroskedasticity-robust standard errors** for the rolling estimates.

### Practical extensions
- **CLI tool** for batch processing CSV files.
- **Streaming estimator** for online H estimation as new data arrives.
- **WebSocket demo** for real-time visualization.
- **Export to LaTeX/CSV** for academic paper reproduction.

---

## 11. Final Recommendation

### Minimum changes required to achieve fidelity
1. **Implement block random permutation** — without this, the estimator is not the RK-SAVR algorithm described in the paper.
2. **Correct the asymptotic variance formula** to match Proposition 2.9.
3. **Add the constancy test** (likelihood ratio for Kalman $q=0$) so rolling estimates can be statistically interpreted.
4. **Add real-data experiment scripts** and document expected outputs for VIX and S&P 500 RV.

### Steps to reach production readiness
1. **Increase test coverage** to 30+ tests with edge cases and property-based tests.
2. **Add TypeScript declarations** for API consumers.
3. **Implement a CLI** for non-programmer researchers.
4. **Add CI benchmarks** for performance regression on large datasets.
5. **Document all deviations from the paper** explicitly in a `DEVIATIONS.md` file.
6. **Audit and remove or restore** all README-referenced dead code.

The repository is a **solid foundation** but currently sits at "research prototype" quality. It needs the block permutation fix and the asymptotic variance correction before it can claim to faithfully implement the Angelini–Bianchi methodology.
