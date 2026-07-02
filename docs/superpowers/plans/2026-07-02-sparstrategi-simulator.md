# Sparstrategi Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Interactive Swedish investment-strategy simulator (leveraged ISK+AF model, goal evaluation, stress tests) with an Effect v4 beta backend and Effect Atom frontend state.

**Architecture:** Pure TS engine in `packages/engine` (Effect Schema types, math is dependency-free, runs in browser). Shared `HttpApi` contract in `packages/contract`. `apps/server` serves it via `HttpRouter.serve` on Bun with `@effect/sql-sqlite-bun`; Better-Auth mounted as a raw route, session resolved by an `HttpApiMiddleware` providing `CurrentUser`. `apps/web` (TanStack Router) uses `@effect/atom-react`: input atoms → derived simulation atom → Recharts.

**Tech Stack:** Bun workspaces + Turborepo, `effect@4.0.0-beta.93`, `@effect/platform-bun@4.0.0-beta.93`, `@effect/sql-sqlite-bun@4.0.0-beta.93`, `@effect/atom-react@4.0.0-beta.93`, `drizzle-orm@1.0.0-rc.4` (Effect integration via `drizzle-orm/effect-sqlite-bun`), Better-Auth on `bun:sqlite`, React 19, TanStack Router, Recharts, Tailwind 4, `bun test`.

**Spec:** `docs/superpowers/specs/2026-07-02-sparstrategi-simulator-design.md`. One deliberate deviation: tests use `bun test` (built into the runtime, zero deps) instead of Vitest.

## Global Constraints

- All `effect*` packages pinned EXACTLY to `4.0.0-beta.93` (no `^`/`~`). `drizzle-orm` pinned EXACTLY to `1.0.0-rc.4` — NOT `1.0.0-rc.4-5d5b77c` (that build has the Effect SQLite drivers stripped out). Upgrades are a separate deliberate commit.
- Effect v4 API, NOT v3. Key renames verified against installed beta: `Context.Service` (no `Context.Tag`, no `Effect.Service`); `Schema.TaggedErrorClass` (not `TaggedError`); `Result` (not `Either`); HttpApi endpoints take an options object (no `.setPayload/.addSuccess` chaining); `HttpApiBuilder.layer(api)` + `HttpRouter.serve(...)` (no `HttpApiBuilder.serve`); `HttpRouter.cors(...)` (no `middlewareCors`); `HttpApiEndpoint.delete` (not `.del`); `Layer.succeed(Key)(value)` is curried; do NOT install `@effect/platform` (v3, incompatible — Http lives in `effect/unstable/http[api]`).
- Money is SEK (kr) as plain `number`. Rates are decimal fractions (0.07 = 7%).
- UI copy in Swedish; numbers formatted `sv-SE` with auto-scaling kr → tkr → Mkr → Mdr.
- Engine reproduces the source document's Year-1 KPIs (see Task 4) — that test must never be weakened. The document's multi-year table is internally inconsistent (tilläggslån 277.6 vs 77.6 Mkr; growth ignores new loan proceeds; interest growth unfunded) — the engine uses correct math and only Year-1/calibration numbers are regression-tested.
- Every commit leaves the repo green: `bun run check-types` and `bun test` pass. Old tRPC/Drizzle code is removed only in Task 12, after the web app no longer imports it.
- Working commands from repo root: `bun install`, `bun test packages/engine`, `bun run check-types`, `bun run dev`.

---

### Task 1: Workspace prep + engine package skeleton

**Files:**
- Modify: `package.json` (root — catalog entries)
- Create: `packages/engine/package.json`
- Create: `packages/engine/tsconfig.json`
- Create: `packages/engine/src/index.ts`
- Test: `packages/engine/test/smoke.test.ts`

**Interfaces:**
- Produces: workspace package `@sparstrategi/engine` importable elsewhere; catalog pins for all Effect packages and Recharts.

- [ ] **Step 1: Add catalog entries to root `package.json`**

In the `workspaces.catalog` object, add (keep existing entries):

```json
"effect": "4.0.0-beta.93",
"@effect/platform-bun": "4.0.0-beta.93",
"@effect/sql-sqlite-bun": "4.0.0-beta.93",
"@effect/atom-react": "4.0.0-beta.93",
"drizzle-orm": "1.0.0-rc.4",
"recharts": "^3.3.1"
```

- [ ] **Step 2: Create `packages/engine/package.json`**

```json
{
  "name": "@sparstrategi/engine",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "check-types": "tsc --noEmit",
    "test": "bun test"
  },
  "dependencies": {
    "effect": "catalog:"
  },
  "devDependencies": {
    "@sparstrategi/config": "workspace:*",
    "@types/bun": "catalog:",
    "typescript": "catalog:"
  }
}
```

- [ ] **Step 3: Create `packages/engine/tsconfig.json`**

Mirror the pattern used by `packages/auth/tsconfig.json` (extends the shared base). Read that file first and copy its shape:

```json
{
  "extends": "@sparstrategi/config/tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src", "test"]
}
```

If the base config's `include`/paths conventions differ in `packages/auth/tsconfig.json`, follow that file's convention instead.

- [ ] **Step 4: Create placeholder `packages/engine/src/index.ts`**

```ts
export const ENGINE_VERSION = 1;
```

- [ ] **Step 5: Write smoke test `packages/engine/test/smoke.test.ts`**

```ts
import { describe, expect, test } from "bun:test";
import { ENGINE_VERSION } from "../src/index";

describe("engine package", () => {
  test("is importable", () => {
    expect(ENGINE_VERSION).toBe(1);
  });
});
```

- [ ] **Step 6: Install and verify**

Run: `bun install && bun test packages/engine`
Expected: 1 pass. Also run `bun run check-types` — all existing packages still pass.

- [ ] **Step 7: Commit**

```bash
git add package.json bun.lock packages/engine
git commit -m "feat(engine): scaffold engine package, pin effect v4 beta in catalog"
```

---

### Task 2: Engine schema types + defaults

**Files:**
- Create: `packages/engine/src/schema.ts`
- Modify: `packages/engine/src/index.ts`
- Test: `packages/engine/test/schema.test.ts`

**Interfaces:**
- Produces (exact, used by every later task):
  - `TaxParams` (Schema.Struct) + `type TaxParams = typeof TaxParams.Type` with fields: `slr, iskFreeAmount, deductionRateLow, deductionRateHigh, deductionBreakpoint, afCapitalGainsRate: Schema.Number`, `deductionEligible: Schema.Boolean`
  - `defaultTaxParams2026: TaxParams`, `documentTaxParams: TaxParams`
  - `Goal` union: `WealthGoal { type: "wealth"; amount: number; year: number }`, `PassiveIncomeGoal { type: "passiveIncome"; monthlyAmount: number }`
  - `ScenarioInput` (Schema.Struct) + type, fields: `startCapital, monthlySavings, targetLtv, maxLtv, loanRate, expectedReturn, monthlyLivingCosts, horizonYears: Schema.Number`, `taxParams: TaxParams`, `goals: Schema.Array(Goal)`
  - `defaultScenarioInput: ScenarioInput`

- [ ] **Step 1: Write failing test `packages/engine/test/schema.test.ts`**

```ts
import { describe, expect, test } from "bun:test";
import { Schema } from "effect";
import {
  ScenarioInput,
  defaultScenarioInput,
  defaultTaxParams2026,
  documentTaxParams,
} from "../src/schema";

describe("ScenarioInput schema", () => {
  test("decodes the default input", () => {
    const decoded = Schema.decodeUnknownSync(ScenarioInput)(defaultScenarioInput);
    expect(decoded.taxParams.iskFreeAmount).toBe(300_000);
  });

  test("rejects malformed input", () => {
    expect(() =>
      Schema.decodeUnknownSync(ScenarioInput)({ startCapital: "much" }),
    ).toThrow();
  });

  test("2026 defaults match Swedish rules", () => {
    expect(defaultTaxParams2026.deductionBreakpoint).toBe(100_000);
    expect(defaultTaxParams2026.deductionRateLow).toBe(0.3);
    expect(defaultTaxParams2026.deductionRateHigh).toBe(0.21);
  });

  test("document params replicate the source document's flat model", () => {
    expect(documentTaxParams.iskFreeAmount).toBe(0);
    expect(documentTaxParams.deductionBreakpoint).toBe(0);
    expect(documentTaxParams.deductionRateHigh).toBe(0.21);
  });

  test("decodes a goal union member", () => {
    const withGoal = {
      ...defaultScenarioInput,
      goals: [{ type: "wealth", amount: 10_000_000, year: 10 }],
    };
    const decoded = Schema.decodeUnknownSync(ScenarioInput)(withGoal);
    expect(decoded.goals[0]?.type).toBe("wealth");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/engine/test/schema.test.ts`
Expected: FAIL — module `../src/schema` not found.

- [ ] **Step 3: Implement `packages/engine/src/schema.ts`**

```ts
import { Schema } from "effect";

export const TaxParams = Schema.Struct({
  /** Statslåneränta (decimal, e.g. 0.025). ISK rate = max(slr + 1pp, 1.25%) × 30%. */
  slr: Schema.Number,
  /** Tax-free capital floor for ISK (300 000 kr from 2026). */
  iskFreeAmount: Schema.Number,
  /** Secured loans (portfolio credit) qualify for ränteavdrag. */
  deductionEligible: Schema.Boolean,
  /** 30% on interest up to the breakpoint. */
  deductionRateLow: Schema.Number,
  /** 21% above the breakpoint. */
  deductionRateHigh: Schema.Number,
  /** 100 000 kr/year. */
  deductionBreakpoint: Schema.Number,
  /** 30% on realized AF gains (reported as latent tax; AF is never sold in the core loop). */
  afCapitalGainsRate: Schema.Number,
});
export type TaxParams = typeof TaxParams.Type;

export const defaultTaxParams2026: TaxParams = {
  slr: 0.025,
  iskFreeAmount: 300_000,
  deductionEligible: true,
  deductionRateLow: 0.3,
  deductionRateHigh: 0.21,
  deductionBreakpoint: 100_000,
  afCapitalGainsRate: 0.3,
};

/** Flat model used by the source document: no free floor, flat 21% deduction. */
export const documentTaxParams: TaxParams = {
  slr: 0.025,
  iskFreeAmount: 0,
  deductionEligible: true,
  deductionRateLow: 0.21,
  deductionRateHigh: 0.21,
  deductionBreakpoint: 0,
  afCapitalGainsRate: 0.3,
};

export const WealthGoal = Schema.Struct({
  type: Schema.Literal("wealth"),
  amount: Schema.Number,
  year: Schema.Number,
});
export type WealthGoal = typeof WealthGoal.Type;

export const PassiveIncomeGoal = Schema.Struct({
  type: Schema.Literal("passiveIncome"),
  monthlyAmount: Schema.Number,
});
export type PassiveIncomeGoal = typeof PassiveIncomeGoal.Type;

export const Goal = Schema.Union([WealthGoal, PassiveIncomeGoal]);
export type Goal = typeof Goal.Type;

export const ScenarioInput = Schema.Struct({
  startCapital: Schema.Number,
  monthlySavings: Schema.Number,
  /** Target loan-to-value = loan / total portfolio (incl. loan). 0–0.6. */
  targetLtv: Schema.Number,
  /** Margin-call threshold (broker max LTV). */
  maxLtv: Schema.Number,
  loanRate: Schema.Number,
  expectedReturn: Schema.Number,
  monthlyLivingCosts: Schema.Number,
  horizonYears: Schema.Number,
  taxParams: TaxParams,
  goals: Schema.Array(Goal),
});
export type ScenarioInput = typeof ScenarioInput.Type;

export const defaultScenarioInput: ScenarioInput = {
  startCapital: 1_000_000,
  monthlySavings: 10_000,
  targetLtv: 0.2,
  maxLtv: 0.5,
  loanRate: 0.03,
  expectedReturn: 0.07,
  monthlyLivingCosts: 0,
  horizonYears: 20,
  taxParams: defaultTaxParams2026,
  goals: [],
};
```

