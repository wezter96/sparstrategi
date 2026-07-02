# Sparstrategi — Interactive Investment Strategy Simulator

**Date:** 2026-07-02
**Status:** Approved design, pending implementation plan
**Source model:** `~/Documents/Belånad Portföljstrategi.html` (leveraged ISK+AF strategy)

## Purpose

Web app for building long-term investment strategies by goal, minimizing Swedish tax. Generalizes the document's leveraged-portfolio model: the ISK account acts as a cashflow engine (returns cover loan interest + living costs), the AF account compounds untouched, ISK schablonskatt is offset by ränteavdrag, and leverage is restored to a target LTV yearly. Users enter their own numbers, see live projections, evaluate goals, and stress-test crashes.

## Stack

Existing better-t-stack scaffold (Bun, Turborepo, TanStack Router web app), with the backend rebuilt on Effect v4 beta:

- `effect@4.0.0-beta.93` — pinned exact. Schema from `effect` root, HttpApi from `effect/unstable/httpapi`, HTTP server from `effect/unstable/http`.
- `@effect/platform-bun@4.0.0-beta.93` — Bun HTTP server runtime.
- `@effect/sql-sqlite-bun@4.0.0-beta.93` — SQLite access + migrations for app tables.
- `@effect/atom-react@4.0.0-beta.93` — frontend state management (Atom from `effect/unstable/reactivity` with React bindings).
- **Removed from scaffold:** tRPC, Hono, Drizzle. Better-Auth stays, configured directly on `bun:sqlite` (no ORM adapter).
- All `effect*` beta packages pinned to the same exact beta version; upgrades are a deliberate single-commit bump.

## Architecture

Three units:

### 1. `packages/engine` — pure TypeScript simulation engine

No Effect runtime dependency in the math itself; input/output types defined with Effect Schema (shared validation client + server). Pure functions, deterministic, runs in the browser for instant slider feedback (<1ms per run).

**Inputs (`ScenarioInput`):**
- `startCapital` (kr), `monthlySavings` (kr/month)
- `targetLtv` (0–0.6), `loanRate` (annual), `expectedReturn` (annual)
- `livingCosts` (kr/month, funded from ISK)
- `horizonYears` (1–50)
- `taxParams` (see below) and `maxLtv` (margin-call threshold, default 0.5)
- `goals`: list of `{ type: "wealth", amount, year }` and `{ type: "passiveIncome", monthlyAmount }`

**Tax parameters (`TaxParams`, editable config with 2026 defaults):**
- `slr` (statslåneränta, default 2.5%) → ISK schablon rate = max(slr + 1.0pp, 1.25%) × 30% (i.e. 1.05% effective at SLR 2.5%)
- `iskFreeAmount` = 300 000 kr (tax-free capital floor, 2026)
- Ränteavdrag brackets: 30% on interest up to 100 000 kr/year, 21% above; `deductionEligible` toggle (secured portfolio loans qualify)
- `afCapitalGainsRate` = 30% (applied only on realization; AF is unrealized in the core loop, reported as latent tax)

