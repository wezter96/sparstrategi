# Jämförelsemotor med mallar — web-simple som strategijämförare

**Date:** 2026-07-17
**Status:** Approved direction ("kör på med mallidén"), spec pending user review
**Scope:** `apps/web-simple` (GitHub Pages SPA) + new pure module in `packages/engine`

## Purpose

Turn the standalone GitHub Pages app from a single-scenario tool (Belånad Kapitalmotor) into a savings-strategy comparison site for a broad audience. Core insight: every requested comparison (fund fees, growth vs dividend stocks, ISK vs AF vs KF, rebalancing/courtage costs, lump sum vs DCA) is the same computation — two or more strategies with identical deposits, simulated year by year, drawn side by side. Build one general comparison engine; each **template** ("mall") is just prefilled parameters plus pedagogical copy explaining *why* the difference arises. The existing Kapitalmotor stays as its own advanced tool.

## Architecture

Two units:

### 1. `packages/engine/src/comparison.ts` — pure comparison engine

Pure TS, no Effect runtime, same conventions as the other engine modules (SEK as `number`, rates as decimal fractions, deterministic).

**Shared assumptions (`ComparisonAssumptions`):**
- `startCapital` (kr), `monthlySavings` (kr/month), `horizonYears` (1–50)
- `taxParams` (reuse existing `TaxParams` — SLR, schablon rate, ISK free floor)