Note: `Schema.Union([...])` takes an array in v4. If `tsc` disagrees on the installed beta, check `node_modules/effect/dist/schema/Schema.d.ts` for the `Union` signature and adapt (it may be variadic) — do not downgrade to `Schema.Any`.

- [ ] **Step 4: Re-export from `packages/engine/src/index.ts`**

```ts
export const ENGINE_VERSION = 1;
export * from "./schema";
```

- [ ] **Step 5: Run tests**

Run: `bun test packages/engine`
Expected: all pass. Run `cd packages/engine && bun run check-types`.

- [ ] **Step 6: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): scenario input schema with 2026 Swedish tax defaults"
```

---

### Task 3: Engine tax module

**Files:**
- Create: `packages/engine/src/tax.ts`
- Modify: `packages/engine/src/index.ts`
- Test: `packages/engine/test/tax.test.ts`

**Interfaces:**
- Consumes: `TaxParams` from `./schema`.
- Produces:
  - `iskTaxRate(p: TaxParams): number` — effective rate on capital = `max(p.slr + 0.01, 0.0125) * 0.30`
  - `iskTax(capital: number, p: TaxParams): number` — schablonskatt on `max(0, capital - iskFreeAmount)`
  - `interestDeduction(interest: number, p: TaxParams): number` — bracketed skattereduktion, 0 if not eligible
  - `netTax(iskTaxAmount: number, deduction: number): { net: number; excessReduction: number }`

- [ ] **Step 1: Write failing tests `packages/engine/test/tax.test.ts`**

```ts
import { describe, expect, test } from "bun:test";
import { defaultTaxParams2026, documentTaxParams } from "../src/schema";
import { interestDeduction, iskTax, iskTaxRate, netTax } from "../src/tax";

describe("iskTaxRate", () => {
  test("SLR 2.5% gives 1.05% effective (document's rate)", () => {
    expect(iskTaxRate(documentTaxParams)).toBeCloseTo(0.0105, 6);
  });

  test("floor: very low SLR still gives 1.25% × 30%", () => {
    expect(iskTaxRate({ ...defaultTaxParams2026, slr: 0.001 })).toBeCloseTo(
      0.0125 * 0.3,
      6,
    );
  });
});

describe("iskTax", () => {
  test("capital below the 300k free floor pays zero", () => {
    expect(iskTax(250_000, defaultTaxParams2026)).toBe(0);
  });

  test("only capital above the floor is taxed", () => {
    // 400k capital, 300k floor → 100k × 1.05%
    expect(iskTax(400_000, defaultTaxParams2026)).toBeCloseTo(1_050, 2);
  });

  test("document model: 457.14 Mkr × 1.05% ≈ 4.8 Mkr", () => {
    expect(iskTax(457_142_857, documentTaxParams)).toBeCloseTo(4_800_000, -4);
  });
});

describe("interestDeduction", () => {
  test("interest exactly at the 100k breakpoint: all at 30%", () => {
    expect(interestDeduction(100_000, defaultTaxParams2026)).toBeCloseTo(30_000, 2);
  });

  test("interest above breakpoint: 30% below + 21% above", () => {
    // 150k → 30 000 + 50k×0.21 = 40 500
    expect(interestDeduction(150_000, defaultTaxParams2026)).toBeCloseTo(40_500, 2);
  });

  test("not eligible → 0", () => {
    expect(
      interestDeduction(150_000, { ...defaultTaxParams2026, deductionEligible: false }),
    ).toBe(0);
  });

  test("document model: flat 21% of 30 Mkr = 6.3 Mkr", () => {
    expect(interestDeduction(30_000_000, documentTaxParams)).toBeCloseTo(6_300_000, 0);
  });
});