**Core algorithm (per scenario):**
1. Total portfolio = startCapital / (1 − targetLtv); loan = portfolio × targetLtv.
2. ISK slice solved so `expectedReturn × isk = loanRate × loan + 12 × livingCosts` (cashflow-engine calibration). Clamp: if required ISK > portfolio, flag scenario as infeasible (returns can't cover costs). AF gets the remainder.
3. Each simulated year: grow both accounts by `expectedReturn`; withdraw ISK gain (interest + living costs) so ISK principal stays flat; add `12 × monthlySavings` to AF; compute ISK schablonskatt on capital above the free floor and the ränteavdrag (skattereduktion) on interest paid; net tax = max(0, iskTax − deduction), with any surplus deduction reported separately as "överskjutande skattereduktion" (usable against other income tax); re-leverage to `targetLtv` (new loan proceeds → AF).
4. Output per year (`YearRow`): portfolio, AF, ISK, loan, LTV, growth, interest, deduction, ISK tax, net tax, effective tax rate, net cashflow, savings added.

**Goal evaluators:**
- Wealth-by-year: hit/miss, hit year, shortfall, required extra monthly savings (solved numerically by bisection on monthlySavings).
- Passive income: required ISK capital = `12 × monthlyAmount / expectedReturn`, compared to actual; year it becomes feasible.

**Stress test:** apply chosen crash (−20/−30/−40%) at chosen year → post-crash LTV, margin-call flag (LTV > maxLtv), forced-deleverage amount, and recovery path back to plan.

**Validation contract:** engine reproduces the source document's numbers (6 000 Mkr portfolio, 20% LTV, 7% growth, 3% loan rate, 457 Mkr ISK, 32 Mkr withdrawal, 0% effective tax) when fed its inputs with simplified tax params. This is the regression test.

### 2. `apps/server` — Effect v4 HttpApi backend

- `HttpApi` definition in a shared location so the web app derives a typed client via `HttpApiClient` (contract-first, replaces tRPC's role).
- Endpoints: `scenarios.list / get / create / update / delete`. Payloads validated with the shared Effect Schema types from `packages/engine`.
- Auth: Better-Auth mounted on its `/api/auth/*` routes; API endpoints gated by an Effect middleware that resolves the Better-Auth session from request headers and provides a `CurrentUser` service; 401 otherwise. Ownership enforced on every scenario query (`userId = session.user.id`).
- Persistence: `@effect/sql-sqlite-bun` on the same `local.db` file Better-Auth uses. App tables via `@effect/sql` migrator (TypeScript migrations); Better-Auth manages its own tables via its CLI.
- Structure: `SqlLive` layer, `ScenarioRepo` service (Effect.Service), `HttpApiBuilder` groups, single `BunHttpServer` entrypoint. CORS as in current scaffold.

**Data model (`scenario` table):**
`id` (uuid pk), `user_id` (fk → Better-Auth user), `name`, `input_json` (full ScenarioInput), `engine_version` (int; scenarios recompute with the current engine, version stamped for change awareness), `created_at`, `updated_at`. Projections are never stored — always recomputed.

### 3. `apps/web` — TanStack Router frontend

Dark theme matching the source document's aesthetic (same palette family). Swedish UI, `sv-SE` number formatting with auto-scaling (kr / tkr / Mkr / Mdr).

**Routes:**
- `/` — simulator. Left panel: inputs (sliders + numeric fields, tax params in a collapsible "Avancerat" section). Right: KPI row (total portfolio, annual growth, effective tax, LTV); allocation doughnut (AF/ISK/loan); year-1 cashflow flow; multi-year projection chart + table; tax breakdown card; stress-test panel; goals section with per-goal pass/fail and "what's needed."
- `/scenarios` — saved scenarios list (auth required); load into simulator; compare view overlaying 2+ scenarios on one growth chart with goal markers.
- Auth routes from scaffold (login/signup).
- Unsaved state lives in the URL search params (shareable) — saving requires login.

**Charts:** Recharts, styled per the dataviz skill. Chart types: doughnut (allocation), bar (cashflow), line with area (projection, per-account series), bar (leverage restoration).

**Live recompute:** engine runs client-side on every input change (debounced ~50ms). Server is persistence only.

**Frontend Effect usage:** state managed with Atom (`@effect/atom-react`): input atoms (synced to URL search params), a derived simulation atom running the engine, and API atoms wrapping the `HttpApiClient` for scenario CRUD (loading/error states as Atom results). Effect Schema validates all form input; no separate state library.

## Error handling

- Engine: infeasible calibration, LTV out of range, and margin-call states are typed results, not exceptions — UI renders them as warnings/badges.
- API: Effect typed errors → HttpApi error responses (401 Unauthorized, 404 NotFound, 400 SchemaError); no untyped throws.
- Beta churn: exact version pins; any `effect` upgrade is its own commit with full test run.

## Testing

- **Engine (Vitest, thorough):** document reproduction test; tax edges (interest exactly 100 000 kr; ISK capital below/above 300 000 kr floor; deduction ineligible); LTV restoration math; infeasible calibration; stress-test margin-call boundary; goal solver convergence.
- **API:** handler tests against in-memory SQLite covering auth gating and ownership.
- **Web:** manual smoke for v1 (engine correctness is where the risk lives).

## Out of scope (v1)

Monte Carlo simulation, KF accounts, real market data feeds, multi-currency, PDF export, mobile app.