**Per-strategy input (`StrategyInput`):**
- `name` (display label)
- Return split: `priceGrowth` + `dividendYield` (annual; total return = sum). This is what makes growth-vs-dividend comparable at equal total return.
- `fundFeeRate` (annual % of capital, deducted continuously — modeled as deducted from the year's return)
- `accountType`: `"isk" | "af" | "kf"`
- `reinvestDividends`: boolean (if false, dividends are paid out and tracked as cumulative cash received, not compounded)
- `foreignWithholdingRate` (default 0): withheld on dividends; KF reclaims fully, ISK reclaims via avräkning (simplified: fully reclaimed, capped at schablonskatt for the year), AF credits against the 30 % dividend tax
- Transaction costs:
  - `holdingsCount` (number of positions the monthly deposit is split across)
  - `courtagePerTrade` (kr, with `courtageMinKr` semantics folded in: it IS the min/flat courtage) and `courtageRate` (% of trade, whichever is larger applies)
  - `fxFeeRate` (% on foreign trades; applied to buys and, when rebalancing, sells — 0 for Swedish funds/stocks)
  - `rebalancesPerYear` × `turnoverShare` (fraction of portfolio sold+rebought per rebalancing event)
  - `spreadRate` (% cost on traded volume)

**Yearly loop (per strategy):**
1. Deposits: 12 monthly buys; each buy across `holdingsCount` positions pays `max(courtagePerTrade, courtageRate × amount)` + fx fee per position. Deposits added mid-year approximation (half-year growth), consistent with how `monthlySavings` is treated elsewhere in the engine.
2. Return: capital grows by `priceGrowth − fundFeeRate`; dividends = `dividendYield × capital`, taxed per account type, then reinvested or paid out.
3. Account tax:
   - **ISK/KF**: schablonskatt via existing `iskTax` (ISK free floor applies to ISK only, not KF). Dividends themselves untaxed (withholding handled per above).
   - **AF**: dividends taxed 30 % on receipt. Rebalancing realizes gains: realized gain ≈ `turnoverShare × unrealized gain`, taxed 30 %, cost basis updated. Latent tax on remaining unrealized gain reported separately and applied in the "efter skatt vid försäljning" final value.
4. Rebalancing costs: `rebalancesPerYear × turnoverShare × capital × (spreadRate + courtageRate + fxFeeRate)` (sell + buy legs).
5. Track cumulative buckets: `paidFees`, `paidTax`, `paidTransactionCosts`, `dividendsReceived` (when not reinvested), plus the counterfactual **frictionless value** (same returns, zero fees/costs/tax) so the UI can show "förlorat till avgifter/skatt" as one number.

**Output (`StrategyResult`):** per-year rows (value, the cumulative buckets) + finals: gross end value, end value after full realization (AF latent tax), and the deltas vs. the frictionless counterfactual.

Top-level: `compareStrategies(assumptions, strategies[]) → StrategyResult[]`. No cross-strategy logic in the engine; differencing happens in the UI.

**Lump sum vs DCA** needs no engine knob beyond letting a strategy override the shared `startCapital`/`monthlySavings`: the upfront strategy puts the full sum in `startCapital` with `monthlySavings = 0`; the DCA strategy uses the shared monthly deposits. **Decision:** strategies may override `startCapital`/`monthlySavings`; only the DCA template uses this, all other templates keep them shared/locked.

### 2. `apps/web-simple` — start page + comparison view

No router dependency today; use **hash-based views** to stay dependency-light: `#/` (start), `#/jamfor` (comparison view), `#/kapitalmotor` (existing tool, unchanged). Legacy share links `?s=...` (no hash) redirect to `#/kapitalmotor` preserving `?s=` — existing shared URLs keep working.

**Start page:** template cards (title + one-sentence question) + a card for Belånad Kapitalmotor ("Avancerat"). Clicking a template opens `#/jamfor` with the template's prefills loaded.

**Comparison view:**
- Shared assumptions bar on top: startkapital, månadssparande, horisont (formatted inputs reused from the existing input panel).
- 2–3 strategy columns with editable per-strategy parameters. Each template specifies which fields are *highlighted* (the ones that differ) — the rest sit in a collapsed "Fler antaganden" section per column. "Lägg till strategi" up to 3.
- Results: line chart (value over time, one series per strategy, Recharts per dataviz conventions already used), KPI row (slutvärde per strategi; skillnad kr and %; "betalt i avgifter", "betalt i skatt", "transaktionskostnader" per strategy), and a compact per-year table behind a toggle.
- **Explainer:** each template carries a short Swedish text ("Varför blir det så här?") rendered under the chart — this is the broad-audience pedagogy.
- Share: serialize `{ templateId, assumptions, strategies }` into `?s=` on the `#/jamfor` hash (same btoa mechanism as today, generalized with a version/kind tag so kapitalmotor and comparison payloads don't collide).

**State:** same pattern as today — one `Atom` for the comparison input, derived atoms running `compareStrategies`. Swedish UI, `fmtKr`/`fmtPct`.

## Templates (v1, prioritized)

1. **Vad kostar fondavgiften?** — indexfond 0,2 % vs aktiv fond 1,5 %, identical gross return. Highlight: `fundFeeRate`. KPI focus: "förlorat till avgifter".
2. **ISK vs AF (vs KF)** — same portfolio, three account types. Highlight: `accountType`. Explainer covers the SLR-driven brytpunkt (AF wins at low return, ISK at high) and the 300 tkr ISK-free floor.
3. **Tillväxtaktier vs utdelningsaktier** — same total return, different priceGrowth/dividendYield split. Prefill on ISK (near-equivalence — deliberate myth-busting) with a note prompting "byt till AF och se skillnaden". Highlight: return split + `reinvestDividends` + `foreignWithholdingRate`.
4. **Ombalansering & courtage** — 1 fond (0 courtage, 0 rebalancing) vs 8 aktier månadssparade (courtage × 12 × 8, yearly rebalancing with turnover, spread; on AF also realized tax). Highlight: transaction-cost block.
5. **Engångsinsättning vs månadssparande** — upfront vs DCA via per-strategy deposit override. Highlight: startkapital/månadssparande. Explainer notes this is deterministic (ingen riskjämförelse — Monte Carlo out of scope).

Templates are data: `{ id, title, question, explainer, assumptions, strategies, highlightedFields }` in a plain TS module in web-simple. The generic view works with any template, and "Egen jämförelse" (blank template) is free.

## Error handling

Engine clamps/flags rather than throws (matching existing modules): negative-value years floor at 0, fee/cost rates validated at UI boundary. No new typed-error machinery needed for a pure client-side calculator.

## Testing (bun:test, in `packages/engine/test/comparison.test.ts`)

- Fee drag against a hand-computed closed-form case (no tax/costs): `(1+g−f)^n` exact.
- Frictionless counterfactual equals the zero-fee strategy run.
- ISK vs AF crossover: at low return AF beats ISK, at high return ISK beats AF, for known parameter sets.
- Dividend equivalence on ISK: 8+0 vs 4+4 split with reinvestment yields equal values (within fp tolerance); on AF the dividend strategy is strictly worse.
- Rebalancing costs accumulate linearly with `rebalancesPerYear`; AF rebalancing pays realized tax and reduces latent tax correspondingly (basis bookkeeping conserves total tax at full realization).
- Courtage: monthly buys across N holdings pay `12 × N × max(flat, rate × slice)` in year one.
- Existing document-reproduction test untouched.

## Out of scope (v1)

Historical backtesting against real index data, Monte Carlo per template (stays only in Kapitalmotor), pension/löneväxling/uttagsplanering, belåning inside the comparison engine (that is Kapitalmotor's domain), the main `apps/web` app (this spec is web-simple only), multi-currency beyond a flat fx fee.