describe("netTax", () => {
  test("deduction larger than tax → net 0 with excess", () => {
    const r = netTax(4_800_000, 6_300_000);
    expect(r.net).toBe(0);
    expect(r.excessReduction).toBeCloseTo(1_500_000, 0);
  });

  test("tax larger than deduction → positive net, no excess", () => {
    const r = netTax(10_000, 4_000);
    expect(r.net).toBe(6_000);
    expect(r.excessReduction).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test packages/engine/test/tax.test.ts`
Expected: FAIL — `../src/tax` not found.

- [ ] **Step 3: Implement `packages/engine/src/tax.ts`**

```ts
import type { TaxParams } from "./schema";

/** Effective yearly tax rate on ISK capital: max(SLR + 1pp, 1.25%) × 30%. */
export const iskTaxRate = (p: TaxParams): number =>
  Math.max(p.slr + 0.01, 0.0125) * 0.3;

/** Schablonskatt on capital above the tax-free floor. Simplification: uses
 * year-start capital as kapitalunderlag (real rule averages quarters + deposits). */
export const iskTax = (capital: number, p: TaxParams): number =>
  Math.max(0, capital - p.iskFreeAmount) * iskTaxRate(p);

/** Ränteavdrag (skattereduktion): 30% up to the breakpoint, 21% above.
 * Requires a secured loan (deductionEligible). */
export const interestDeduction = (interest: number, p: TaxParams): number => {
  if (!p.deductionEligible || interest <= 0) return 0;
  return (
    p.deductionRateLow * Math.min(interest, p.deductionBreakpoint) +
    p.deductionRateHigh * Math.max(0, interest - p.deductionBreakpoint)
  );
};

/** Deduction is a skattereduktion: nets against the ISK tax; the surplus is
 * usable against other income tax (överskjutande skattereduktion). */
export const netTax = (
  iskTaxAmount: number,
  deduction: number,
): { net: number; excessReduction: number } => ({
  net: Math.max(0, iskTaxAmount - deduction),
  excessReduction: Math.max(0, deduction - iskTaxAmount),
});
```

- [ ] **Step 4: Add `export * from "./tax";` to `packages/engine/src/index.ts`, run tests**

Run: `bun test packages/engine`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): ISK schablonskatt and ränteavdrag with 2026 brackets"
```

---

### Task 4: Engine simulation loop (calibration, projection, re-leverage)

**Files:**
- Create: `packages/engine/src/simulate.ts`
- Modify: `packages/engine/src/index.ts`
- Test: `packages/engine/test/simulate.test.ts`

**Interfaces:**
- Consumes: `ScenarioInput`, tax functions from Task 3.
- Produces (exact — UI and later tasks depend on these):

```ts
export interface YearRow {
  year: number;            // 0 = start snapshot, 1..horizon
  portfolio: number;       // af + isk, end of year (post re-leverage)
  af: number;
  isk: number;
  loan: number;
  ltv: number;             // loan / portfolio
  equity: number;          // portfolio - loan
  growth: number;          // total gain this year (af + isk gains)
  interest: number;
  withdrawal: number;      // taken from ISK to pay interest + living
  iskTax: number;
  deduction: number;
  netTax: number;
  excessReduction: number;
  effectiveTaxRate: number; // netTax / growth (0 when growth <= 0)
  newLoan: number;          // additional borrowing at year end
  savingsAdded: number;
  warnings: ReadonlyArray<string>;
}
export interface Calibration {
  initialPortfolio: number;
  initialLoan: number;
  requiredIsk: number;
  initialAf: number;
  feasible: boolean;
}
export interface SimulationResult {
  calibration: Calibration;
  rows: ReadonlyArray<YearRow>; // rows[0] is the year-0 start snapshot
  warnings: ReadonlyArray<string>;
}
export function requiredIskCapital(loan: number, input: ScenarioInput): number;
export function simulate(input: ScenarioInput): SimulationResult;
```

**Algorithm (implement exactly this order per year):**
1. Calibration: `initialPortfolio = startCapital / (1 - targetLtv)`; `initialLoan = initialPortfolio - startCapital`. `requiredIskCapital(loan) = (loanRate*loan + 12*monthlyLivingCosts) / expectedReturn` (0 if that numerator is 0; `Infinity`→infeasible if `expectedReturn <= 0` with positive costs). `isk = min(requiredIsk, initialPortfolio)`, `af = initialPortfolio - isk`; `feasible = requiredIsk <= initialPortfolio`.
2. Each year: gains `afGain = af*r`, `iskGain = isk*r`; `interest = loan*loanRate`; `need = interest + 12*monthlyLivingCosts`; withdraw `need` from `isk + iskGain` (if it goes negative, take the remainder from AF and push warning `"ISK-uttag täcks av AF (principal erosion)"`; if AF also exhausted, clamp at 0, push `"Portföljen är uttömd"` and stop simulating further years).
3. Taxes: `iskTax` on year-START isk capital; `interestDeduction` on `interest`; `netTax` paid from AF.
4. `af += afGain + 12*monthlySavings - netTaxPaid` (minus any erosion from step 2).
5. Re-leverage at year end: `equity = af + isk - 0` — equity is `portfolio - loan` where `portfolio = af + isk`; target loan `loanTarget = targetLtv * equity / (1 - targetLtv)` (this makes post-borrow LTV exactly `targetLtv`, since borrowing adds to both loan and portfolio). `newLoan = max(0, loanTarget - loan)` — never deleverage in the base sim. Allocate proceeds: first top ISK back up to `requiredIskCapital(loanTarget)`, remainder to AF. If proceeds can't cover the ISK top-up, put everything in ISK and push warning `"ISK underkalibrerat"`.
6. Row's `portfolio/ltv/equity` are AFTER re-leverage.

- [ ] **Step 1: Write failing tests `packages/engine/test/simulate.test.ts`**

```ts
import { describe, expect, test } from "bun:test";
import { documentTaxParams, type ScenarioInput } from "../src/schema";
import { requiredIskCapital, simulate } from "../src/simulate";

/** The source document's scenario: 5 Mdr own capital, 1 Mdr loan → 6 Mdr
 * portfolio; 7% return, 3% loan rate, 2 Mkr/year living costs. */
const documentInput: ScenarioInput = {
  startCapital: 5_000_000_000,
  monthlySavings: 0,
  targetLtv: 1 / 6, // loan 1 Mdr on 6 Mdr portfolio
  maxLtv: 0.5,
  loanRate: 0.03,
  expectedReturn: 0.07,
  monthlyLivingCosts: 2_000_000 / 12,
  horizonYears: 5,
  taxParams: documentTaxParams,
  goals: [],
};

describe("document reproduction (regression anchor — do not weaken)", () => {
  const result = simulate(documentInput);
  const y1 = result.rows[1]!;

  test("calibration: ISK ≈ 457 Mkr, loan 1 Mdr, portfolio 6 Mdr", () => {
    expect(result.calibration.initialPortfolio).toBeCloseTo(6_000_000_000, -3);
    expect(result.calibration.initialLoan).toBeCloseTo(1_000_000_000, -3);
    expect(result.calibration.requiredIsk).toBeCloseTo(457_142_857, -3);
    expect(result.calibration.feasible).toBe(true);
  });

  test("year 1: interest 30 Mkr, withdrawal 32 Mkr, growth 420 Mkr", () => {
    expect(y1.interest).toBeCloseTo(30_000_000, -3);
    expect(y1.withdrawal).toBeCloseTo(32_000_000, -3);
    expect(y1.growth).toBeCloseTo(420_000_000, -4);
  });

  test("year 1 tax: ISK-skatt ≈ 4.8 Mkr fully offset, ≈1.5 Mkr excess, 0% effective", () => {
    expect(y1.iskTax).toBeCloseTo(4_800_000, -4);
    expect(y1.deduction).toBeCloseTo(6_300_000, -4);
    expect(y1.netTax).toBe(0);
    expect(y1.excessReduction).toBeCloseTo(1_500_000, -4);
    expect(y1.effectiveTaxRate).toBe(0);
  });

  test("ISK principal stays intact (self-financing engine)", () => {
    // withdrawal == iskGain, so pre-re-leverage ISK equals requiredIsk each year
    expect(y1.isk).toBeGreaterThanOrEqual(result.calibration.requiredIsk - 1);
  });
});

describe("re-leverage", () => {
  test("LTV is restored to target at every year end", () => {
    const result = simulate(documentInput);
    for (const row of result.rows.slice(1)) {
      expect(row.ltv).toBeCloseTo(1 / 6, 4);
    }
  });

  test("no loan when targetLtv = 0", () => {
    const result = simulate({ ...documentInput, targetLtv: 0, monthlyLivingCosts: 0 });
    expect(result.calibration.initialLoan).toBe(0);
    for (const row of result.rows) expect(row.loan).toBe(0);
  });
});

describe("feasibility and erosion", () => {
  test("costs too high for portfolio → infeasible", () => {
    const result = simulate({
      ...documentInput,
      startCapital: 1_000_000,
      monthlyLivingCosts: 100_000,
    });
    expect(result.calibration.feasible).toBe(false);
  });

  test("zero return with positive costs → infeasible", () => {
    const result = simulate({
      ...documentInput,
      expectedReturn: 0,
    });
    expect(result.calibration.feasible).toBe(false);
  });

  test("unleveraged saver without living costs just compounds", () => {
    const result = simulate({
      startCapital: 100_000,
      monthlySavings: 1_000,
      targetLtv: 0,
      maxLtv: 0.5,
      loanRate: 0.03,
      expectedReturn: 0.07,
      monthlyLivingCosts: 0,
      horizonYears: 2,
      taxParams: documentTaxParams,
      goals: [],
    });
    // y1: 100k×1.07 + 12k = 119 000 (ISK tax offset is 0 deduction; 100k×1.05% = 1 050 tax)
    const y1 = result.rows[1]!;
    expect(y1.portfolio).toBeCloseTo(100_000 * 1.07 + 12_000 - 1_050, 0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test packages/engine/test/simulate.test.ts`
Expected: FAIL — `../src/simulate` not found.

- [ ] **Step 3: Implement `packages/engine/src/simulate.ts`**

```ts
import type { ScenarioInput } from "./schema";
import { interestDeduction, iskTax, netTax } from "./tax";

export interface YearRow {
  year: number;
  portfolio: number;
  af: number;
  isk: number;
  loan: number;
  ltv: number;
  equity: number;
  growth: number;
  interest: number;
  withdrawal: number;
  iskTax: number;
  deduction: number;
  netTax: number;
  excessReduction: number;
  effectiveTaxRate: number;
  newLoan: number;
  savingsAdded: number;
  warnings: ReadonlyArray<string>;
}

export interface Calibration {
  initialPortfolio: number;
  initialLoan: number;
  requiredIsk: number;
  initialAf: number;
  feasible: boolean;
}

export interface SimulationResult {
  calibration: Calibration;
  rows: ReadonlyArray<YearRow>;
  warnings: ReadonlyArray<string>;
}

/** ISK capital needed so its return covers loan interest + living costs. */
export const requiredIskCapital = (loan: number, input: ScenarioInput): number => {
  const yearlyNeed = input.loanRate * loan + 12 * input.monthlyLivingCosts;
  if (yearlyNeed <= 0) return 0;
  if (input.expectedReturn <= 0) return Number.POSITIVE_INFINITY;
  return yearlyNeed / input.expectedReturn;
};

export function simulate(input: ScenarioInput): SimulationResult {
  const r = input.expectedReturn;
  const initialPortfolio =
    input.targetLtv > 0 ? input.startCapital / (1 - input.targetLtv) : input.startCapital;
  const initialLoan = initialPortfolio - input.startCapital;
  const requiredIsk = requiredIskCapital(initialLoan, input);
  const feasible = requiredIsk <= initialPortfolio;

  let isk = Math.min(requiredIsk, initialPortfolio);
  let af = initialPortfolio - isk;
  let loan = initialLoan;

  const globalWarnings: string[] = [];
  if (!feasible) {
    globalWarnings.push(
      "Ej genomförbart: avkastningen kan inte täcka ränta och levnadskostnader",
    );
  }

  const rows: YearRow[] = [
    {
      year: 0,
      portfolio: af + isk,
      af,
      isk,
      loan,
      ltv: af + isk > 0 ? loan / (af + isk) : 0,
      equity: af + isk - loan,
      growth: 0,
      interest: 0,
      withdrawal: 0,
      iskTax: 0,
      deduction: 0,
      netTax: 0,
      excessReduction: 0,
      effectiveTaxRate: 0,
      newLoan: 0,
      savingsAdded: 0,
      warnings: [],
    },
  ];

  for (let year = 1; year <= input.horizonYears; year++) {
    const warnings: string[] = [];
    const iskAtStart = isk;

    // 1. Growth and cash needs
    const afGain = af * r;
    const iskGain = isk * r;
    const interest = loan * input.loanRate;
    const need = interest + 12 * input.monthlyLivingCosts;

    // 2. Withdraw from ISK; erosion falls through to AF
    let iskAfter = isk + iskGain - need;
    let afAfter = af + afGain;
    if (iskAfter < 0) {
      afAfter += iskAfter; // take shortfall from AF
      iskAfter = 0;
      warnings.push("ISK-uttag täcks av AF (principal erosion)");
    }

    // 3. Taxes (on year-start ISK capital), paid from AF
    const iskTaxAmount = iskTax(iskAtStart, input.taxParams);
    const deduction = interestDeduction(interest, input.taxParams);
    const { net, excessReduction } = netTax(iskTaxAmount, deduction);
    afAfter -= net;

    // 4. Savings
    const savingsAdded = 12 * input.monthlySavings;
    afAfter += savingsAdded;

    let exhausted = false;
    if (afAfter < 0) {
      afAfter = 0;
      exhausted = true;
      warnings.push("Portföljen är uttömd");
    }

    // 5. Re-leverage to target LTV; proceeds recalibrate ISK first, rest to AF
    const equityNow = afAfter + iskAfter - loan;
    let newLoan = 0;
    if (input.targetLtv > 0 && equityNow > 0 && !exhausted) {
      const loanTarget = (input.targetLtv * equityNow) / (1 - input.targetLtv);
      newLoan = Math.max(0, loanTarget - loan);
      if (newLoan > 0) {
        const iskTarget = requiredIskCapital(loan + newLoan, input);
        const topUp = Math.max(0, iskTarget - iskAfter);
        if (topUp > newLoan) {
          iskAfter += newLoan;
          warnings.push("ISK underkalibrerat");
        } else {
          iskAfter += topUp;
          afAfter += newLoan - topUp;
        }
        loan += newLoan;
      }
    }

    af = afAfter;
    isk = iskAfter;
    const portfolio = af + isk;
    const growth = afGain + iskGain;

    rows.push({
      year,
      portfolio,
      af,
      isk,
      loan,
      ltv: portfolio > 0 ? loan / portfolio : 0,
      equity: portfolio - loan,
      growth,
      interest,
      withdrawal: Math.min(need, iskAtStart + iskGain),
      iskTax: iskTaxAmount,
      deduction,
      netTax: net,
      excessReduction,
      effectiveTaxRate: growth > 0 ? net / growth : 0,
      newLoan,
      savingsAdded,
      warnings,
    });

    if (exhausted) break;
  }

  return {
    calibration: {
      initialPortfolio,
      initialLoan,
      requiredIsk,
      initialAf: initialPortfolio - Math.min(requiredIsk, initialPortfolio),
      feasible,
    },
    rows,
    warnings: globalWarnings,
  };
}
```

- [ ] **Step 4: Add `export * from "./simulate";` to index, run tests**

Run: `bun test packages/engine`
Expected: PASS. If the document-reproduction numbers are off, debug the math — do not loosen tolerances.

- [ ] **Step 5: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): simulation loop with calibration and LTV restoration"
```

---

### Task 5: Engine goal evaluators

**Files:**
- Create: `packages/engine/src/goals.ts`
- Modify: `packages/engine/src/index.ts`
- Test: `packages/engine/test/goals.test.ts`

**Interfaces:**
- Consumes: `simulate`, `requiredIskCapital`, `ScenarioInput`, `Goal` types.
- Produces:

```ts
export interface WealthGoalResult {
  type: "wealth";
  goal: WealthGoal;
  achieved: boolean;          // equity >= amount at goal.year
  hitYear: number | null;     // first year equity >= amount (within horizon)
  equityAtTargetYear: number;
  shortfall: number;          // max(0, amount - equityAtTargetYear)
  requiredMonthlySavings: number | null; // extra savings to hit it; null if unreachable at 1 Mkr/mo
}
export interface PassiveIncomeGoalResult {
  type: "passiveIncome";
  goal: PassiveIncomeGoal;
  requiredIskCapital: number;
  feasible: boolean;          // portfolio can host that ISK at some year within horizon
  feasibleYear: number | null;
}
export type GoalResult = WealthGoalResult | PassiveIncomeGoalResult;
export function evaluateGoals(input: ScenarioInput, result: SimulationResult): ReadonlyArray<GoalResult>;
```

- [ ] **Step 1: Write failing tests `packages/engine/test/goals.test.ts`**

```ts
import { describe, expect, test } from "bun:test";
import { documentTaxParams, type ScenarioInput } from "../src/schema";
import { evaluateGoals } from "../src/goals";
import { simulate } from "../src/simulate";

const base: ScenarioInput = {
  startCapital: 1_000_000,
  monthlySavings: 10_000,
  targetLtv: 0,
  maxLtv: 0.5,
  loanRate: 0.03,
  expectedReturn: 0.07,
  monthlyLivingCosts: 0,
  horizonYears: 20,
  taxParams: documentTaxParams,
  goals: [],
};

describe("wealth goal", () => {
  test("achievable goal reports hit year", () => {
    const input: ScenarioInput = {
      ...base,
      goals: [{ type: "wealth", amount: 2_000_000, year: 15 }],
    };
    const [g] = evaluateGoals(input, simulate(input));
    if (g?.type !== "wealth") throw new Error("expected wealth result");
    expect(g.achieved).toBe(true);
    expect(g.hitYear).not.toBeNull();
    expect(g.hitYear!).toBeLessThanOrEqual(15);
  });

  test("missed goal computes required extra monthly savings via bisection", () => {
    const input: ScenarioInput = {
      ...base,
      monthlySavings: 0,
      goals: [{ type: "wealth", amount: 5_000_000, year: 10 }],
    };
    const [g] = evaluateGoals(input, simulate(input));
    if (g?.type !== "wealth") throw new Error("expected wealth result");
    expect(g.achieved).toBe(false);
    expect(g.shortfall).toBeGreaterThan(0);
    expect(g.requiredMonthlySavings).not.toBeNull();

    // Verify: re-running with the suggested savings hits the goal (±1%)
    const rerun = simulate({ ...input, monthlySavings: g.requiredMonthlySavings! });
    const equityAt10 = rerun.rows.find((r) => r.year === 10)!.equity;
    expect(equityAt10).toBeGreaterThanOrEqual(5_000_000 * 0.99);
  });
});

describe("passive income goal", () => {
  test("required ISK capital = 12×monthly / return", () => {
    const input: ScenarioInput = {
      ...base,
      startCapital: 10_000_000,
      goals: [{ type: "passiveIncome", monthlyAmount: 20_000 }],
    };
    const [g] = evaluateGoals(input, simulate(input));
    if (g?.type !== "passiveIncome") throw new Error("expected passiveIncome result");
    // 240 000 / 0.07 ≈ 3 428 571
    expect(g.requiredIskCapital).toBeCloseTo(240_000 / 0.07, 0);
    expect(g.feasible).toBe(true);
    expect(g.feasibleYear).toBe(0); // 10 Mkr portfolio already hosts 3.4 Mkr ISK
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test packages/engine/test/goals.test.ts` — FAIL, module not found.

- [ ] **Step 3: Implement `packages/engine/src/goals.ts`**

```ts
import type { PassiveIncomeGoal, ScenarioInput, WealthGoal } from "./schema";
import { simulate, type SimulationResult } from "./simulate";

export interface WealthGoalResult {
  type: "wealth";
  goal: WealthGoal;
  achieved: boolean;
  hitYear: number | null;
  equityAtTargetYear: number;
  shortfall: number;
  requiredMonthlySavings: number | null;
}

export interface PassiveIncomeGoalResult {
  type: "passiveIncome";
  goal: PassiveIncomeGoal;
  requiredIskCapital: number;
  feasible: boolean;
  feasibleYear: number | null;
}

export type GoalResult = WealthGoalResult | PassiveIncomeGoalResult;

const MAX_MONTHLY_SAVINGS = 1_000_000;

const equityAtYear = (result: SimulationResult, year: number): number => {
  const row = result.rows.find((r) => r.year === year) ?? result.rows.at(-1);
  return row?.equity ?? 0;
};

const solveRequiredSavings = (
  input: ScenarioInput,
  goal: WealthGoal,
): number | null => {
  const hits = (monthly: number) =>
    equityAtYear(simulate({ ...input, monthlySavings: monthly }), goal.year) >=
    goal.amount;
  if (!hits(MAX_MONTHLY_SAVINGS)) return null;
  let lo = input.monthlySavings;
  let hi = MAX_MONTHLY_SAVINGS;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (hits(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
};

export function evaluateGoals(
  input: ScenarioInput,
  result: SimulationResult,
): ReadonlyArray<GoalResult> {
  return input.goals.map((goal): GoalResult => {
    if (goal.type === "wealth") {
      const equityAtTargetYear = equityAtYear(result, goal.year);
      const achieved = equityAtTargetYear >= goal.amount;
      const hit = result.rows.find((r) => r.equity >= goal.amount);
      return {
        type: "wealth",
        goal,
        achieved,
        hitYear: hit ? hit.year : null,
        equityAtTargetYear,
        shortfall: Math.max(0, goal.amount - equityAtTargetYear),
        requiredMonthlySavings: achieved ? null : solveRequiredSavings(input, goal),
      };
    }
    const required =
      input.expectedReturn > 0
        ? (12 * goal.monthlyAmount) / input.expectedReturn
        : Number.POSITIVE_INFINITY;
    const feasibleRow = result.rows.find((r) => r.portfolio >= required);
    return {
      type: "passiveIncome",
      goal,
      requiredIskCapital: required,
      feasible: feasibleRow !== undefined,
      feasibleYear: feasibleRow ? feasibleRow.year : null,
    };
  });
}
```

- [ ] **Step 4: Add `export * from "./goals";` to index, run tests**

Run: `bun test packages/engine` — PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): wealth and passive-income goal evaluation"
```

---

### Task 6: Engine stress test

**Files:**
- Create: `packages/engine/src/stress.ts`
- Modify: `packages/engine/src/index.ts`
- Test: `packages/engine/test/stress.test.ts`

**Interfaces:**
- Consumes: `simulate` internals pattern, `ScenarioInput`.
- Produces:

```ts
export interface StressInput { crashPct: number; crashYear: number } // crashPct 0.3 = −30% at start of crashYear
export interface StressResult {
  postCrashLtv: number;
  marginCall: boolean;            // postCrashLtv > input.maxLtv
  forcedSaleAmount: number;       // sale (loan repayment) restoring LTV to targetLtv; 0 if no margin call
  preCrashEquity: number;
  recoveryYear: number | null;    // first year (>= crashYear) equity >= preCrashEquity
  rows: ReadonlyArray<YearRow>;   // full path incl. crash and aftermath (no re-leverage until LTV < target)
}
export function stressTest(input: ScenarioInput, stress: StressInput): StressResult;
```

Implementation approach: run the base simulation year-by-year with the same loop as `simulate`, but at the start of `crashYear` multiply `af` and `isk` by `(1 - crashPct)` (loan unchanged). If post-crash LTV > `maxLtv`: forced sale `x = (loan - targetLtv * V) / (1 - targetLtv)` where `V` is the post-crash portfolio — selling `x` of assets repays `x` of loan, restoring LTV to `targetLtv` (sell from AF first, then ISK). After the crash, skip step 5 (re-leverage) for any year where LTV > `targetLtv`. To avoid duplicating the loop, refactor `simulate` to accept an optional internal hook — simplest is an optional third parameter object `{ onYearStart?: (year, state) => state, allowReleverage?: (state) => boolean }` kept un-exported from the package index; `stressTest` calls the internal loop with those hooks.

- [ ] **Step 1: Write failing tests `packages/engine/test/stress.test.ts`**

```ts
import { describe, expect, test } from "bun:test";
import { documentTaxParams, type ScenarioInput } from "../src/schema";
import { stressTest } from "../src/stress";

const leveraged: ScenarioInput = {
  startCapital: 1_000_000,
  monthlySavings: 0,
  targetLtv: 0.4,
  maxLtv: 0.5,
  loanRate: 0.03,
  expectedReturn: 0.07,
  monthlyLivingCosts: 0,
  horizonYears: 20,
  taxParams: documentTaxParams,
  goals: [],
};

describe("stressTest", () => {
  test("small crash on low leverage: no margin call", () => {
    const r = stressTest({ ...leveraged, targetLtv: 0.2 }, { crashPct: 0.2, crashYear: 1 });
    // LTV 0.2 → after −20%: 0.2/0.8 = 0.25 < 0.5
    expect(r.postCrashLtv).toBeCloseTo(0.25, 3);
    expect(r.marginCall).toBe(false);
    expect(r.forcedSaleAmount).toBe(0);
  });

  test("margin-call boundary: crash pushing LTV exactly past maxLtv triggers", () => {
    // targetLtv 0.4, crash 25% → LTV 0.4/0.75 ≈ 0.533 > 0.5 → margin call
    const r = stressTest(leveraged, { crashPct: 0.25, crashYear: 1 });
    expect(r.marginCall).toBe(true);
    expect(r.forcedSaleAmount).toBeGreaterThan(0);
  });

  test("crash below the boundary does not trigger", () => {
    // crash 16% → LTV 0.4/0.84 ≈ 0.476 < 0.5
    const r = stressTest(leveraged, { crashPct: 0.16, crashYear: 1 });
    expect(r.marginCall).toBe(false);
  });

  test("forced sale restores LTV to target", () => {
    const r = stressTest(leveraged, { crashPct: 0.3, crashYear: 2 });
    expect(r.marginCall).toBe(true);
    const crashRow = r.rows.find((row) => row.year === 2)!;
    expect(crashRow.ltv).toBeLessThanOrEqual(leveraged.targetLtv + 0.01);
  });

  test("recovery year is reported and after the crash", () => {
    const r = stressTest(leveraged, { crashPct: 0.2, crashYear: 1 });
    expect(r.recoveryYear).not.toBeNull();
    expect(r.recoveryYear!).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `bun test packages/engine/test/stress.test.ts` FAILs.

- [ ] **Step 3: Implement**

Refactor `simulate.ts`: extract the year loop body so it can run with hooks (internal option object as described in Interfaces above — the exported `simulate(input)` signature MUST stay unchanged; hooks are an optional second parameter typed and used only inside the package). Then `packages/engine/src/stress.ts`:

```ts
import type { ScenarioInput } from "./schema";
import { simulateWithHooks, type YearRow } from "./simulate";

export interface StressInput {
  crashPct: number;
  crashYear: number;
}

export interface StressResult {
  postCrashLtv: number;
  marginCall: boolean;
  forcedSaleAmount: number;
  preCrashEquity: number;
  recoveryYear: number | null;
  rows: ReadonlyArray<YearRow>;
}

export function stressTest(input: ScenarioInput, stress: StressInput): StressResult {
  let postCrashLtv = 0;
  let marginCall = false;
  let forcedSaleAmount = 0;
  let preCrashEquity = 0;

  const result = simulateWithHooks(input, {
    onYearStart: (year, state) => {
      if (year !== stress.crashYear) return state;
      preCrashEquity = state.af + state.isk - state.loan;
      let af = state.af * (1 - stress.crashPct);
      let isk = state.isk * (1 - stress.crashPct);
      let loan = state.loan;
      const v = af + isk;
      postCrashLtv = v > 0 ? loan / v : 1;
      if (postCrashLtv > input.maxLtv) {
        marginCall = true;
        forcedSaleAmount = (loan - input.targetLtv * v) / (1 - input.targetLtv);
        const fromAf = Math.min(af, forcedSaleAmount);
        af -= fromAf;
        isk -= forcedSaleAmount - fromAf;
        loan -= forcedSaleAmount;
      }
      return { af, isk, loan };
    },
    allowReleverage: (state) => {
      const v = state.af + state.isk;
      return v > 0 && state.loan / v <= input.targetLtv;
    },
  });

  const recoveryRow = result.rows.find(
    (r) => r.year > stress.crashYear && r.equity >= preCrashEquity,
  );
  return {
    postCrashLtv,
    marginCall,
    forcedSaleAmount,
    preCrashEquity,
    recoveryYear: recoveryRow ? recoveryRow.year : null,
    rows: result.rows,
  };
}
```

In `simulate.ts`, define and export (from the file, and re-export the TYPE only from index — `simulateWithHooks` itself may be exported from index too; it is harmless):

```ts
export interface SimState {
  af: number;
  isk: number;
  loan: number;
}
export interface SimHooks {
  onYearStart?: (year: number, state: SimState) => SimState;
  allowReleverage?: (state: SimState) => boolean;
}
export function simulateWithHooks(input: ScenarioInput, hooks: SimHooks): SimulationResult;
// simulate(input) === simulateWithHooks(input, {})
```

Inside the loop: call `hooks.onYearStart` first thing each year; guard step 5's re-leverage block with `hooks.allowReleverage?.(state) ?? true`.

- [ ] **Step 4: Run ALL engine tests (regression: Task 4's must still pass)**

Run: `bun test packages/engine` — PASS, including document reproduction.

- [ ] **Step 5: Add `export * from "./stress";` to index, typecheck, commit**

```bash
git add packages/engine
git commit -m "feat(engine): crash stress test with margin-call detection"
```

---

### Task 7: API contract package (`packages/contract`)

**Files:**
- Create: `packages/contract/package.json`
- Create: `packages/contract/tsconfig.json`
- Create: `packages/contract/src/index.ts`
- Test: `packages/contract/test/contract.test.ts`

**Interfaces:**
- Consumes: `ScenarioInput` schema from `@sparstrategi/engine`.
- Produces (server and web both import these):
  - `Scenario` (Schema.Struct): `{ id: string; name: string; input: ScenarioInput; engineVersion: number; createdAt: string; updatedAt: string }`
  - `ScenarioUpsert` (Schema.Struct): `{ name: string; input: ScenarioInput }`
  - `class CurrentUser extends Context.Service<CurrentUser, { readonly id: string; readonly email: string }>()("CurrentUser") {}`
  - `class AuthMiddleware extends HttpApiMiddleware.Service<AuthMiddleware, { provides: CurrentUser }>()("AuthMiddleware", { error: HttpApiError.Unauthorized }) {}`
  - `api = HttpApi.make("sparstrategi")...` with group `"scenarios"`, endpoints named `list` (GET `/scenarios`), `create` (POST `/scenarios`), `update` (PUT `/scenarios/:id`), `remove` (DELETE `/scenarios/:id`), prefixed `/api`.

- [ ] **Step 1: Create package files**

`packages/contract/package.json`:

```json
{
  "name": "@sparstrategi/contract",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "check-types": "tsc --noEmit",
    "test": "bun test"
  },
  "dependencies": {
    "@sparstrategi/engine": "workspace:*",
    "effect": "catalog:"
  },
  "devDependencies": {
    "@sparstrategi/config": "workspace:*",
    "@types/bun": "catalog:",
    "typescript": "catalog:"
  }
}
```

`packages/contract/tsconfig.json`: same shape as `packages/engine/tsconfig.json`.

- [ ] **Step 2: Write failing test `packages/contract/test/contract.test.ts`**

```ts
import { describe, expect, test } from "bun:test";
import { Schema } from "effect";
import { defaultScenarioInput } from "@sparstrategi/engine";
import { Scenario, ScenarioUpsert, api } from "../src/index";

describe("contract", () => {
  test("Scenario schema round-trips", () => {
    const scenario = {
      id: "abc",
      name: "Min strategi",
      input: defaultScenarioInput,
      engineVersion: 1,
      createdAt: "2026-07-02T00:00:00.000Z",
      updatedAt: "2026-07-02T00:00:00.000Z",
    };
    expect(Schema.decodeUnknownSync(Scenario)(scenario).name).toBe("Min strategi");
  });

  test("ScenarioUpsert validates", () => {
    const ok = Schema.decodeUnknownSync(ScenarioUpsert)({
      name: "x",
      input: defaultScenarioInput,
    });
    expect(ok.name).toBe("x");
  });

  test("api exposes the scenarios group", () => {
    expect(api.groups.scenarios).toBeDefined();
  });
});
```

- [ ] **Step 3: Run to verify failure** — `bun install && bun test packages/contract` FAILs (missing src).

- [ ] **Step 4: Implement `packages/contract/src/index.ts`**

```ts
import { Context, Schema } from "effect";
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  HttpApiMiddleware,
} from "effect/unstable/httpapi";
import { ScenarioInput } from "@sparstrategi/engine";

export const Scenario = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  input: ScenarioInput,
  engineVersion: Schema.Number,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type Scenario = typeof Scenario.Type;

export const ScenarioUpsert = Schema.Struct({
  name: Schema.String,
  input: ScenarioInput,
});
export type ScenarioUpsert = typeof ScenarioUpsert.Type;

export interface CurrentUserShape {
  readonly id: string;
  readonly email: string;
}
export class CurrentUser extends Context.Service<CurrentUser, CurrentUserShape>()(
  "CurrentUser",
) {}

export class AuthMiddleware extends HttpApiMiddleware.Service<
  AuthMiddleware,
  { provides: CurrentUser }
>()("AuthMiddleware", { error: HttpApiError.Unauthorized }) {}

const scenarios = HttpApiGroup.make("scenarios")
  .add(
    HttpApiEndpoint.get("list", "/scenarios", {
      success: Schema.Array(Scenario),
    }),
    HttpApiEndpoint.post("create", "/scenarios", {
      payload: ScenarioUpsert,
      success: Scenario,
    }),
    HttpApiEndpoint.put("update", "/scenarios/:id", {
      params: { id: Schema.String },
      payload: ScenarioUpsert,
      success: Scenario,
      error: HttpApiError.NotFound,
    }),
    HttpApiEndpoint.delete("remove", "/scenarios/:id", {
      params: { id: Schema.String },
      error: HttpApiError.NotFound,
    }),
  )
  .middleware(AuthMiddleware);

export const api = HttpApi.make("sparstrategi").add(scenarios).prefix("/api");
```

Note: exact generic shapes for `Context.Service`/`HttpApiMiddleware.Service` were verified against beta.93 (`class X extends Context.Service<X, Shape>()("Key") {}`). If tsc complains, inspect `node_modules/effect/dist/unstable/httpapi/HttpApiMiddleware.d.ts` — do not fall back to v3 `HttpApiMiddleware.Tag`.

- [ ] **Step 5: Run tests + typecheck** — `bun test packages/contract` PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/contract bun.lock
git commit -m "feat(contract): shared HttpApi definition for scenarios"
```

---

### Task 8: Better-Auth on bun:sqlite (drop Drizzle adapter)

**Files:**
- Modify: `packages/auth/src/index.ts`
- Modify: `packages/auth/package.json`

**Interfaces:**
- Consumes: `env` from `@sparstrategi/env/server` (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGIN`).
- Produces: `auth` export (unchanged name — server and CLI use it). Auth tables now live in the same SQLite file as app data.

- [ ] **Step 1: Rewrite `packages/auth/src/index.ts`**

```ts
import { Database } from "bun:sqlite";
import { env } from "@sparstrategi/env/server";
import { betterAuth } from "better-auth";

export function createAuth() {
  return betterAuth({
    database: new Database(env.DATABASE_URL),
    trustedOrigins: [env.CORS_ORIGIN],
    emailAndPassword: {
      enabled: true,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
    plugins: [],
  });
}

export const auth = createAuth();
```

- [ ] **Step 2: Update `packages/auth/package.json`**

Remove the `@sparstrategi/db` dependency. Add script:

```json
"auth:migrate": "bunx @better-auth/cli@latest migrate --config src/index.ts -y"
```

Ensure `@types/bun` is in devDependencies (needed for `bun:sqlite` types).

- [ ] **Step 3: Check `apps/server/.env`**

Read it. Ensure `DATABASE_URL` is a plain file path (e.g. `../../local.db` or absolute). If it is a `file:` URL (Drizzle style), strip the `file:` prefix — `bun:sqlite` and `SqliteClient` want plain paths. The web/env `VITE_SERVER_URL` should be `http://localhost:3000`.

- [ ] **Step 4: Run the Better-Auth migration**

Run: `cd packages/auth && bun run auth:migrate`
Expected: creates `user`, `session`, `account`, `verification` tables in the SQLite file. Verify: `bunx bun -e "const {Database}=require('bun:sqlite');console.log(new Database(process.env.DATABASE_URL ?? 'local.db').query(\"SELECT name FROM sqlite_master WHERE type='table'\").all())"` or simply `sqlite3 <db> .tables`.
If the CLI can't load the TS config (env import), fallback: create `packages/auth/auth-cli.ts` that sets the env vars inline and re-exports `auth`, and point `--config` at it.

- [ ] **Step 5: Typecheck workspace** — `bun run check-types`. `packages/db` still exists and compiles on its own; nothing imports the removed adapter anymore except `packages/db` itself.

- [ ] **Step 6: Commit**

```bash
git add packages/auth apps/server/.env
git commit -m "feat(auth): better-auth directly on bun:sqlite, drop drizzle adapter"
```

---

### Task 9: Effect server (`apps/server`)

**Files:**
- Create: `apps/server/src/db.ts`
- Create: `apps/server/src/scenario-repo.ts`
- Create: `apps/server/src/auth-middleware.ts`
- Create: `apps/server/src/http.ts`
- Modify: `apps/server/src/index.ts` (full rewrite)
- Modify: `apps/server/package.json`
- Test: `apps/server/test/api.test.ts`

**Interfaces:**
- Consumes: `api`, `AuthMiddleware`, `CurrentUser`, `Scenario`, `ScenarioUpsert` from `@sparstrategi/contract`; `ENGINE_VERSION`, `ScenarioInput` from `@sparstrategi/engine`; `auth` from `@sparstrategi/auth`.
- Produces: HTTP server on port 3000 with `/api/scenarios*`, `/api/auth/*`, CORS for the web origin. Exports from `http.ts`: `AppLayer` (all routes merged, for tests via `HttpRouter.toWebHandler`) and `ScenarioRepo`.

- [ ] **Step 1: Update `apps/server/package.json`**

Dependencies become:

```json
"dependencies": {
  "@effect/platform-bun": "catalog:",
  "@effect/sql-sqlite-bun": "catalog:",
  "@sparstrategi/auth": "workspace:*",
  "@sparstrategi/contract": "workspace:*",
  "@sparstrategi/engine": "workspace:*",
  "@sparstrategi/env": "workspace:*",
  "dotenv": "catalog:",
  "drizzle-orm": "catalog:",
  "effect": "catalog:"
}
```

(Remove `@hono/trpc-server`, `@sparstrategi/api`, `@sparstrategi/db`, `@trpc/server`, `better-auth`, `hono`, `zod`.) Add `"test": "bun test"` to scripts. Run `bun install`.

- [ ] **Step 2: Create `apps/server/src/db.ts` (SqliteClient layer + Drizzle table schema + DDL init)**

```ts
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { env } from "@sparstrategi/env/server";

export const SqlLive = SqliteClient.layer({ filename: env.DATABASE_URL });

/** Drizzle table definition — single source of truth for queries. */
export const scenarioTable = sqliteTable("scenario", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  inputJson: text("input_json").notNull(),
  engineVersion: integer("engine_version").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

const createTables = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
    CREATE TABLE IF NOT EXISTS scenario (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      input_json TEXT NOT NULL,
      engine_version INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;
  yield* sql`CREATE INDEX IF NOT EXISTS scenario_user_idx ON scenario (user_id)`;
});

/** Side-effect layer: ensures app tables exist. */
export const DbInit = Layer.effectDiscard(createTables);
```

If `Layer.effectDiscard` doesn't exist in beta.93, check `node_modules/effect/dist/Layer.d.ts` for the discard variant name (`effectDiscard` existed in v3; likely unchanged). Worst case: run `createTables` inside the repo layer construction. (DDL stays hand-written for the single table — no drizzle-kit in v1.)

- [ ] **Step 3: Create `apps/server/src/scenario-repo.ts` (Drizzle Effect query builder)**

Drizzle 1.0 RC's Effect integration: `makeWithDefaults()` from `drizzle-orm/effect-sqlite-bun` yields an Effect-native Drizzle database. It requires the `SqliteClient` service (provided by `SqlLive`); every query returns an `Effect` failing with typed `EffectDrizzleQueryError` — we `orDie` those (a broken SQLite file is a defect, not a domain error).

```ts
import { Context, Effect, Layer, Schema } from "effect";
import { and, desc, eq } from "drizzle-orm";
import { makeWithDefaults } from "drizzle-orm/effect-sqlite-bun";
import { Scenario, ScenarioUpsert } from "@sparstrategi/contract";
import { ENGINE_VERSION, ScenarioInput } from "@sparstrategi/engine";
import { scenarioTable } from "./db";

const decodeInput = Schema.decodeUnknownSync(ScenarioInput);

type ScenarioRow = typeof scenarioTable.$inferSelect;

const rowToScenario = (row: ScenarioRow): Scenario => ({
  id: row.id,
  name: row.name,
  input: decodeInput(JSON.parse(row.inputJson)),
  engineVersion: row.engineVersion,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export interface ScenarioRepoShape {
  readonly list: (userId: string) => Effect.Effect<ReadonlyArray<Scenario>>;
  readonly create: (userId: string, data: ScenarioUpsert) => Effect.Effect<Scenario>;
  readonly update: (
    userId: string,
    id: string,
    data: ScenarioUpsert,
  ) => Effect.Effect<Scenario | null>;
  readonly remove: (userId: string, id: string) => Effect.Effect<boolean>;
}

export class ScenarioRepo extends Context.Service<ScenarioRepo, ScenarioRepoShape>()(
  "ScenarioRepo",
) {}

export const ScenarioRepoLive = Layer.effect(ScenarioRepo)(
  Effect.gen(function* () {
    const db = yield* makeWithDefaults();

    const list: ScenarioRepoShape["list"] = (userId) =>
      db
        .select()
        .from(scenarioTable)
        .where(eq(scenarioTable.userId, userId))
        .orderBy(desc(scenarioTable.updatedAt))
        .pipe(
          Effect.map((rows) => rows.map(rowToScenario)),
          Effect.orDie,
        );

    const create: ScenarioRepoShape["create"] = (userId, data) =>
      Effect.gen(function* () {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        yield* db.insert(scenarioTable).values({
          id,
          userId,
          name: data.name,
          inputJson: JSON.stringify(data.input),
          engineVersion: ENGINE_VERSION,
          createdAt: now,
          updatedAt: now,
        });
        return {
          id,
          name: data.name,
          input: data.input,
          engineVersion: ENGINE_VERSION,
          createdAt: now,
          updatedAt: now,
        } satisfies Scenario;
      }).pipe(Effect.orDie);

    const update: ScenarioRepoShape["update"] = (userId, id, data) =>
      Effect.gen(function* () {
        const now = new Date().toISOString();
        yield* db
          .update(scenarioTable)
          .set({
            name: data.name,
            inputJson: JSON.stringify(data.input),
            engineVersion: ENGINE_VERSION,
            updatedAt: now,
          })
          .where(and(eq(scenarioTable.id, id), eq(scenarioTable.userId, userId)));
        const rows = yield* db
          .select()
          .from(scenarioTable)
          .where(and(eq(scenarioTable.id, id), eq(scenarioTable.userId, userId)));
        return rows.length > 0 ? rowToScenario(rows[0]!) : null;
      }).pipe(Effect.orDie);

    const remove: ScenarioRepoShape["remove"] = (userId, id) =>
      Effect.gen(function* () {
        const existing = yield* db
          .select({ id: scenarioTable.id })
          .from(scenarioTable)
          .where(and(eq(scenarioTable.id, id), eq(scenarioTable.userId, userId)));
        if (existing.length === 0) return false;
        yield* db
          .delete(scenarioTable)
          .where(and(eq(scenarioTable.id, id), eq(scenarioTable.userId, userId)));
        return true;
      }).pipe(Effect.orDie);

    return { list, create, update, remove } satisfies ScenarioRepoShape;
  }),
);
```

Notes: `Layer.effect(Key)(effect)` is curried in v4 like `Layer.succeed`. If a drizzle Effect query builder isn't directly pipeable, wrap it: `Effect.suspend(() => query)` — check `node_modules/drizzle-orm/sqlite-core/effect/select.d.ts` for whether builders implement the Effect interface (they expose HKT `EffectSQLiteBunQueryEffectHKT`; the builder itself should be yieldable/pipeable).

- [ ] **Step 4: Create `apps/server/src/auth-middleware.ts`**

```ts
import { Effect, Layer } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { HttpApiError } from "effect/unstable/httpapi";
import { AuthMiddleware, CurrentUser } from "@sparstrategi/contract";
import { auth } from "@sparstrategi/auth";

const toHeaders = (raw: Record<string, string | ReadonlyArray<string> | undefined>) => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(", "));
  }
  return headers;
};

export const AuthMiddlewareLive = Layer.succeed(AuthMiddleware)(
  Effect.fnUntraced(function* (httpEffect) {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const session = yield* Effect.promise(() =>
      auth.api.getSession({ headers: toHeaders(request.headers) }),
    );
    if (!session) {
      return yield* Effect.fail(new HttpApiError.Unauthorized());
    }
    return yield* Effect.provideService(httpEffect, CurrentUser, {
      id: session.user.id,
      email: session.user.email,
    });
  }),
);
```

- [ ] **Step 5: Create `apps/server/src/http.ts`**

```ts
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";
import { api, CurrentUser } from "@sparstrategi/contract";
import { auth } from "@sparstrategi/auth";
import { env } from "@sparstrategi/env/server";
import { DbInit, SqlLive } from "./db";
import { AuthMiddlewareLive } from "./auth-middleware";
import { ScenarioRepo, ScenarioRepoLive } from "./scenario-repo";

const ScenariosHandlers = HttpApiBuilder.group(api, "scenarios", (handlers) =>
  handlers
    .handle("list", () =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;
        const repo = yield* ScenarioRepo;
        return yield* repo.list(user.id);
      }),
    )
    .handle("create", ({ payload }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;
        const repo = yield* ScenarioRepo;
        return yield* repo.create(user.id, payload);
      }),
    )
    .handle("update", ({ params, payload }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;
        const repo = yield* ScenarioRepo;
        const updated = yield* repo.update(user.id, params.id, payload);
        if (updated === null) return yield* Effect.fail(new HttpApiError.NotFound());
        return updated;
      }),
    )
    .handle("remove", ({ params }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;
        const repo = yield* ScenarioRepo;
        const removed = yield* repo.remove(user.id, params.id);
        if (!removed) return yield* Effect.fail(new HttpApiError.NotFound());
      }),
    ),
);

const ApiLayer = HttpApiBuilder.layer(api).pipe(
  Layer.provide(ScenariosHandlers),
  Layer.provide(AuthMiddlewareLive),
  Layer.provide(ScenarioRepoLive),
);

const BetterAuthRoute = HttpRouter.add(
  "*",
  "/api/auth/*",
  Effect.fnUntraced(function* (request: HttpServerRequest.HttpServerRequest) {
    const webRequest = yield* HttpServerRequest.toWeb(request);
    const response = yield* Effect.promise(() => auth.handler(webRequest));
    return HttpServerResponse.fromWeb(response);
  }),
);

const HealthRoute = HttpRouter.add("GET", "/", () =>
  Effect.succeed(HttpServerResponse.text("OK")),
);

const CorsLayer = HttpRouter.cors({
  allowedOrigins: [env.CORS_ORIGIN],
  allowedMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});

export { ScenarioRepo, ScenarioRepoLive };

export const AppLayer = Layer.mergeAll(
  ApiLayer,
  BetterAuthRoute,
  HealthRoute,
  CorsLayer,
).pipe(Layer.provide(DbInit), Layer.provide(SqlLive));
```

(Exact `HttpRouter.cors` option names: verify against `node_modules/effect/dist/unstable/http/HttpRouter.d.ts` — the research run confirmed `{ allowedOrigins, credentials }` work; add methods/headers keys per the d.ts.)

- [ ] **Step 6: Rewrite `apps/server/src/index.ts`**

```ts
import { Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { AppLayer } from "./http";

const ServerLayer = HttpRouter.serve(AppLayer).pipe(
  Layer.provide(BunHttpServer.layer({ port: 3000 })),
);

BunRuntime.runMain(Layer.launch(ServerLayer));
```

- [ ] **Step 7: Write test `apps/server/test/api.test.ts`**

Uses `HttpRouter.toWebHandler`. Two layers under test: real stack minus auth (fake middleware injecting a user) for CRUD; real middleware for the 401 case. In-memory SQLite.

```ts
import { afterAll, describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { SqlClient } from "effect/unstable/sql";
import { api, AuthMiddleware, CurrentUser } from "@sparstrategi/contract";
import { defaultScenarioInput } from "@sparstrategi/engine";

// Import the handler group + repo from http.ts — restructure http.ts if needed so
// ScenariosHandlers is exported for tests.
import { ScenariosHandlers } from "../src/http";
import { ScenarioRepoLive } from "../src/scenario-repo";

const TestSql = SqliteClient.layer({ filename: ":memory:" });

const TestDbInit = Layer.effectDiscard(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE IF NOT EXISTS scenario (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
      input_json TEXT NOT NULL, engine_version INTEGER NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`;
  }),
);

const FakeAuth = Layer.succeed(AuthMiddleware)(
  Effect.fnUntraced(function* (httpEffect) {
    return yield* Effect.provideService(httpEffect, CurrentUser, {
      id: "test-user",
      email: "test@example.com",
    });
  }),
);

const TestApi = HttpApiBuilder.layer(api).pipe(
  Layer.provide(ScenariosHandlers),
  Layer.provide(FakeAuth),
  Layer.provide(ScenarioRepoLive),
  Layer.provide(TestDbInit),
  Layer.provide(TestSql),
);

const { handler, dispose } = HttpRouter.toWebHandler(TestApi);
afterAll(() => dispose());

describe("scenario API", () => {
  test("create → list → update → delete", async () => {
    const created = await handler(
      new Request("http://test/api/scenarios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Bas", input: defaultScenarioInput }),
      }),
    );
    expect(created.status).toBe(200);
    const scenario = (await created.json()) as { id: string; name: string };
    expect(scenario.name).toBe("Bas");

    const list = await handler(new Request("http://test/api/scenarios"));
    expect(list.status).toBe(200);
    expect(((await list.json()) as unknown[]).length).toBe(1);

    const updated = await handler(
      new Request(`http://test/api/scenarios/${scenario.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Bas 2", input: defaultScenarioInput }),
      }),
    );
    expect(updated.status).toBe(200);

    const removed = await handler(
      new Request(`http://test/api/scenarios/${scenario.id}`, { method: "DELETE" }),
    );
    expect(removed.status).toBe(204);

    const missing = await handler(
      new Request(`http://test/api/scenarios/${scenario.id}`, { method: "DELETE" }),
    );
    expect(missing.status).toBe(404);
  });

  test("invalid payload → 400", async () => {
    const res = await handler(
      new Request("http://test/api/scenarios", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: 42 }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
```

Export `ScenariosHandlers` from `http.ts` to make this work. A separate 401 test with the REAL middleware requires env + auth tables; cover that in the manual smoke instead (Step 9).

- [ ] **Step 8: Run tests + typecheck**

Run: `cd apps/server && bun test && bun run check-types`
Expected: PASS. (`check-types` script is `tsc -b`; if project refs to removed packages linger in `tsconfig.json`, update its `references`.)

- [ ] **Step 9: Manual smoke**

Run: `bun run dev:server`, then:
- `curl -i http://localhost:3000/` → `200 OK`
- `curl -i http://localhost:3000/api/scenarios` → `401` (real middleware, no session)
- `curl -i http://localhost:3000/api/auth/ok` or sign-up via better-auth endpoint → responds (any non-500)
Kill the server.

- [ ] **Step 10: Commit**

```bash
git add apps/server bun.lock
git commit -m "feat(server): Effect v4 HttpApi server with auth middleware and sqlite repo"
```

---

### Task 10: Web plumbing — Effect client, remove tRPC wiring

**Files:**
- Create: `apps/web/src/lib/api-client.ts`
- Create: `apps/web/src/lib/format.ts`
- Delete: `apps/web/src/utils/trpc.ts`
- Modify: `apps/web/src/main.tsx`, `apps/web/src/routes/__root.tsx`, `apps/web/src/routes/_auth/dashboard.tsx` (drop trpc usage), `apps/web/package.json`
- Test: `apps/web/src/lib/format.test.ts`

**Interfaces:**
- Produces:
  - `ApiClient` class (`AtomHttpApi.Service`) — atoms: `scenariosAtom` (query list), `createScenarioAtom`, `updateScenarioAtom`, `removeScenarioAtom` (mutations), all with `reactivityKeys: ["scenarios"]`.
  - `fmtKr(value: number): string` — auto-scale: `< 1e4` → `"1 234 kr"`, `< 1e6` → `"12,3 tkr"`, `< 1e9` → `"45,7 Mkr"`, else `"6,39 Mdr kr"`. `fmtPct(value: number): string` → `"7,0 %"`. sv-SE separators (non-breaking space thousands, comma decimals).

- [ ] **Step 1: Update `apps/web/package.json`**

Remove: `@sparstrategi/api`, `@trpc/client`, `@trpc/server`, `@trpc/tanstack-react-query`, `@tanstack/react-query`, `@tanstack/react-query-devtools`.
Add to dependencies: `"@effect/atom-react": "catalog:"`, `"@sparstrategi/contract": "workspace:*"`, `"@sparstrategi/engine": "workspace:*"`, `"effect": "catalog:"`, `"recharts": "catalog:"`.
Run `bun install`.

- [ ] **Step 2: Write failing test `apps/web/src/lib/format.test.ts`**

```ts
import { describe, expect, test } from "bun:test";
import { fmtKr, fmtPct } from "./format";

describe("fmtKr", () => {
  test("small amounts in kr", () => {
    expect(fmtKr(1234)).toBe("1 234 kr");
  });
  test("thousands as tkr", () => {
    expect(fmtKr(12_300)).toBe("12,3 tkr");
  });
  test("millions as Mkr", () => {
    expect(fmtKr(45_700_000)).toBe("45,7 Mkr");
  });
  test("billions as Mdr", () => {
    expect(fmtKr(6_388_000_000)).toBe("6,39 Mdr kr");
  });
});

describe("fmtPct", () => {
  test("formats decimal fraction with sv-SE comma", () => {
    expect(fmtPct(0.07)).toBe("7,0 %");
  });
});
```

Note: `Intl` with `sv-SE` uses U+00A0/U+202F as group separator — write the implementation with explicit separators to keep tests deterministic (see Step 4).

- [ ] **Step 3: Run to verify failure** — `cd apps/web && bun test src/lib/format.test.ts` FAILs.

- [ ] **Step 4: Implement `apps/web/src/lib/format.ts`**

```ts
const group = (n: number, decimals: number): string => {
  const fixed = n.toFixed(decimals);
  const [int, frac] = fixed.split(".");
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return frac ? `${grouped},${frac}` : grouped;
};

export const fmtKr = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${group(value / 1e9, 2)} Mdr kr`;
  if (abs >= 1e6) return `${group(value / 1e6, 1)} Mkr`;
  if (abs >= 1e4) return `${group(value / 1e3, 1)} tkr`;
  return `${group(value, 0)} kr`;
};

export const fmtPct = (value: number): string => `${group(value * 100, 1)} %`;
```

(Adjust test expectations to U+00A0 spaces: `"1 234 kr"` — write both test and impl with ` `.)

- [ ] **Step 5: Implement `apps/web/src/lib/api-client.ts`**

```ts
import { Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { AtomHttpApi } from "effect/unstable/reactivity";
import { api } from "@sparstrategi/contract";
import { env } from "@sparstrategi/env/web";

export class ApiClient extends AtomHttpApi.Service<ApiClient>()("ApiClient", {
  api,
  baseUrl: env.VITE_SERVER_URL,
  httpClient: FetchHttpClient.layer.pipe(
    Layer.provide(
      Layer.succeed(FetchHttpClient.RequestInit)({ credentials: "include" }),
    ),
  ),
}) {}

export const scenariosAtom = ApiClient.query("scenarios", "list", {
  reactivityKeys: ["scenarios"],
});
export const createScenarioAtom = ApiClient.mutation("scenarios", "create");
export const updateScenarioAtom = ApiClient.mutation("scenarios", "update");
export const removeScenarioAtom = ApiClient.mutation("scenarios", "remove");
```

- [ ] **Step 6: De-tRPC the app shell**

- `apps/web/src/main.tsx`: remove `QueryClientProvider`, `queryClient`, `trpc` imports and the `Wrap`/`context` options. Router becomes:

```tsx
import { RouterProvider, createRouter } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import Loader from "./components/loader";
import { routeTree } from "./routeTree.gen";

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
  defaultPendingComponent: () => <Loader />,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("app");
if (!rootElement) throw new Error("Root element not found");
if (!rootElement.innerHTML) {
  ReactDOM.createRoot(rootElement).render(<RouterProvider router={router} />);
}
```

(`@effect/atom-react` uses a global default registry — no provider needed.)

- `apps/web/src/routes/__root.tsx`: remove `RouterAppContext`, react-query devtools, `createRootRouteWithContext` → `createRootRoute`. Set title meta to `"Sparstrategi"` and description to `"Simulator för belånad portföljstrategi med svensk skatteoptimering"`.
- `apps/web/src/routes/_auth/dashboard.tsx`: replace any trpc call with a plain placeholder (this route becomes the scenarios page in Task 11c — for now just render the user's email from the existing auth client pattern).
- Delete `apps/web/src/utils/trpc.ts`.

- [ ] **Step 7: Typecheck + dev smoke**

Run: `cd apps/web && bun run check-types` (this runs `vite build && tsc`). Expected: PASS.
Run `bun run dev` from root; open http://localhost:5173 (or the Vite port) — app renders, login page works against the Effect server (sign up a user, verify session cookie set, dashboard renders email).

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "feat(web): effect atom API client, remove tRPC/react-query wiring"
```

---

### Task 11a: Simulator state atoms + input panel + KPI row

**Files:**
- Create: `apps/web/src/state/simulator.ts`
- Create: `apps/web/src/components/simulator/input-panel.tsx`
- Create: `apps/web/src/components/simulator/kpi-row.tsx`
- Modify: `apps/web/src/routes/index.tsx`
- Test: `apps/web/src/state/simulator.test.ts`

**Interfaces:**
- Consumes: engine (`simulate`, `evaluateGoals`, `stressTest`, `defaultScenarioInput`, schemas), `@effect/atom-react` hooks, `fmtKr`/`fmtPct`.
- Produces:
  - `inputAtom: Atom.Writable<ScenarioInput>` (initialized from URL param `s` if present)
  - `simulationAtom: Atom<SimulationResult>` (derived)
  - `goalResultsAtom: Atom<ReadonlyArray<GoalResult>>` (derived)
  - `stressSettingsAtom: Atom.Writable<{ crashPct: number; crashYear: number } | null>`
  - `stressResultAtom: Atom<StressResult | null>` (derived)
  - `shareUrl(input: ScenarioInput): string` — current origin + `/?s=<base64url JSON>`
  - `parseShared(s: string): ScenarioInput | null` — base64url decode + Schema validation, null on any failure

- [ ] **Step 1: Write failing test `apps/web/src/state/simulator.test.ts`**

```ts
import { describe, expect, test } from "bun:test";
import { defaultScenarioInput } from "@sparstrategi/engine";
import { parseShared, serializeShared } from "./simulator";

describe("share-url round trip", () => {
  test("serialize → parse returns the same input", () => {
    const s = serializeShared({ ...defaultScenarioInput, startCapital: 2_500_000 });
    const parsed = parseShared(s);
    expect(parsed?.startCapital).toBe(2_500_000);
  });

  test("garbage returns null", () => {
    expect(parseShared("not-base64-json")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**, then implement `apps/web/src/state/simulator.ts`

```ts
import { Schema } from "effect";
import { Atom } from "effect/unstable/reactivity";
import {
  ScenarioInput,
  defaultScenarioInput,
  evaluateGoals,
  simulate,
  stressTest,
  type GoalResult,
  type SimulationResult,
  type StressResult,
} from "@sparstrategi/engine";

const decodeInput = Schema.decodeUnknownSync(ScenarioInput);

export const serializeShared = (input: ScenarioInput): string =>
  btoa(encodeURIComponent(JSON.stringify(input)));

export const parseShared = (s: string): ScenarioInput | null => {
  try {
    return decodeInput(JSON.parse(decodeURIComponent(atob(s))));
  } catch {
    return null;
  }
};

export const shareUrl = (input: ScenarioInput): string =>
  `${window.location.origin}/?s=${serializeShared(input)}`;

const initialInput = (): ScenarioInput => {
  if (typeof window === "undefined") return defaultScenarioInput;
  const s = new URLSearchParams(window.location.search).get("s");
  return (s && parseShared(s)) || defaultScenarioInput;
};

export const inputAtom = Atom.make(initialInput());

export const simulationAtom: Atom.Atom<SimulationResult> = Atom.make((get) =>
  simulate(get(inputAtom)),
);

export const goalResultsAtom: Atom.Atom<ReadonlyArray<GoalResult>> = Atom.make(
  (get) => evaluateGoals(get(inputAtom), get(simulationAtom)),
);

export const stressSettingsAtom = Atom.make<{
  crashPct: number;
  crashYear: number;
} | null>(null);

export const stressResultAtom: Atom.Atom<StressResult | null> = Atom.make((get) => {
  const settings = get(stressSettingsAtom);
  return settings ? stressTest(get(inputAtom), settings) : null;
});
```

(If `Atom.make` derived signature differs, the research confirmed `Atom.make((get) => ...)` works on beta.93. `btoa` handles the encodeURIComponent'd ASCII safely for Swedish characters.)

- [ ] **Step 3: Run test** — `cd apps/web && bun test src/state` PASS. (The test imports only pure helpers; if `window` access at module scope breaks bun test, guard as shown with `typeof window`.)

- [ ] **Step 4: Build input panel `apps/web/src/components/simulator/input-panel.tsx`**

Controlled fields bound to `useAtom(inputAtom)`. Layout: stacked labeled fields; sliders paired with numeric inputs for: startkapital (0–100 Mkr log-ish steps: use numeric input + range 0–20 Mkr), månadssparande (0–100 tkr), belåningsgrad targetLtv (0–60 %), låneränta (0–10 %), förväntad avkastning (0–15 %), levnadskostnader/mån (0–200 tkr), horisont (1–50 år). Collapsible "Avancerat (skatteparametrar)" section (native `<details>`): SLR, fribelopp, avdrag berättigat (checkbox), brytpunkt, avdragssatser, max belåningsgrad. Every field writes through `setInput({ ...input, field: value })`; percent fields divide by 100 on write, multiply on read. Use `Label`, `Input`, `Checkbox` from `@sparstrategi/ui` and Tailwind classes consistent with existing components (`sign-in-form.tsx` shows the codebase's form idiom).

Complete component skeleton (fill all listed fields following this exact pattern):

```tsx
import { useAtom } from "@effect/atom-react";
import { Input } from "@sparstrategi/ui/components/input";
import { Label } from "@sparstrategi/ui/components/label";
import { Checkbox } from "@sparstrategi/ui/components/checkbox";
import { inputAtom } from "@/state/simulator";

function NumberField(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{props.label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={Number.isFinite(props.value) ? +props.value.toFixed(4) : 0}
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          onChange={(e) => props.onChange(Number(e.target.value))}
        />
        {props.suffix ? (
          <span className="text-xs text-muted-foreground">{props.suffix}</span>
        ) : null}
      </div>
      {props.min !== undefined && props.max !== undefined ? (
        <input
          type="range"
          className="w-full accent-primary"
          value={props.value}
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          onChange={(e) => props.onChange(Number(e.target.value))}
        />
      ) : null}
    </div>
  );
}

export function InputPanel() {
  const [input, setInput] = useAtom(inputAtom);
  const set = <K extends keyof typeof input>(key: K, value: (typeof input)[K]) =>
    setInput({ ...input, [key]: value });
  const setTax = <K extends keyof typeof input.taxParams>(
    key: K,
    value: (typeof input.taxParams)[K],
  ) => setInput({ ...input, taxParams: { ...input.taxParams, [key]: value } });

  return (
    <aside className="space-y-4">
      <NumberField label="Startkapital (kr)" value={input.startCapital}
        onChange={(v) => set("startCapital", v)} min={0} max={20_000_000} step={50_000} />
      <NumberField label="Månadssparande (kr)" value={input.monthlySavings}
        onChange={(v) => set("monthlySavings", v)} min={0} max={100_000} step={500} />
      <NumberField label="Belåningsgrad (%)" value={input.targetLtv * 100}
        onChange={(v) => set("targetLtv", v / 100)} min={0} max={60} step={1} suffix="%" />
      <NumberField label="Låneränta (%)" value={input.loanRate * 100}
        onChange={(v) => set("loanRate", v / 100)} min={0} max={10} step={0.1} suffix="%" />
      <NumberField label="Förväntad avkastning (%)" value={input.expectedReturn * 100}
        onChange={(v) => set("expectedReturn", v / 100)} min={0} max={15} step={0.1} suffix="%" />
      <NumberField label="Levnadskostnader (kr/mån)" value={input.monthlyLivingCosts}
        onChange={(v) => set("monthlyLivingCosts", v)} min={0} max={200_000} step={1_000} />
      <NumberField label="Horisont (år)" value={input.horizonYears}
        onChange={(v) => set("horizonYears", Math.max(1, Math.round(v)))} min={1} max={50} />

      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Avancerat (skatteparametrar)
        </summary>
        <div className="mt-3 space-y-3">
          <NumberField label="Statslåneränta (%)" value={input.taxParams.slr * 100}
            onChange={(v) => setTax("slr", v / 100)} step={0.01} suffix="%" />
          <NumberField label="ISK fribelopp (kr)" value={input.taxParams.iskFreeAmount}
            onChange={(v) => setTax("iskFreeAmount", v)} step={10_000} />
          <div className="flex items-center gap-2">
            <Checkbox
              checked={input.taxParams.deductionEligible}
              onCheckedChange={(c) => setTax("deductionEligible", c === true)}
            />
            <Label className="text-xs">Ränteavdrag (lån med säkerhet)</Label>
          </div>
          <NumberField label="Max belåningsgrad (%)" value={input.maxLtv * 100}
            onChange={(v) => set("maxLtv", v / 100)} min={0} max={90} suffix="%" />
        </div>
      </details>
    </aside>
  );
}
```

- [ ] **Step 5: Build KPI row `apps/web/src/components/simulator/kpi-row.tsx`**

```tsx
import { useAtomValue } from "@effect/atom-react";
import { fmtKr, fmtPct } from "@/lib/format";
import { simulationAtom } from "@/state/simulator";

function Kpi(props: { label: string; value: string; note?: string; tone?: "green" | "amber" | "accent" }) {
  const toneClass =
    props.tone === "green" ? "text-emerald-400"
    : props.tone === "amber" ? "text-amber-400"
    : props.tone === "accent" ? "text-indigo-400"
    : "";
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{props.label}</div>
      <div className={`text-2xl font-bold ${toneClass}`}>{props.value}</div>
      {props.note ? <div className="mt-1 text-xs text-muted-foreground">{props.note}</div> : null}
    </div>
  );
}

export function KpiRow() {
  const sim = useAtomValue(simulationAtom);
  const y1 = sim.rows[1];
  const last = sim.rows.at(-1);
  if (!y1 || !last) return null;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Kpi label="Total portfölj" value={fmtKr(sim.calibration.initialPortfolio)} tone="accent"
        note={`Lån ${fmtKr(sim.calibration.initialLoan)}`} />
      <Kpi label="Tillväxt år 1" value={fmtKr(y1.growth)} tone="green" />
      <Kpi label="Effektiv skatt år 1" value={fmtPct(y1.effectiveTaxRate)}
        tone={y1.effectiveTaxRate === 0 ? "green" : "amber"} />
      <Kpi label={`Förmögenhet år ${last.year}`} value={fmtKr(last.equity)} tone="green"
        note={`Belåningsgrad ${fmtPct(last.ltv)}`} />
    </div>
  );
}
```

- [ ] **Step 6: Wire `apps/web/src/routes/index.tsx`**

Replace its content with a two-column simulator layout: `InputPanel` left (fixed ~320px), right column stacking `KpiRow` and placeholders (`<div id="charts-slot" />`) that Tasks 11b/11c fill. Show infeasibility warnings from `sim.warnings` as an amber callout above the KPIs.

- [ ] **Step 7: Verify in browser**

`bun run dev` → adjust sliders, KPI values update instantly. Feed the document numbers (startkapital 5 000 000 000 via the numeric input, LTV 16.7%, ränta 3%, avkastning 7%, levnadskostnader 166 667 kr/mån, Avancerat: fribelopp 0, brytpunkt 0) and confirm the KPI row shows ~0% effective tax.

- [ ] **Step 8: Typecheck + commit**

```bash
cd apps/web && bun run check-types
git add apps/web
git commit -m "feat(web): live simulator state, input panel and KPI row"
```

---

### Task 11b: Charts + projection table + tax card

**Files:**
- Create: `apps/web/src/components/simulator/allocation-chart.tsx`
- Create: `apps/web/src/components/simulator/projection-chart.tsx`
- Create: `apps/web/src/components/simulator/projection-table.tsx`
- Create: `apps/web/src/components/simulator/tax-card.tsx`
- Create: `apps/web/src/components/simulator/cashflow-card.tsx`
- Modify: `apps/web/src/routes/index.tsx`

**Interfaces:**
- Consumes: `simulationAtom`, `inputAtom`, `fmtKr`, `fmtPct`, Recharts.
- Produces: presentational components, no new state.

**IMPORTANT: invoke the `dataviz` skill before writing any chart code in this task.** Palette anchor (from the source document, works on the dark theme): AF `#34d399`, ISK `#818cf8`, total/accent `#6c8cff`, warning `#fbbf24`, negative `#f87171`.

- [ ] **Step 1: Allocation doughnut (`allocation-chart.tsx`)**

Recharts `PieChart` + `Pie` with `innerRadius` ~62%: slices AF (`sim.calibration.initialAf`), ISK (`requiredIsk` clamped), colors above, legend below, tooltip with `fmtKr` + share %. Data from `useAtomValue(simulationAtom)`.

- [ ] **Step 2: Projection chart (`projection-chart.tsx`)**

Recharts `ComposedChart` over `sim.rows`: X = year, areas/lines: Total portfölj (`portfolio`, accent, filled area 8% opacity), AF (`af`, green line), ISK (`isk`, dashed indigo line), Lån (`loan`, thin amber line). Y tick formatter `fmtKr`. Tooltip shows all series `fmtKr`.

- [ ] **Step 3: Projection table (`projection-table.tsx`)**

Columns: År, Portfölj, AF, ISK, Tillväxt, Lån, Belåning, Ränta, Avdrag, Skatt, Eff. skatt. Map over `sim.rows`, `fmtKr`/`fmtPct`, `tabular-nums` class, horizontal scroll wrapper. Highlight netTax 0 rows' Eff. skatt cell green.

- [ ] **Step 4: Tax card (`tax-card.tsx`)**

Year-1 breakdown (like the document's Skatteanalys): ISK-schablonskatt (−, amber), Ränteavdrag (+, green), Netto skattekostnad (bold), Överskjutande skattereduktion. Values from `sim.rows[1]`. Under it, a note when `netTax === 0`: "ISK-schablonskatten nollställs av ränteavdraget."

- [ ] **Step 5: Cashflow card (`cashflow-card.tsx`)**

Year-1 flows as a small Recharts `BarChart`: ISK-avkastning (+`rows[1].withdrawal`... use `isk gain` = `withdrawal` when balanced), Ränta (−interest), Levnadskostnader (−12×monthlyLivingCosts). Positive bar indigo, negative red. Callout underneath: "Kassaflöde ±0 — ISK:s stamkapital förblir intakt" when withdrawal ≈ need, otherwise the erosion warning.

- [ ] **Step 6: Assemble in `routes/index.tsx`**

Order in right column: KpiRow → warnings → grid(AllocationChart | CashflowCard) → ProjectionChart → ProjectionTable → TaxCard. Add a "Dela"-button (copies `shareUrl(input)` to clipboard, `sonner` toast "Länk kopierad").

- [ ] **Step 7: Verify in browser** — document scenario renders the familiar shapes: flat ISK line, compounding AF, 0% tax card. Resize to mobile width; single column.

- [ ] **Step 8: Typecheck + commit**

```bash
cd apps/web && bun run check-types
git add apps/web
git commit -m "feat(web): projection charts, table, tax and cashflow cards"
```

---

### Task 11c: Goals panel + stress-test panel

**Files:**
- Create: `apps/web/src/components/simulator/goals-panel.tsx`
- Create: `apps/web/src/components/simulator/stress-panel.tsx`
- Modify: `apps/web/src/routes/index.tsx`

**Interfaces:**
- Consumes: `inputAtom`, `goalResultsAtom`, `stressSettingsAtom`, `stressResultAtom`, `fmtKr`.

- [ ] **Step 1: Goals panel**

- Add-goal UI: type select (Förmögenhetsmål / Passiv inkomst), amount field, year field (wealth only), "Lägg till" button → appends to `input.goals`.
- Per-goal card from `goalResultsAtom`: wealth → "✓ Uppnått år N" (green) or "✗ Saknas X — kräver Y kr/mån extra" (amber, from `requiredMonthlySavings`); passiveIncome → "Kräver X i ISK-kapital — möjligt från år N" or "Ej möjligt inom horisonten". Remove button per goal (filters `input.goals` by index).

- [ ] **Step 2: Stress panel**

- Controls: crash size buttons (−20% / −30% / −40%) and year select (1..horizon) writing `stressSettingsAtom`; "Återställ" sets null.
- When `stressResultAtom` non-null: show post-crash LTV, margin-call badge (red "MARGIN CALL — tvångsförsäljning X" when `marginCall`, else green "Ingen margin call"), recovery year ("Återhämtad år N"), and a small Recharts line chart comparing stressed `equity` vs base `simulationAtom` equity by year.

- [ ] **Step 3: Add both to `routes/index.tsx`** below the tax card.

- [ ] **Step 4: Verify in browser**

Set LTV 40%, maxLtv 50%, crash −25% year 1 → margin call badge appears (matches engine test boundary). Crash −16% → no margin call. Add wealth goal below current trajectory → achieved; absurdly high → shows required savings.

- [ ] **Step 5: Typecheck + commit**

```bash
cd apps/web && bun run check-types
git add apps/web
git commit -m "feat(web): goal evaluation and crash stress-test panels"
```

---

### Task 11d: Scenarios page (save/load/compare)

**Files:**
- Create: `apps/web/src/routes/_auth/scenarios.tsx`
- Create: `apps/web/src/components/scenarios/compare-chart.tsx`
- Modify: `apps/web/src/routes/index.tsx` (save button), `apps/web/src/components/header.tsx` (nav link "Scenarier"), `apps/web/src/routes/_auth/dashboard.tsx` (redirect to `/scenarios` or delete route + update routeTree by removing the file)

**Interfaces:**
- Consumes: `scenariosAtom`, `createScenarioAtom`, `updateScenarioAtom`, `removeScenarioAtom`, `inputAtom`, engine `simulate`.

- [ ] **Step 1: Save from simulator**

"Spara scenario"-button in `routes/index.tsx`: prompts for a name (small inline popover with an Input, or `window.prompt` for v1), then `useAtomSet(createScenarioAtom)` with `{ payload: { name, input }, reactivityKeys: ["scenarios"] }`. On success toast "Scenario sparat"; on failure (401) toast "Logga in för att spara" with link to `/login`.

- [ ] **Step 2: Scenarios route `_auth/scenarios.tsx`**

- `useAtomValue(scenariosAtom)` → `AsyncResult`: render skeletons on `isInitial`/waiting, list on success, error state otherwise (import `AsyncResult` guards from `effect/unstable/reactivity/AsyncResult`).
- Each row: name, updatedAt, buttons: "Öppna" (sets `inputAtom` via `useAtomSet(inputAtom)` + navigate `/`), "Ta bort" (remove mutation with `reactivityKeys: ["scenarios"]`), checkbox "Jämför".
- Compare section: when ≥2 checked, `CompareChart` runs `simulate(scenario.input)` per selection and overlays equity-by-year lines (one color per scenario from the categorical palette), legend = scenario names, goal markers as Recharts `ReferenceLine`s for each wealth goal (y = amount).

- [ ] **Step 3: Verify in browser**

Sign up/login → save two scenarios with different LTV → both listed → compare overlays two curves → delete works → logged-out `/scenarios` redirects to login (existing `_auth` route guard behavior).

- [ ] **Step 4: Typecheck + commit**

```bash
cd apps/web && bun run check-types
git add apps/web
git commit -m "feat(web): scenario save/load and comparison view"
```

---

### Task 12: Remove dead packages + cleanup

**Files:**
- Delete: `packages/api/` (tRPC), `packages/db/` (Drizzle)
- Modify: root `package.json` (remove `db:*` scripts; remove `hono`, `@trpc/server`, `@trpc/client` from catalog — keep `zod` (used by `packages/env`) and `better-auth`)
- Modify: `README.md`

- [ ] **Step 1: Verify nothing imports them**

Run: `grep -rn "@sparstrategi/api\|@sparstrategi/db" apps packages --include="*.ts" --include="*.tsx" --include="*.json" | grep -v node_modules`
Expected: no hits outside the two packages themselves.

- [ ] **Step 2: Delete + clean**

```bash
git rm -r packages/api packages/db
```

Remove `db:push/db:studio/db:generate/db:migrate/db:local` scripts from root `package.json`; drop unused catalog entries (`hono`, `@trpc/server`, `@trpc/client`, `@hono/trpc-server` if present). Run `bun install`.

- [ ] **Step 3: Rewrite `README.md`**

Short: what the app is (Swedish savings-strategy simulator), stack (Effect v4 beta, Bun, TanStack Router), commands (`bun install`, `bun run dev`, `bun test`, `bun run check-types`, `cd packages/auth && bun run auth:migrate` for first-time setup), and a pointer to the spec.

- [ ] **Step 4: Full verification**

Run: `bun install && bun test && bun run check-types && bun run build`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove tRPC and Drizzle packages, update README"
```

---

### Task 13: End-to-end verification pass

**Files:** none new — this is the verify gate.

- [ ] **Step 1: Invoke the `verify` skill** (drive the real app, not just tests):

1. `bun run dev` (both apps via turbo).
2. Browser: simulator loads with defaults; drag avkastning slider → KPIs + charts update live.
3. Enter document scenario (values in Task 11a Step 7) → effective tax 0%, ISK ≈ 457 Mkr, growth år 1 ≈ 420 Mkr.
4. Stress: LTV 40%, crash −30% → margin call + forced sale shown.
5. Goal: wealth 2× startkapital om 10 år → shows status and required savings if missed.
6. Sign up → save scenario → reload page → open from /scenarier → same numbers.
7. Share URL: copy, open in private window → same inputs load (no login needed).
8. `curl -i http://localhost:3000/api/scenarios` without cookie → 401.

- [ ] **Step 2: Fix anything broken, re-run `bun test` + `bun run check-types`, commit fixes.**

- [ ] **Step 3: Final commit / summary** — report results honestly, list any known gaps.
