# Jämförelsemotor med mallar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `apps/web-simple` into a template-driven savings-strategy comparison site backed by a new pure comparison engine in `packages/engine`.

**Architecture:** New pure module `packages/engine/src/comparison.ts` simulates N strategies year by year (return split price/dividend, fund fees, ISK/AF/KF taxation, courtage/spread/fx, rebalancing with AF realization) plus a frictionless counterfactual. `apps/web-simple` gets hash-based views: start page with template cards, a generic comparison view, and the existing Kapitalmotor unchanged at `#/kapitalmotor`. Templates are plain data (prefilled parameters + Swedish explainer copy).

**Tech Stack:** Bun workspaces, TypeScript, bun:test, React 19, `@effect/atom-react` (Atom from `effect/unstable/reactivity`), Recharts, `@sparstrategi/ui` components (NumberField, Button, Checkbox, Label), Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-07-17-jamforelsemotor-mallar-design.md`

## Global Constraints

- Money is SEK (kr) as plain `number`; rates are decimal fractions (0.07 = 7 %).
- UI copy in Swedish; numbers via `fmtKr`/`fmtPct` from `apps/web-simple/src/lib/format.ts`.
- Engine code is pure TS: no Effect runtime, deterministic, no `Date.now()`/`Math.random()`.
- Tests use `bun:test` (`import { describe, expect, test } from "bun:test"`), NOT vitest.
- Do not touch `packages/engine/test/simulate.test.ts` or `packages/engine/test/kapitalmotor.test.ts` tolerances (regression anchors).
- `effect` packages pinned at `4.0.0-beta.93` — do not bump anything.
- Legacy share links `?s=...` (no hash) must keep opening the Kapitalmotor view.
- Commands run from repo root unless a `cd` is shown. Type check: `bun run check-types`. Full tests: `bun test`. Engine-only: `cd packages/engine && bun test comparison`.

---

## File Structure

**packages/engine**
- Create: `src/comparison.ts` — types + `simulateStrategy` + `compareStrategies` (Tasks 1–4)
- Create: `test/comparison.test.ts` (Tasks 1–4)
- Modify: `src/index.ts` — add `export * from "./comparison";` (Task 4)

**apps/web-simple**
- Create: `src/lib/router.ts` — hash → view parsing (Task 5)
- Create: `src/views/kapitalmotor.tsx` — existing page extracted from App (Task 5)
- Modify: `src/App.tsx` — view switch on hash (Task 5, 6, 8)
- Modify: `src/state/kapitalmotor.ts` — share URL gets `#/kapitalmotor` (Task 5)
- Create: `src/lib/templates.ts` — `ComparisonTemplate` type + 6 templates (Task 6)
- Create: `src/views/start.tsx` — template cards (Task 6)
- Create: `src/state/comparison.ts` — input atom, results atom, share URL `?j=` (Task 7)
- Create: `src/views/jamfor.tsx` — comparison view shell (Task 8)
- Create: `src/components/jamfor/assumptions-bar.tsx` (Task 8)
- Create: `src/components/jamfor/strategy-column.tsx` (Task 8)
- Create: `src/components/jamfor/jamfor-chart.tsx` (Task 8)
- Create: `src/components/jamfor/jamfor-kpis.tsx` (Task 8)
- Create: `src/components/jamfor/jamfor-table.tsx` (Task 8)

Note on share-payload collision (spec deviation, same goal): instead of a version/kind tag inside `?s=`, the comparison view uses its own query param `?j=`. Payloads can never collide, and legacy `?s=` links keep meaning "kapitalmotor" untouched.

---

### Task 1: Engine core — growth, fees, frictionless counterfactual

**Files:**
- Create: `packages/engine/src/comparison.ts`
- Test: `packages/engine/test/comparison.test.ts`

**Interfaces:**
- Consumes: `TaxParams`, `defaultTaxParams2026` from `../src/schema`; `iskTax`, `iskTaxRate` from `../src/tax` (imported now, used from Task 2).
- Produces: `ComparisonAssumptions`, `StrategyInput`, `StrategyYear`, `StrategyResult`, `defaultStrategyInput(name)`, `simulateStrategy(assumptions, strategy)`. Later tasks rely on these exact names and on the year-loop order of operations documented in the code comment.

- [ ] **Step 1: Write the failing tests**

Create `packages/engine/test/comparison.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { defaultTaxParams2026 } from "../src/schema";
import {
  defaultStrategyInput,
  simulateStrategy,
  type ComparisonAssumptions,
  type StrategyInput,
} from "../src/comparison";

const assumptions = (over: Partial<ComparisonAssumptions> = {}): ComparisonAssumptions => ({
  startCapital: 100_000,
  monthlySavings: 0,
  horizonYears: 20,
  taxParams: defaultTaxParams2026,
  ...over,
});

/** AF med 0 % utdelning och 0 kostnader: inga skattehändelser i årsloopen,
 * så `value` (före realisation) är ren ränta-på-ränta. */
const frictionFree = (over: Partial<StrategyInput> = {}): StrategyInput => ({
  ...defaultStrategyInput("test"),
  accountType: "af",
  priceGrowth: 0.07,
  dividendYield: 0,
  fundFeeRate: 0,
  ...over,
});

describe("avgiftsbroms (fee drag)", () => {
  test("värdet följer (1 + g − f)^n exakt utan skatt och kostnader", () => {
    const g = 0.07;
    const f = 0.015;
    const r = simulateStrategy(assumptions(), frictionFree({ fundFeeRate: f }));
    const expected = 100_000 * Math.pow(1 + g - f, 20);
    expect(r.rows.at(-1)!.value).toBeCloseTo(expected, 6);
  });

  test("paidFees redovisar årets avgiftsbelopp", () => {
    const r = simulateStrategy(assumptions({ horizonYears: 1 }), frictionFree({ fundFeeRate: 0.01 }));
    // År 1: avgift = 1% × 100 000 = 1 000 kr.
    expect(r.rows.at(-1)!.paidFees).toBeCloseTo(1_000, 6);
  });
});

describe("friktionsfri kontrafaktisk", () => {
  test("nollavgift/nollkostnad-AF utan utdelning är lika med frictionlessValue, även med månadssparande", () => {
    const r = simulateStrategy(
      assumptions({ monthlySavings: 3_000, horizonYears: 15 }),
      frictionFree(),
    );
    for (const row of r.rows) {
      expect(row.value).toBeCloseTo(row.frictionlessValue, 4);
    }
  });

  test("år 0-raden speglar startläget", () => {
    const r = simulateStrategy(assumptions(), frictionFree());
    const y0 = r.rows[0]!;
    expect(y0.year).toBe(0);
    expect(y0.value).toBe(100_000);
    expect(y0.frictionlessValue).toBe(100_000);
    expect(r.rows).toHaveLength(21);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/engine && bun test comparison`
Expected: FAIL — `Cannot find module '../src/comparison'`

- [ ] **Step 3: Write the implementation**

Create `packages/engine/src/comparison.ts`:

```ts
import type { TaxParams } from "./schema";
import { iskTax, iskTaxRate } from "./tax";

/**
 * Generell jämförelsemotor: N strategier med identiska insättningar simuleras
 * år för år. Varje "mall" i web-simple är bara förifyllda StrategyInput.
 *
 * Ordning per år (låst — testerna beror på den):
 *   1. Insättningar (12 månadsköp) minus courtage/valutaväxling → netDeposits.
 *   2. Kurstillväxt och utdelning på (capStart + netDeposits/2) — halvårs-
 *      approximation för insättningar; fondavgift på samma underlag.
 *   3. Schablonskatt (ISK med fribelopp / KF utan) på capStart.
 *   4. Utdelningsskatt + källskatt per kontotyp; återinvestera eller betala ut.
 *   5. Ombalansering: kostnader på omsatt volym; på AF realiseras vinst.
 */
export type ComparisonAccountType = "isk" | "af" | "kf";

export interface ComparisonAssumptions {
  startCapital: number;
  monthlySavings: number;
  horizonYears: number;
  taxParams: TaxParams;
}

export interface StrategyInput {
  name: string;
  /** Kursutveckling per år. Totalavkastning = priceGrowth + dividendYield. */
  priceGrowth: number;
  dividendYield: number;
  /** Årlig fondavgift, dras ur avkastningen. */
  fundFeeRate: number;
  accountType: ComparisonAccountType;
  reinvestDividends: boolean;
  /** Utländsk källskatt på utdelning. KF återfår allt, ISK upp till årets
   * schablonskatt (förenklad avräkning), AF avräknar mot utdelningsskatten. */
  foreignWithholdingRate: number;
  /** Antal innehav varje insättning delas över (per köp betalas courtage). */
  holdingsCount: number;
  /** Fast/minimicourtage per affär (kr): per affär betalas max(flat, rate × belopp). */
  courtageFlat: number;
  courtageRate: number;
  /** Valutaväxlingsavgift på handlad volym (0 för svenska värdepapper). */
  fxFeeRate: number;
  rebalancesPerYear: number;
  /** Andel av portföljen som säljs + återköps per ombalansering. */
  turnoverShare: number;
  /** Spreadkostnad per rundresa på omsatt volym. */
  spreadRate: number;
  /** Endast DCA-mallen: åsidosätter gemensamma insättningsantaganden. */
  startCapitalOverride?: number;
  monthlySavingsOverride?: number;
}

export interface StrategyYear {
  year: number;
  /** Kapital i kontot vid årets slut. */
  value: number;
  /** AF-kostnadsbas (för ISK/KF: lika med value — ingen latent skatt). */
  basis: number;
  latentTax: number;
  valueAfterRealization: number;
  /** Ackumulerade belopp t.o.m. detta år: */
  dividendsReceived: number;
  paidFees: number;
  paidTax: number;
  paidTransactionCosts: number;
  /** Samma insättningar och bruttoavkastning utan avgifter/skatt/kostnader. */
  frictionlessValue: number;
}

export interface StrategyFinal {
  value: number;
  valueAfterRealization: number;
  dividendsReceived: number;
  paidFees: number;
  paidTax: number;
  paidTransactionCosts: number;
  /** frictionlessValue − (valueAfterRealization + dividendsReceived).
   * Approximation: utbetalda utdelningar räknas oförräntade. */
  lostToFriction: number;
}

export interface StrategyResult {
  name: string;
  rows: ReadonlyArray<StrategyYear>;
  final: StrategyFinal;
}

export const defaultStrategyInput = (name: string): StrategyInput => ({
  name,
  priceGrowth: 0.07,
  dividendYield: 0,
  fundFeeRate: 0.002,
  accountType: "isk",
  reinvestDividends: true,
  foreignWithholdingRate: 0,
  holdingsCount: 1,
  courtageFlat: 0,
  courtageRate: 0,
  fxFeeRate: 0,
  rebalancesPerYear: 0,
  turnoverShare: 0,
  spreadRate: 0,
});

export function simulateStrategy(
  a: ComparisonAssumptions,
  s: StrategyInput,
): StrategyResult {
  const start = s.startCapitalOverride ?? a.startCapital;
  const monthly = s.monthlySavingsOverride ?? a.monthlySavings;
  const p = a.taxParams;
  const gainsRate = p.afCapitalGainsRate;
  const totalReturn = s.priceGrowth + s.dividendYield;

  /** Kostnad för ett köp om `amount` kr fördelat över alla innehav. */
  const tradeCost = (amount: number): number => {
    if (amount <= 0) return 0;
    const holdings = Math.max(1, s.holdingsCount);
    const perHolding = amount / holdings;
    const courtage =
      holdings * Math.max(s.courtageFlat, s.courtageRate * perHolding);
    return courtage + s.fxFeeRate * amount;
  };

  const startCost = tradeCost(start);
  let value = start - startCost;
  let basis = value;
  let paidTransactionCosts = startCost;
  let paidFees = 0;
  let paidTax = 0;
  let dividendsReceived = 0;
  let frictionless = start;

  const mkRow = (year: number): StrategyYear => {
    const latentTax =
      s.accountType === "af" ? gainsRate * Math.max(0, value - basis) : 0;
    return {
      year,
      value,
      basis: s.accountType === "af" ? basis : value,
      latentTax,
      valueAfterRealization: value - latentTax,
      dividendsReceived,
      paidFees,
      paidTax,
      paidTransactionCosts,
      frictionlessValue: frictionless,
    };
  };

  const rows: StrategyYear[] = [mkRow(0)];

  for (let year = 1; year <= a.horizonYears; year++) {
    // 1. Insättningar
    const deposits = 12 * monthly;
    const depositCost = 12 * tradeCost(monthly);
    const netDeposits = deposits - depositCost;
    paidTransactionCosts += depositCost;

    // 2. Avkastning och avgift
    const capStart = value;
    const mid = capStart + netDeposits / 2;
    const fee = s.fundFeeRate * mid;
    const appreciation = s.priceGrowth * mid;
    const dividends = s.dividendYield * mid;
    paidFees += fee;

    let newValue = capStart + netDeposits + appreciation - fee;
    basis += netDeposits;

    // 3–4. Skatt (Task 2) och 5. ombalansering (Task 3) infogas här.
    if (s.reinvestDividends) {
      newValue += dividends;
      basis += dividends;
    } else {
      dividendsReceived += dividends;
    }

    value = Math.max(0, newValue);
    frictionless =
      frictionless * (1 + totalReturn) + deposits * (1 + totalReturn / 2);
    rows.push(mkRow(year));
  }

  const last = rows.at(-1)!;
  return {
    name: s.name,
    rows,
    final: {
      value: last.value,
      valueAfterRealization: last.valueAfterRealization,
      dividendsReceived: last.dividendsReceived,
      paidFees: last.paidFees,
      paidTax: last.paidTax,
      paidTransactionCosts: last.paidTransactionCosts,
      lostToFriction:
        last.frictionlessValue -
        (last.valueAfterRealization + last.dividendsReceived),
    },
  };
}
```

Note: `iskTax`/`iskTaxRate` are imported but unused until Task 2 — if `noUnusedLocals` complains, keep the import line commented with `// Task 2:` and restore it then.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/engine && bun test comparison`
Expected: PASS (4 tests). Note: the frictionless test passes because with zero fees/costs the loop and the frictionless line compute identical arithmetic.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/comparison.ts packages/engine/test/comparison.test.ts
git commit -m "feat(engine): comparison engine core — growth, fees, frictionless counterfactual"
```

---

### Task 2: Engine taxation — ISK/KF schablon, AF dividends, withholding, latent tax

**Files:**
- Modify: `packages/engine/src/comparison.ts` (the year loop, between steps 2 and reinvest)
- Test: `packages/engine/test/comparison.test.ts` (append)

**Interfaces:**
- Consumes: Task 1's loop and `mkRow` unchanged.
- Produces: tax semantics later tasks and the UI rely on: ISK schablon uses `iskTax(capStart, taxParams)` (free floor applies), KF uses `iskTaxRate(taxParams) × capStart` (no floor), AF dividends cost `max(withheld, afCapitalGainsRate × dividends)`, ISK unreclaimed withholding = `max(0, withheld − schablon)`, KF reclaims fully.

- [ ] **Step 1: Write the failing tests**

Append to `packages/engine/test/comparison.test.ts`:

```ts
describe("kontoskatt", () => {
  const isk = (over: Partial<StrategyInput> = {}): StrategyInput => ({
    ...defaultStrategyInput("isk"),
    fundFeeRate: 0,
    ...over,
  });

  test("utdelningsekvivalens på ISK: 7+0 och 3+4 ger exakt samma värde vid återinvestering", () => {
    const a = assumptions({ monthlySavings: 2_000 });
    const growth = simulateStrategy(a, isk({ priceGrowth: 0.07, dividendYield: 0 }));
    const dividend = simulateStrategy(a, isk({ priceGrowth: 0.03, dividendYield: 0.04 }));
    expect(dividend.final.value).toBeCloseTo(growth.final.value, 4);
  });

  test("på AF är utdelningsstrategin strikt sämre än tillväxt vid samma totalavkastning", () => {
    const a = assumptions();
    const growth = simulateStrategy(
      a,
      isk({ accountType: "af", priceGrowth: 0.07, dividendYield: 0 }),
    );
    const dividend = simulateStrategy(
      a,
      isk({ accountType: "af", priceGrowth: 0.03, dividendYield: 0.04 }),
    );
    expect(dividend.final.valueAfterRealization).toBeLessThan(
      growth.final.valueAfterRealization,
    );
  });

  test("brytpunkt: vid låg avkastning vinner AF, vid hög vinner ISK (efter full realisation)", () => {
    // Stort kapital så ISK-fribeloppet inte dominerar.
    const a = assumptions({ startCapital: 5_000_000 });
    const low = (acct: "isk" | "af") =>
      simulateStrategy(a, isk({ accountType: acct, priceGrowth: 0.02 })).final
        .valueAfterRealization;
    const high = (acct: "isk" | "af") =>
      simulateStrategy(a, isk({ accountType: acct, priceGrowth: 0.1 })).final
        .valueAfterRealization;
    expect(low("af")).toBeGreaterThan(low("isk"));
    expect(high("isk")).toBeGreaterThan(high("af"));
  });

  test("KF har ingen fribeloppseffekt: under 300 tkr betalar ISK 0 kr schablon, KF > 0", () => {
    const a = assumptions({ startCapital: 200_000, horizonYears: 1 });
    const onIsk = simulateStrategy(a, isk({ priceGrowth: 0.0 }));
    const onKf = simulateStrategy(a, isk({ accountType: "kf", priceGrowth: 0.0 }));
    expect(onIsk.final.paidTax).toBe(0);
    expect(onKf.final.paidTax).toBeGreaterThan(0);
  });

  test("källskatt: KF återfår allt, ISK tappar bara det som överstiger schablonskatten", () => {
    const a = assumptions({ startCapital: 1_000_000, horizonYears: 1 });
    const base = { priceGrowth: 0.04, dividendYield: 0.03, foreignWithholdingRate: 0.15 };
    const onKf = simulateStrategy(a, isk({ ...base, accountType: "kf" }));
    const onIsk = simulateStrategy(a, isk({ ...base }));
    // KF: schablon men ingen källskattekostnad. ISK: schablon + ev. oåterfådd källskatt.
    // Här: källskatt 0,15 × 3% × ~1 Mkr ≈ 4 500 kr > ISK-schablon (~7 350 kr)? Nej — 4 500 < 7 350,
    // alltså full avräkning: ISK och KF skiljer sig bara i fribeloppet.
    const kfSchablon = onKf.final.paidTax;
    const iskSchablon = onIsk.final.paidTax;
    expect(iskSchablon).toBeLessThan(kfSchablon); // fribeloppet 300 tkr
    // AF: kostnaden är max(källskatt, 30% × utdelning) = 30% × utdelning.
    const onAf = simulateStrategy(a, isk({ ...base, accountType: "af" }));
    const div = 0.03 * (1_000_000);
    expect(onAf.rows[1]!.paidTax).toBeCloseTo(0.3 * div, 0);
  });

  test("latent skatt: AF-raden redovisar 30 % av orealiserad vinst och valueAfterRealization drar av den", () => {
    const r = simulateStrategy(
      assumptions({ horizonYears: 5 }),
      isk({ accountType: "af", priceGrowth: 0.07 }),
    );
    const y5 = r.rows.at(-1)!;
    expect(y5.latentTax).toBeCloseTo(0.3 * (y5.value - y5.basis), 6);
    expect(y5.valueAfterRealization).toBeCloseTo(y5.value - y5.latentTax, 6);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/engine && bun test comparison`
Expected: FAIL — the new `kontoskatt` tests fail (no tax logic yet); Task 1 tests still PASS.

- [ ] **Step 3: Implement the tax block**

In `packages/engine/src/comparison.ts`, replace this section of the year loop:

```ts
    let newValue = capStart + netDeposits + appreciation - fee;
    basis += netDeposits;

    // 3–4. Skatt (Task 2) och 5. ombalansering (Task 3) infogas här.
    if (s.reinvestDividends) {
      newValue += dividends;
      basis += dividends;
    } else {
      dividendsReceived += dividends;
    }
```

with:

```ts
    let newValue = capStart + netDeposits + appreciation - fee;
    basis += netDeposits;

    // 3. Schablonskatt på årets ingående kapital.
    const schablon =
      s.accountType === "isk"
        ? iskTax(capStart, p)
        : s.accountType === "kf"
          ? Math.max(0, capStart) * iskTaxRate(p)
          : 0;
    newValue -= schablon;
    paidTax += schablon;

    // 4. Utdelning: källskatt + kontoskatt.
    const withheld = s.foreignWithholdingRate * dividends;
    const divTax =
      s.accountType === "af"
        ? Math.max(withheld, gainsRate * dividends)
        : s.accountType === "kf"
          ? 0
          : Math.max(0, withheld - schablon);
    paidTax += divTax;
    const netDividends = dividends - divTax;
    if (s.reinvestDividends) {
      newValue += netDividends;
      basis += netDividends;
    } else {
      dividendsReceived += netDividends;
    }

    // 5. Ombalansering (Task 3) infogas här.
```

Also restore/uncomment the `iskTax, iskTaxRate` import if it was commented out in Task 1.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/engine && bun test comparison`
Expected: PASS. If Task 1's frictionless-equality test now fails, the cause is schablon applied to AF — verify AF gets `schablon = 0` and `divTax = gainsRate × 0 = 0` when `dividendYield = 0`.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/comparison.ts packages/engine/test/comparison.test.ts
git commit -m "feat(engine): comparison engine account taxation (ISK/AF/KF, withholding, latent tax)"
```

---

### Task 3: Engine transaction costs — courtage, spread/fx, rebalancing with AF realization

**Files:**
- Modify: `packages/engine/src/comparison.ts`
- Test: `packages/engine/test/comparison.test.ts` (append)

**Interfaces:**
- Consumes: Tasks 1–2 loop.
- Produces: rebalancing semantics the UI relies on: yearly turnover = `min(1, rebalancesPerYear × turnoverShare)`; round-trip cost = `volume × (spreadRate + 2 × (courtageRate + fxFeeRate))`; AF realizes `turnover × unrealized gain`, pays tax from the account, and steps up basis by `realizedGain − tax`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/engine/test/comparison.test.ts`:

```ts
describe("transaktionskostnader", () => {
  test("courtage år 1: 12 månadsköp × 8 innehav × minimicourtage när procentsatsen är lägre", () => {
    const a = assumptions({ startCapital: 0, monthlySavings: 1_000, horizonYears: 1 });
    const s: StrategyInput = {
      ...defaultStrategyInput("aktier"),
      fundFeeRate: 0,
      holdingsCount: 8,
      courtageFlat: 5,
      courtageRate: 0.0025, // 0,25 % av 125 kr = 0,31 kr < 5 kr ⇒ flat gäller
    };
    const r = simulateStrategy(a, s);
    expect(r.final.paidTransactionCosts).toBeCloseTo(12 * 8 * 5, 6);
  });

  test("procentcourtage gäller när det överstiger minimicourtaget", () => {
    const a = assumptions({ startCapital: 1_000_000, monthlySavings: 0, horizonYears: 1 });
    const s: StrategyInput = {
      ...defaultStrategyInput("stort köp"),
      fundFeeRate: 0,
      holdingsCount: 1,
      courtageFlat: 5,
      courtageRate: 0.0025, // 0,25 % av 1 Mkr = 2 500 kr > 5 kr
    };
    const r = simulateStrategy(a, s);
    expect(r.rows[0]!.paidTransactionCosts).toBeCloseTo(2_500, 6);
  });

  test("ombalanseringskostnad är linjär i antal ombalanseringar (ettårshorisont)", () => {
    const a = assumptions({ startCapital: 1_000_000, horizonYears: 1 });
    const mk = (n: number): StrategyInput => ({
      ...defaultStrategyInput("rebal"),
      fundFeeRate: 0,
      priceGrowth: 0,
      rebalancesPerYear: n,
      turnoverShare: 0.1,
      spreadRate: 0.001,
      courtageRate: 0.0005,
    });
    const c1 = simulateStrategy(a, mk(1)).final.paidTransactionCosts;
    const c2 = simulateStrategy(a, mk(2)).final.paidTransactionCosts;
    expect(c2).toBeCloseTo(2 * c1, 4);
  });

  test("AF-ombalansering med full omsättning realiserar allt: latent skatt 0, basis = value", () => {
    const a = assumptions({ startCapital: 1_000_000, horizonYears: 10 });
    const s: StrategyInput = {
      ...defaultStrategyInput("af full rebal"),
      accountType: "af",
      fundFeeRate: 0,
      rebalancesPerYear: 1,
      turnoverShare: 1,
    };
    const r = simulateStrategy(a, s);
    for (const row of r.rows.slice(1)) {
      expect(row.latentTax).toBeCloseTo(0, 4);
      expect(row.basis).toBeCloseTo(row.value, 4);
    }
    // Årlig realisering är dyrare än att skjuta upp skatten:
    const deferred = simulateStrategy(a, { ...s, rebalancesPerYear: 0, turnoverShare: 0 });
    expect(deferred.final.valueAfterRealization).toBeGreaterThan(
      r.final.valueAfterRealization,
    );
  });

  test("ISK-ombalansering kostar courtage/spread men utlöser ingen skatt", () => {
    const a = assumptions({ startCapital: 1_000_000, horizonYears: 1 });
    const s: StrategyInput = {
      ...defaultStrategyInput("isk rebal"),
      fundFeeRate: 0,
      priceGrowth: 0,
      rebalancesPerYear: 1,
      turnoverShare: 0.2,
      spreadRate: 0.001,
    };
    const r = simulateStrategy(a, s);
    expect(r.final.paidTransactionCosts).toBeGreaterThan(0);
    // Enda skatten är schablon.
    const noRebal = simulateStrategy(a, { ...s, rebalancesPerYear: 0, turnoverShare: 0 });
    expect(r.final.paidTax).toBeCloseTo(noRebal.final.paidTax, 6);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/engine && bun test comparison`
Expected: The two courtage tests PASS already (tradeCost exists since Task 1); the three rebalancing tests FAIL. That's the expected split.

- [ ] **Step 3: Implement the rebalancing block**

In `packages/engine/src/comparison.ts`, replace the placeholder comment:

```ts
    // 5. Ombalansering (Task 3) infogas här.
```

with:

```ts
    // 5. Ombalansering: kostnader på omsatt volym; på AF realiseras vinst.
    const turnover = Math.min(1, s.rebalancesPerYear * s.turnoverShare);
    if (turnover > 0 && newValue > 0) {
      const volume = turnover * newValue;
      const rebalCost =
        volume * (s.spreadRate + 2 * (s.courtageRate + s.fxFeeRate));
      newValue -= rebalCost;
      paidTransactionCosts += rebalCost;
      if (s.accountType === "af") {
        const unrealized = Math.max(0, newValue - basis);
        const realizedGain = turnover * unrealized;
        const realizedTax = gainsRate * realizedGain;
        newValue -= realizedTax;
        basis += realizedGain - realizedTax;
        paidTax += realizedTax;
      }
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/engine && bun test comparison`
Expected: PASS (all comparison tests).

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/comparison.ts packages/engine/test/comparison.test.ts
git commit -m "feat(engine): comparison engine transaction costs and rebalancing"
```

---

### Task 4: `compareStrategies`, deposit overrides (DCA), engine export

**Files:**
- Modify: `packages/engine/src/comparison.ts` (append function)
- Modify: `packages/engine/src/index.ts`
- Test: `packages/engine/test/comparison.test.ts` (append)

**Interfaces:**
- Produces: `compareStrategies(assumptions: ComparisonAssumptions, strategies: ReadonlyArray<StrategyInput>): StrategyResult[]` — exported from `@sparstrategi/engine`. web-simple imports `compareStrategies`, `defaultStrategyInput`, and all comparison types from the package root.

- [ ] **Step 1: Write the failing tests**

Append to `packages/engine/test/comparison.test.ts` (add `compareStrategies` to the existing import from `../src/comparison`):

```ts
describe("compareStrategies och insättningsöverstyrning", () => {
  test("kör N strategier med samma antaganden och bevarar ordning/namn", () => {
    const rs = compareStrategies(assumptions(), [
      frictionFree({ name: "a" }),
      frictionFree({ name: "b", fundFeeRate: 0.015 }),
    ]);
    expect(rs.map((r) => r.name)).toEqual(["a", "b"]);
    expect(rs[0]!.final.value).toBeGreaterThan(rs[1]!.final.value);
  });

  test("engångsköp slår månadssparande vid positiv avkastning (deterministisk DCA-jämförelse)", () => {
    const a = assumptions({ startCapital: 0, monthlySavings: 5_000, horizonYears: 10 });
    const [lump, dca] = compareStrategies(a, [
      frictionFree({
        name: "engång",
        startCapitalOverride: 5_000 * 12 * 10,
        monthlySavingsOverride: 0,
      }),
      frictionFree({ name: "dca" }),
    ]);
    expect(lump!.final.value).toBeGreaterThan(dca!.final.value);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/engine && bun test comparison`
Expected: FAIL — `compareStrategies` is not exported.

- [ ] **Step 3: Implement and export**

Append to `packages/engine/src/comparison.ts`:

```ts
export const compareStrategies = (
  a: ComparisonAssumptions,
  strategies: ReadonlyArray<StrategyInput>,
): StrategyResult[] => strategies.map((s) => simulateStrategy(a, s));
```

In `packages/engine/src/index.ts`, append:

```ts
export * from "./comparison";
```

- [ ] **Step 4: Run tests, type check, and the full engine suite**

Run: `cd packages/engine && bun test` then from repo root `bun run check-types`
Expected: all engine tests PASS (including the untouched `simulate.test.ts` document-reproduction anchor); type check clean.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/comparison.ts packages/engine/src/index.ts packages/engine/test/comparison.test.ts
git commit -m "feat(engine): compareStrategies with per-strategy deposit overrides"
```

---

### Task 5: web-simple hash routing — start/jamfor/kapitalmotor views, legacy `?s=` redirect

**Files:**
- Create: `apps/web-simple/src/lib/router.ts`
- Create: `apps/web-simple/src/views/kapitalmotor.tsx`
- Modify: `apps/web-simple/src/App.tsx`
- Modify: `apps/web-simple/src/state/kapitalmotor.ts:59-60` (share URL)

**Interfaces:**
- Produces: `type View = "start" | "jamfor" | "kapitalmotor"`, `parseHash(hash: string): View`, `useView(): View` (hook re-rendering on `hashchange`), `navigate(view: View): void`. `KapitalmotorView` component (the old page verbatim). Tasks 6 and 8 plug `StartView`/`JamforView` into App's switch.

- [ ] **Step 1: Create the router**

Create `apps/web-simple/src/lib/router.ts`:

```ts
import { useEffect, useState } from "react";

export type View = "start" | "jamfor" | "kapitalmotor";

export const parseHash = (hash: string): View => {
  if (hash.startsWith("#/kapitalmotor")) return "kapitalmotor";
  if (hash.startsWith("#/jamfor")) return "jamfor";
  return "start";
};

/** Gamla dela-länkar (`?s=` utan hash) ska fortsätta öppna Kapitalmotorn. */
const initialView = (): View => {
  const byHash = parseHash(window.location.hash);
  if (window.location.hash === "" && new URLSearchParams(window.location.search).has("s")) {
    return "kapitalmotor";
  }
  return byHash;
};

export const navigate = (view: View): void => {
  window.location.hash = view === "start" ? "#/" : `#/${view}`;
};

export function useView(): View {
  const [view, setView] = useState<View>(initialView);
  useEffect(() => {
    const onChange = () => setView(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return view;
}
```

- [ ] **Step 2: Extract the Kapitalmotor page into a view**

Create `apps/web-simple/src/views/kapitalmotor.tsx` by moving the `KapitalmotorPage` function body out of `App.tsx` verbatim (imports included), renamed and with a back link:

```tsx
import { useAtomValue } from "@effect/atom-react";
import { Button } from "@sparstrategi/ui/components/button";
import { ArrowLeftIcon, Share2Icon } from "lucide-react";
import { toast } from "sonner";

import { KapitalmotorComparisonChart } from "@/components/kapitalmotor/comparison-chart";
import { KapitalmotorHoldingCard } from "@/components/kapitalmotor/holding-card";
import { KapitalmotorInputPanel } from "@/components/kapitalmotor/input-panel";
import { KapitalmotorKellyCard } from "@/components/kapitalmotor/kelly-card";
import { KapitalmotorKpiRow } from "@/components/kapitalmotor/kpi-row";
import { KapitalmotorRealizedChart } from "@/components/kapitalmotor/realized-chart";
import { KapitalmotorTable } from "@/components/kapitalmotor/table";
import { navigate } from "@/lib/router";
import { kapitalmotorInputAtom, kapitalmotorShareUrl } from "@/state/kapitalmotor";

export function KapitalmotorView() {
  const input = useAtomValue(kapitalmotorInputAtom);

  const handleShare = () => {
    const url = kapitalmotorShareUrl(input);
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Länk kopierad"))
      .catch(() => toast.error("Kunde inte kopiera länken"));
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate("start")}
            className="mb-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3" /> Alla verktyg
          </button>
          <h1 className="text-2xl font-bold">Belånad Kapitalmotor</h1>
          <p className="text-sm text-muted-foreground">
            AF/ISK-uppdelning, belåning och holdingbolag — jämför strategier, dela resultatet.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleShare}>
          <Share2Icon className="size-3.5" />
          Dela
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <KapitalmotorInputPanel />
        <div className="space-y-4">
          <KapitalmotorKpiRow />
          <KapitalmotorTable />
          <KapitalmotorComparisonChart />
          <KapitalmotorRealizedChart />
          <KapitalmotorKellyCard />
          <KapitalmotorHoldingCard />
        </div>
      </div>
      <footer className="mx-auto mt-10 max-w-7xl px-4 pb-6 text-xs text-muted-foreground">
        Fristående, uträkningarna körs helt i webbläsaren — inget sparas eller skickas till någon
        server. "Dela" kodar in dina värden i URL:en. Illustrativt räkneexempel, inte finansiell
        rådgivning.
      </footer>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite App.tsx as a view switch**

Replace `apps/web-simple/src/App.tsx` with:

```tsx
import { Toaster } from "@sparstrategi/ui/components/sonner";

import { ThemeProvider } from "@/components/theme-provider";
import { useView } from "@/lib/router";
import { KapitalmotorView } from "@/views/kapitalmotor";

export default function App() {
  const view = useView();
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      disableTransitionOnChange
      storageKey="vite-ui-theme"
    >
      {view === "kapitalmotor" ? (
        <KapitalmotorView />
      ) : (
        // Task 6 ersätter med <StartView />, Task 8 lägger till "jamfor"-grenen.
        <KapitalmotorView />
      )}
      <Toaster richColors />
    </ThemeProvider>
  );
}
```

- [ ] **Step 4: Point the Kapitalmotor share URL at the hash route**

In `apps/web-simple/src/state/kapitalmotor.ts`, change `kapitalmotorShareUrl` to:

```ts
export const kapitalmotorShareUrl = (input: KapitalmotorUiInput): string =>
  `${window.location.origin}${window.location.pathname}?s=${encodeURIComponent(serialize(input))}#/kapitalmotor`;
```

- [ ] **Step 5: Verify — type check, build, manual smoke**

Run: `bun run check-types && bun run build`
Expected: clean. Then `cd apps/web-simple && bun run dev`, open the printed URL and confirm: `/#/kapitalmotor` shows the tool; `/?s=<gammal payload>` (copy one via Dela-knappen, strip the hash) still opens the tool; Dela produces a URL ending in `#/kapitalmotor`.

- [ ] **Step 6: Commit**

```bash
git add apps/web-simple/src
git commit -m "feat(web-simple): hash-based views with legacy ?s= redirect to kapitalmotor"
```

---

### Task 6: Templates data + start page

**Files:**
- Create: `apps/web-simple/src/lib/templates.ts`
- Create: `apps/web-simple/src/views/start.tsx`
- Modify: `apps/web-simple/src/App.tsx`

**Interfaces:**
- Consumes: `defaultStrategyInput`, `StrategyInput` from `@sparstrategi/engine`; `navigate` from `@/lib/router`.
- Produces: `ComparisonTemplate` interface, `templates: ComparisonTemplate[]`, `templateById(id: string): ComparisonTemplate` (falls back to the `egen` template). Task 7's state atom loads templates through `templateById`; Task 8 renders `explainer` and `highlightedFields`.

- [ ] **Step 1: Create the templates module**

Create `apps/web-simple/src/lib/templates.ts`:

```ts
import { defaultStrategyInput, type StrategyInput } from "@sparstrategi/engine";

export interface ComparisonTemplate {
  id: string;
  title: string;
  /** En menings fråga på mallkortet. */
  question: string;
  /** "Varför blir det så här?" — visas under grafen. */
  explainer: string;
  assumptions: { startCapital: number; monthlySavings: number; horizonYears: number };
  strategies: StrategyInput[];
  /** Fält som visas expanderade/markerade i strategikolumnerna. */
  highlightedFields: ReadonlyArray<keyof StrategyInput>;
  /** false endast för DCA-mallen: tillåt per-strategi-insättningar. */
  lockDeposits: boolean;
}

const s = defaultStrategyInput;

export const templates: ComparisonTemplate[] = [
  {
    id: "avgift",
    title: "Vad kostar fondavgiften?",
    question: "Indexfond 0,2 % mot aktiv fond 1,5 % — samma bruttoavkastning.",
    explainer:
      "Avgiften dras varje år ur avkastningen, så den drabbar även all tidigare tillväxt. " +
      "Skillnaden växer därför exponentiellt med tiden: 1,3 procentenheter låter lite, men på " +
      "30 år äter den ofta upp en fjärdedel av slutvärdet. Titta på raden \"Betalt i avgifter\" — " +
      "och notera att den underskattar den verkliga förlusten, eftersom varje betald avgiftskrona " +
      "också hade fortsatt växa.",
    assumptions: { startCapital: 100_000, monthlySavings: 3_000, horizonYears: 30 },
    strategies: [
      { ...s("Indexfond"), fundFeeRate: 0.002 },
      { ...s("Aktiv fond"), fundFeeRate: 0.015 },
    ],
    highlightedFields: ["fundFeeRate"],
    lockDeposits: true,
  },
  {
    id: "konto",
    title: "ISK, AF eller KF?",
    question: "Samma portfölj i tre sparformer — schablonskatt mot reavinstskatt.",
    explainer:
      "ISK och KF schablonbeskattas varje år oavsett resultat (skattesatsen styrs av " +
      "statslåneräntan), medan AF beskattas med 30 % först när du säljer med vinst — och på " +
      "utdelningar direkt. Vid hög avkastning vinner ISK, vid låg avkastning kan AF vinna. ISK " +
      "har dessutom ett skattefritt golv på 300 000 kr (2026) som KF saknar. Dra i förväntad " +
      "avkastning och se brytpunkten flytta sig.",
    assumptions: { startCapital: 200_000, monthlySavings: 3_000, horizonYears: 20 },
    strategies: [
      { ...s("ISK"), priceGrowth: 0.05, dividendYield: 0.02 },
      { ...s("AF (depå)"), accountType: "af", priceGrowth: 0.05, dividendYield: 0.02 },
      { ...s("KF"), accountType: "kf", priceGrowth: 0.05, dividendYield: 0.02 },
    ],
    highlightedFields: ["accountType", "priceGrowth", "dividendYield"],
    lockDeposits: true,
  },
  {
    id: "utdelning",
    title: "Tillväxtaktier eller utdelningsaktier?",
    question: "Samma totalavkastning, olika fördelning mellan kurs och utdelning.",
    explainer:
      "På ISK är strategierna nästan exakt likvärdiga när utdelningen återinvesteras — " +
      "schablonskatten bryr sig inte om hur avkastningen kommer. Skillnaden uppstår på en " +
      "vanlig depå (AF), där utdelningar beskattas med 30 % varje år medan kursvinster får " +
      "växa obeskattade tills du säljer. Byt kontotyp till AF på båda och se gapet öppna sig. " +
      "Utländsk källskatt kan dessutom läcka på ISK om schablonskatten är för låg för full " +
      "avräkning — testa 15 % källskatt.",
    assumptions: { startCapital: 100_000, monthlySavings: 2_000, horizonYears: 25 },
    strategies: [
      { ...s("Tillväxt"), priceGrowth: 0.07, dividendYield: 0 },
      { ...s("Utdelning"), priceGrowth: 0.03, dividendYield: 0.04 },
    ],
    highlightedFields: [
      "priceGrowth",
      "dividendYield",
      "reinvestDividends",
      "foreignWithholdingRate",
      "accountType",
    ],
    lockDeposits: true,
  },
  {
    id: "courtage",
    title: "Ombalansering & courtage",
    question: "Månadsspara i en fond, eller i åtta aktier med årlig ombalansering?",
    explainer:
      "Åtta aktieköp i månaden betalar minimicourtage åtta gånger — på små belopp kan det bli " +
      "flera procent av insättningen. Lägg till spread och årlig ombalansering (sälj + köp) " +
      "så växer friktionen. På en depå (AF) tillkommer den dolda stora kostnaden: varje " +
      "ombalansering realiserar vinst och tidigarelägger 30 % skatt. En fond ombalanserar " +
      "internt utan att du betalar courtage eller utlöser skatt.",
    assumptions: { startCapital: 20_000, monthlySavings: 2_000, horizonYears: 20 },
    strategies: [
      { ...s("En indexfond"), fundFeeRate: 0.002 },
      {
        ...s("8 aktier"),
        fundFeeRate: 0,
        holdingsCount: 8,
        courtageFlat: 5,
        courtageRate: 0.0025,
        rebalancesPerYear: 1,
        turnoverShare: 0.2,
        spreadRate: 0.001,
      },
    ],
    highlightedFields: [
      "holdingsCount",
      "courtageFlat",
      "courtageRate",
      "rebalancesPerYear",
      "turnoverShare",
      "spreadRate",
      "accountType",
    ],
    lockDeposits: true,
  },
  {
    id: "dca",
    title: "Engångsköp eller månadssparande?",
    question: "Sätta in allt direkt, eller sprida ut det över tiden?",
    explainer:
      "Rent matematiskt vinner engångsköpet så länge förväntad avkastning är positiv — " +
      "pengarna är investerade längre. Månadssparandets värde är beteendemässigt och " +
      "riskmässigt: du undviker att pricka en topp med hela beloppet. Jämförelsen här är " +
      "deterministisk (samma avkastning varje år) och visar därför bara tidskostnaden, inte " +
      "riskspridningen.",
    assumptions: { startCapital: 0, monthlySavings: 5_000, horizonYears: 10 },
    strategies: [
      {
        ...s("Engångsköp"),
        startCapitalOverride: 600_000,
        monthlySavingsOverride: 0,
      },
      { ...s("Månadssparande") },
    ],
    highlightedFields: ["startCapitalOverride", "monthlySavingsOverride"],
    lockDeposits: false,
  },
  {
    id: "egen",
    title: "Egen jämförelse",
    question: "Börja från ett blankt läge och ställ in allt själv.",
    explainer:
      "Två identiska strategier att utgå ifrån — ändra det du vill jämföra. Alla parametrar " +
      "är öppna: avkastningens fördelning, avgifter, sparform, courtage och ombalansering.",
    assumptions: { startCapital: 100_000, monthlySavings: 2_000, horizonYears: 20 },
    strategies: [s("Strategi A"), s("Strategi B")],
    highlightedFields: [],
    lockDeposits: true,
  },
];

export const templateById = (id: string): ComparisonTemplate =>
  templates.find((t) => t.id === id) ?? templates.at(-1)!;
```

- [ ] **Step 2: Create the start view**

Create `apps/web-simple/src/views/start.tsx`:

```tsx
import { navigate } from "@/lib/router";
import { templates } from "@/lib/templates";
import { loadTemplate } from "@/state/comparison";

export function StartView() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Sparstrategi</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">
        Jämför sparstrategier sida vid sida — avgifter, sparformer, utdelningar och
        transaktionskostnader. Allt räknas i webbläsaren, inget sparas.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              loadTemplate(t.id);
              navigate("jamfor");
            }}
            className="rounded-xl border bg-card p-5 text-left transition-colors hover:border-emerald-400/50"
          >
            <div className="text-sm font-semibold">{t.title}</div>
            <p className="mt-1 text-xs text-muted-foreground">{t.question}</p>
          </button>
        ))}
        <button
          type="button"
          onClick={() => navigate("kapitalmotor")}
          className="rounded-xl border border-dashed bg-card p-5 text-left transition-colors hover:border-emerald-400/50"
        >
          <div className="text-sm font-semibold">Belånad Kapitalmotor</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Avancerat: belåning, AF/ISK-kalibrering, Kelly, Monte Carlo och holdingbolag.
          </p>
        </button>
      </div>
      <footer className="mt-10 text-xs text-muted-foreground">
        Illustrativa räkneexempel, inte finansiell rådgivning.
      </footer>
    </div>
  );
}
```

Note: `loadTemplate` comes from Task 7. If executing this task before Task 7, stub it in `src/state/comparison.ts` as `export const loadTemplate = (_id: string): void => {};` and replace in Task 7 — or execute Tasks 6–7 together before type-checking. Recommended order if running strictly sequentially: create the stub.

- [ ] **Step 3: Wire the start view into App**

In `apps/web-simple/src/App.tsx`, import `StartView` and replace the fallback branch:

```tsx
import { StartView } from "@/views/start";
// ...
      {view === "kapitalmotor" ? (
        <KapitalmotorView />
      ) : view === "start" ? (
        <StartView />
      ) : (
        // Task 8: <JamforView />
        <StartView />
      )}
```

- [ ] **Step 4: Verify**

Run: `bun run check-types && bun run build`
Expected: clean. Dev-server: start page renders 7 cards; Kapitalmotor card navigates.

- [ ] **Step 5: Commit**

```bash
git add apps/web-simple/src
git commit -m "feat(web-simple): comparison templates and start page"
```

---

### Task 7: Comparison state — input atom, results atom, share URL

**Files:**
- Create (or replace the Task 6 stub in): `apps/web-simple/src/state/comparison.ts`

**Interfaces:**
- Consumes: `compareStrategies`, `defaultStrategyInput`, `StrategyInput`, `defaultTaxParams2026` from `@sparstrategi/engine`; `templateById` from `@/lib/templates`.
- Produces (Task 8 depends on these exact names):
  - `interface ComparisonUiInput { templateId: string; assumptions: { startCapital: number; monthlySavings: number; horizonYears: number }; strategies: StrategyInput[] }`
  - `comparisonInputAtom` (writable `Atom`), `comparisonResultsAtom` (derived → `StrategyResult[]`)
  - `loadTemplate(id: string): void` — resets the atom to the template's prefills
  - `comparisonShareUrl(input: ComparisonUiInput): string` — `?j=` payload + `#/jamfor`

- [ ] **Step 1: Implement the state module**

Create/replace `apps/web-simple/src/state/comparison.ts`:

```ts
import {
  compareStrategies,
  defaultTaxParams2026,
  type StrategyInput,
  type StrategyResult,
} from "@sparstrategi/engine";
import { Atom } from "effect/unstable/reactivity";

import { templateById } from "@/lib/templates";

export interface ComparisonUiInput {
  templateId: string;
  assumptions: { startCapital: number; monthlySavings: number; horizonYears: number };
  strategies: StrategyInput[];
}

const fromTemplate = (id: string): ComparisonUiInput => {
  const t = templateById(id);
  return {
    templateId: t.id,
    assumptions: { ...t.assumptions },
    strategies: t.strategies.map((s) => ({ ...s })),
  };
};

const serialize = (input: ComparisonUiInput): string =>
  btoa(encodeURIComponent(JSON.stringify(input)));

const parse = (s: string): ComparisonUiInput | null => {
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(s))) as ComparisonUiInput;
    if (!Array.isArray(parsed.strategies) || parsed.strategies.length === 0) return null;
    const base = fromTemplate(parsed.templateId ?? "egen");
    return {
      templateId: parsed.templateId ?? "egen",
      assumptions: { ...base.assumptions, ...parsed.assumptions },
      strategies: parsed.strategies,
    };
  } catch {
    return null;
  }
};

/** Jämförelsens dela-payload bor i `?j=` — krockar aldrig med kapitalmotorns `?s=`. */
export const comparisonShareUrl = (input: ComparisonUiInput): string =>
  `${window.location.origin}${window.location.pathname}?j=${encodeURIComponent(serialize(input))}#/jamfor`;

const initialInput = (): ComparisonUiInput => {
  if (typeof window !== "undefined") {
    const j = new URLSearchParams(window.location.search).get("j");
    const parsed = j && parse(j);
    if (parsed) return parsed;
  }
  return fromTemplate("egen");
};

export const comparisonInputAtom = Atom.make(initialInput());

export const comparisonResultsAtom = Atom.make((get): StrategyResult[] => {
  const input = get(comparisonInputAtom);
  return compareStrategies(
    { ...input.assumptions, taxParams: defaultTaxParams2026 },
    input.strategies,
  );
});

/** Sätts av mallkorten på startsidan innan navigering till #/jamfor. */
let pendingTemplate: string | null = null;
export const loadTemplate = (id: string): void => {
  pendingTemplate = id;
};
export const consumePendingTemplate = (): ComparisonUiInput | null => {
  if (pendingTemplate === null) return null;
  const input = fromTemplate(pendingTemplate);
  pendingTemplate = null;
  return input;
};
```

Design note: `Atom.make` state cannot be written outside React here without a registry, so `loadTemplate` stages the template and `JamforView` (Task 8) consumes it via `consumePendingTemplate()` in a `useEffect`, writing it through `useAtom`'s setter. This keeps everything inside the existing `@effect/atom-react` pattern.

- [ ] **Step 2: Verify**

Run: `bun run check-types`
Expected: clean (module compiles; UI consumption comes in Task 8).

- [ ] **Step 3: Commit**

```bash
git add apps/web-simple/src/state/comparison.ts
git commit -m "feat(web-simple): comparison state atoms and ?j= share serialization"
```

---

### Task 8: Comparison view UI — assumptions bar, strategy columns, chart, KPIs, table, explainer

**Files:**
- Create: `apps/web-simple/src/views/jamfor.tsx`
- Create: `apps/web-simple/src/components/jamfor/assumptions-bar.tsx`
- Create: `apps/web-simple/src/components/jamfor/strategy-column.tsx`
- Create: `apps/web-simple/src/components/jamfor/jamfor-chart.tsx`
- Create: `apps/web-simple/src/components/jamfor/jamfor-kpis.tsx`
- Create: `apps/web-simple/src/components/jamfor/jamfor-table.tsx`
- Modify: `apps/web-simple/src/App.tsx` (add the `jamfor` branch)

**Interfaces:**
- Consumes: everything from Tasks 5–7 (`useView`/`navigate`, `templateById`, `comparisonInputAtom`, `comparisonResultsAtom`, `consumePendingTemplate`, `comparisonShareUrl`), `fmtKr`/`fmtPct`, UI components `NumberField`, `Button`, `Checkbox`, `Label`.
- Produces: `JamforView`.

Strategy colors, shared by chart/KPIs/columns — define once in `jamfor-chart.tsx` and export:
`export const STRATEGY_COLORS = ["#34d399", "#fbbf24", "#60a5fa"] as const;`

- [ ] **Step 1: Assumptions bar**

Create `apps/web-simple/src/components/jamfor/assumptions-bar.tsx`:

```tsx
import { useAtom } from "@effect/atom-react";
import { NumberField } from "@sparstrategi/ui/components/number-field";

import { comparisonInputAtom } from "@/state/comparison";

export function AssumptionsBar({ lockDeposits }: { lockDeposits: boolean }) {
  const [input, setInput] = useAtom(comparisonInputAtom);
  const set = (key: "startCapital" | "monthlySavings" | "horizonYears", value: number) =>
    setInput({ ...input, assumptions: { ...input.assumptions, [key]: value } });

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3">
      <NumberField
        label="Startkapital (kr)"
        value={input.assumptions.startCapital}
        onChange={(v) => set("startCapital", Math.max(0, v))}
        min={0}
        max={100_000_000}
        step={10_000}
      />
      <NumberField
        label="Månadssparande (kr/mån)"
        value={input.assumptions.monthlySavings}
        onChange={(v) => set("monthlySavings", Math.max(0, v))}
        min={0}
        max={1_000_000}
        step={500}
      />
      <NumberField
        label="Horisont (år)"
        value={input.assumptions.horizonYears}
        onChange={(v) => set("horizonYears", Math.min(50, Math.max(1, Math.round(v))))}
        min={1}
        max={50}
      />
      {!lockDeposits ? (
        <p className="text-xs text-muted-foreground sm:col-span-3">
          I den här mallen kan strategierna åsidosätta start- och månadsbelopp — se fälten i
          respektive kolumn.
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Strategy column**

Create `apps/web-simple/src/components/jamfor/strategy-column.tsx`. Highlighted fields render expanded; the rest live in a `<details>` "Fler antaganden". Account type is a three-button toggle (no Select dependency):

```tsx
import { useAtom } from "@effect/atom-react";
import type { ComparisonAccountType, StrategyInput } from "@sparstrategi/engine";
import { Button } from "@sparstrategi/ui/components/button";
import { Checkbox } from "@sparstrategi/ui/components/checkbox";
import { Label } from "@sparstrategi/ui/components/label";
import { NumberField } from "@sparstrategi/ui/components/number-field";
import { XIcon } from "lucide-react";

import { STRATEGY_COLORS } from "@/components/jamfor/jamfor-chart";
import { templateById } from "@/lib/templates";
import { comparisonInputAtom } from "@/state/comparison";

const ACCOUNT_LABELS: Record<ComparisonAccountType, string> = {
  isk: "ISK",
  af: "AF (depå)",
  kf: "KF",
};

/** Ett procentfält: UI i %, state i decimal. */
function PctField(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
  step?: number;
}) {
  return (
    <NumberField
      label={props.label}
      value={props.value * 100}
      onChange={(v) => props.onChange(v / 100)}
      min={0}
      max={props.max ?? 30}
      step={props.step ?? 0.1}
      suffix="%"
    />
  );
}

export function StrategyColumn({ index }: { index: number }) {
  const [input, setInput] = useAtom(comparisonInputAtom);
  const strategy = input.strategies[index];
  if (!strategy) return null;
  const template = templateById(input.templateId);
  const highlighted = new Set(template.highlightedFields);
  const canRemove = input.strategies.length > 2;

  const set = <K extends keyof StrategyInput>(key: K, value: StrategyInput[K]) =>
    setInput({
      ...input,
      strategies: input.strategies.map((s, i) => (i === index ? { ...s, [key]: value } : s)),
    });
  const remove = () =>
    setInput({ ...input, strategies: input.strategies.filter((_, i) => i !== index) });

  const isHi = (k: keyof StrategyInput) => highlighted.has(k);

  const renderField = (key: keyof StrategyInput) => {
    switch (key) {
      case "priceGrowth":
        return (
          <PctField key={key} label="Kurstillväxt (%/år)" value={strategy.priceGrowth} onChange={(v) => set("priceGrowth", v)} />
        );
      case "dividendYield":
        return (
          <PctField key={key} label="Direktavkastning (%/år)" value={strategy.dividendYield} onChange={(v) => set("dividendYield", v)} />
        );
      case "fundFeeRate":
        return (
          <PctField key={key} label="Fondavgift (%/år)" value={strategy.fundFeeRate} onChange={(v) => set("fundFeeRate", v)} max={5} step={0.05} />
        );
      case "accountType":
        return (
          <div key={key} className="space-y-1">
            <Label className="text-xs">Sparform</Label>
            <div className="flex gap-1.5">
              {(Object.keys(ACCOUNT_LABELS) as ComparisonAccountType[]).map((acct) => (
                <Button
                  key={acct}
                  type="button"
                  size="sm"
                  variant={strategy.accountType === acct ? "default" : "outline"}
                  onClick={() => set("accountType", acct)}
                >
                  {ACCOUNT_LABELS[acct]}
                </Button>
              ))}
            </div>
          </div>
        );
      case "reinvestDividends":
        return (
          <div key={key} className="flex items-center gap-2">
            <Checkbox
              checked={strategy.reinvestDividends}
              onCheckedChange={(c) => set("reinvestDividends", c === true)}
            />
            <Label className="text-xs">Återinvestera utdelningar</Label>
          </div>
        );
      case "foreignWithholdingRate":
        return (
          <PctField key={key} label="Utländsk källskatt på utdelning (%)" value={strategy.foreignWithholdingRate} onChange={(v) => set("foreignWithholdingRate", v)} max={35} step={1} />
        );
      case "holdingsCount":
        return (
          <NumberField key={key} label="Antal innehav" value={strategy.holdingsCount} onChange={(v) => set("holdingsCount", Math.max(1, Math.round(v)))} min={1} max={100} />
        );
      case "courtageFlat":
        return (
          <NumberField key={key} label="Minimicourtage (kr/affär)" value={strategy.courtageFlat} onChange={(v) => set("courtageFlat", Math.max(0, v))} min={0} max={200} step={1} />
        );
      case "courtageRate":
        return (
          <PctField key={key} label="Courtage (% av affär)" value={strategy.courtageRate} onChange={(v) => set("courtageRate", v)} max={2} step={0.05} />
        );
      case "fxFeeRate":
        return (
          <PctField key={key} label="Valutaväxlingsavgift (%)" value={strategy.fxFeeRate} onChange={(v) => set("fxFeeRate", v)} max={2} step={0.05} />
        );
      case "rebalancesPerYear":
        return (
          <NumberField key={key} label="Ombalanseringar per år" value={strategy.rebalancesPerYear} onChange={(v) => set("rebalancesPerYear", Math.max(0, Math.round(v)))} min={0} max={12} />
        );
      case "turnoverShare":
        return (
          <PctField key={key} label="Omsatt andel per ombalansering (%)" value={strategy.turnoverShare} onChange={(v) => set("turnoverShare", v)} max={100} step={5} />
        );
      case "spreadRate":
        return (
          <PctField key={key} label="Spread (% per rundresa)" value={strategy.spreadRate} onChange={(v) => set("spreadRate", v)} max={2} step={0.05} />
        );
      case "startCapitalOverride":
        return (
          <NumberField key={key} label="Eget startkapital (kr)" value={strategy.startCapitalOverride ?? 0} onChange={(v) => set("startCapitalOverride", Math.max(0, v))} min={0} max={100_000_000} step={10_000} />
        );
      case "monthlySavingsOverride":
        return (
          <NumberField key={key} label="Eget månadssparande (kr/mån)" value={strategy.monthlySavingsOverride ?? 0} onChange={(v) => set("monthlySavingsOverride", Math.max(0, v))} min={0} max={1_000_000} step={500} />
        );
      default:
        return null;
    }
  };

  const ALL_FIELDS: ReadonlyArray<keyof StrategyInput> = [
    "priceGrowth",
    "dividendYield",
    "fundFeeRate",
    "accountType",
    "reinvestDividends",
    "foreignWithholdingRate",
    "holdingsCount",
    "courtageFlat",
    "courtageRate",
    "fxFeeRate",
    "rebalancesPerYear",
    "turnoverShare",
    "spreadRate",
    ...(template.lockDeposits
      ? []
      : (["startCapitalOverride", "monthlySavingsOverride"] as const)),
  ];
  const expanded = ALL_FIELDS.filter(isHi);
  const collapsed = ALL_FIELDS.filter((k) => !isHi(k));

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <input
          value={strategy.name}
          onChange={(e) => set("name", e.target.value)}
          className="w-full bg-transparent text-sm font-semibold outline-none"
          style={{ color: STRATEGY_COLORS[index % STRATEGY_COLORS.length] }}
          aria-label="Strateginamn"
        />
        {canRemove ? (
          <button type="button" onClick={remove} aria-label="Ta bort strategi">
            <XIcon className="size-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        ) : null}
      </div>
      {expanded.map(renderField)}
      {collapsed.length > 0 ? (
        <details className="pt-1">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Fler antaganden
          </summary>
          <div className="mt-2 space-y-3">{collapsed.map(renderField)}</div>
        </details>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Chart**

Create `apps/web-simple/src/components/jamfor/jamfor-chart.tsx` (same Recharts conventions as `kapitalmotor/comparison-chart.tsx`):

```tsx
import { useAtomValue } from "@effect/atom-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { fmtKr } from "@/lib/format";
import { comparisonResultsAtom } from "@/state/comparison";

export const STRATEGY_COLORS = ["#34d399", "#fbbf24", "#60a5fa"] as const;

export function JamforChart() {
  const results = useAtomValue(comparisonResultsAtom);
  if (results.length === 0) return null;

  const data = results[0]!.rows.map((row, idx) => {
    const point: Record<string, number> = { year: row.year };
    results.forEach((r, i) => {
      point[`s${i}`] = r.rows[idx]?.value ?? 0;
    });
    return point;
  });

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
        Värdeutveckling
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="year"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickFormatter={(v: number) => fmtKr(v)}
              width={72}
            />
            <Tooltip
              formatter={(value: unknown, name: unknown) => [fmtKr(Number(value)), String(name)]}
              labelFormatter={(l) => `År ${l}`}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
            {results.map((r, i) => (
              <Line
                key={r.name + i}
                type="monotone"
                dataKey={`s${i}`}
                name={r.name}
                stroke={STRATEGY_COLORS[i % STRATEGY_COLORS.length]}
                strokeWidth={2.5}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: KPIs**

Create `apps/web-simple/src/components/jamfor/jamfor-kpis.tsx`:

```tsx
import { useAtomValue } from "@effect/atom-react";

import { STRATEGY_COLORS } from "@/components/jamfor/jamfor-chart";
import { fmtKr } from "@/lib/format";
import { comparisonResultsAtom } from "@/state/comparison";

export function JamforKpis() {
  const results = useAtomValue(comparisonResultsAtom);
  if (results.length === 0) return null;

  const best = results.reduce((a, b) =>
    b.final.valueAfterRealization > a.final.valueAfterRealization ? b : a,
  );
  const worst = results.reduce((a, b) =>
    b.final.valueAfterRealization < a.final.valueAfterRealization ? b : a,
  );
  const diff = best.final.valueAfterRealization - worst.final.valueAfterRealization;
  const diffPct =
    worst.final.valueAfterRealization > 0 ? diff / worst.final.valueAfterRealization : 0;

  return (
    <div className="space-y-3">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${results.length}, 1fr)` }}>
        {results.map((r, i) => (
          <div key={r.name + i} className="rounded-xl border bg-card p-4">
            <div
              className="text-xs font-semibold"
              style={{ color: STRATEGY_COLORS[i % STRATEGY_COLORS.length] }}
            >
              {r.name}
            </div>
            <div className="mt-1 text-lg font-bold">{fmtKr(r.final.valueAfterRealization)}</div>
            <div className="text-xs text-muted-foreground">efter skatt vid försäljning</div>
            <dl className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Värde före realisation</dt>
                <dd>{fmtKr(r.final.value)}</dd>
              </div>
              {r.final.dividendsReceived > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Utbetalda utdelningar</dt>
                  <dd>{fmtKr(r.final.dividendsReceived)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Betalt i avgifter</dt>
                <dd>{fmtKr(r.final.paidFees)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Betalt i skatt</dt>
                <dd>{fmtKr(r.final.paidTax)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Transaktionskostnader</dt>
                <dd>{fmtKr(r.final.paidTransactionCosts)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Förlorat till friktion</dt>
                <dd>{fmtKr(r.final.lostToFriction)}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
      {results.length > 1 && diff > 0 ? (
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-2.5 text-xs text-emerald-300">
          Skillnad: {fmtKr(diff)} ({(diffPct * 100).toFixed(0)} %) mer i {best.name} än i{" "}
          {worst.name}, efter skatt vid försäljning.
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Per-year table (behind a toggle)**

Create `apps/web-simple/src/components/jamfor/jamfor-table.tsx`:

```tsx
import { useAtomValue } from "@effect/atom-react";

import { STRATEGY_COLORS } from "@/components/jamfor/jamfor-chart";
import { fmtKr } from "@/lib/format";
import { comparisonResultsAtom } from "@/state/comparison";

export function JamforTable() {
  const results = useAtomValue(comparisonResultsAtom);
  if (results.length === 0) return null;

  return (
    <details className="rounded-xl border bg-card p-5">
      <summary className="cursor-pointer text-xs uppercase tracking-wider text-muted-foreground">
        Tabell per år
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-1.5 pr-2 text-left font-normal">År</th>
              {results.map((r, i) => (
                <th
                  key={r.name + i}
                  className="py-1.5 pl-3 font-normal"
                  style={{ color: STRATEGY_COLORS[i % STRATEGY_COLORS.length] }}
                >
                  {r.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results[0]!.rows.map((row, idx) => (
              <tr key={row.year} className="border-b border-border/40">
                <td className="py-1 pr-2 text-left">{row.year}</td>
                {results.map((r, i) => (
                  <td key={i} className="py-1 pl-3">
                    {fmtKr(r.rows[idx]?.value ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
```

- [ ] **Step 6: The view shell**

Create `apps/web-simple/src/views/jamfor.tsx`:

```tsx
import { useAtom } from "@effect/atom-react";
import { defaultStrategyInput } from "@sparstrategi/engine";
import { Button } from "@sparstrategi/ui/components/button";
import { ArrowLeftIcon, PlusIcon, Share2Icon } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { AssumptionsBar } from "@/components/jamfor/assumptions-bar";
import { JamforChart } from "@/components/jamfor/jamfor-chart";
import { JamforKpis } from "@/components/jamfor/jamfor-kpis";
import { JamforTable } from "@/components/jamfor/jamfor-table";
import { StrategyColumn } from "@/components/jamfor/strategy-column";
import { navigate } from "@/lib/router";
import { templateById } from "@/lib/templates";
import {
  comparisonInputAtom,
  comparisonShareUrl,
  consumePendingTemplate,
} from "@/state/comparison";

export function JamforView() {
  const [input, setInput] = useAtom(comparisonInputAtom);
  const template = templateById(input.templateId);

  useEffect(() => {
    const pending = consumePendingTemplate();
    if (pending) setInput(pending);
  }, [setInput]);

  const handleShare = () => {
    navigator.clipboard
      .writeText(comparisonShareUrl(input))
      .then(() => toast.success("Länk kopierad"))
      .catch(() => toast.error("Kunde inte kopiera länken"));
  };

  const addStrategy = () =>
    setInput({
      ...input,
      strategies: [
        ...input.strategies,
        { ...defaultStrategyInput(`Strategi ${String.fromCharCode(65 + input.strategies.length)}`) },
      ],
    });

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate("start")}
            className="mb-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3" /> Alla verktyg
          </button>
          <h1 className="text-2xl font-bold">{template.title}</h1>
          <p className="text-sm text-muted-foreground">{template.question}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleShare}>
          <Share2Icon className="size-3.5" />
          Dela
        </Button>
      </div>

      <div className="space-y-4">
        <AssumptionsBar lockDeposits={template.lockDeposits} />
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${input.strategies.length}, minmax(0, 1fr))` }}
        >
          {input.strategies.map((_, i) => (
            <StrategyColumn key={i} index={i} />
          ))}
        </div>
        {input.strategies.length < 3 ? (
          <Button type="button" variant="outline" size="sm" onClick={addStrategy}>
            <PlusIcon className="size-3.5" /> Lägg till strategi
          </Button>
        ) : null}
        <JamforKpis />
        <JamforChart />
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
            Varför blir det så här?
          </div>
          <p className="text-sm text-muted-foreground">{template.explainer}</p>
        </div>
        <JamforTable />
      </div>

      <footer className="mx-auto mt-10 max-w-7xl px-4 pb-6 text-xs text-muted-foreground">
        Fristående, uträkningarna körs helt i webbläsaren — inget sparas eller skickas till någon
        server. "Dela" kodar in dina värden i URL:en. Illustrativt räkneexempel, inte finansiell
        rådgivning.
      </footer>
    </div>
  );
}
```

- [ ] **Step 7: Wire into App**

In `apps/web-simple/src/App.tsx`:

```tsx
import { JamforView } from "@/views/jamfor";
// ...
      {view === "kapitalmotor" ? (
        <KapitalmotorView />
      ) : view === "jamfor" ? (
        <JamforView />
      ) : (
        <StartView />
      )}
```

- [ ] **Step 8: Verify — type check, build, manual smoke**

Run: `bun run check-types && bun run build`
Expected: clean. Dev-server manual pass:
1. Start page → "Vad kostar fondavgiften?" → two columns with only Fondavgift expanded, chart diverges, "Betalt i avgifter" larger in Aktiv fond.
2. "ISK, AF eller KF?" → three columns; lowering Kurstillväxt to 1 % flips the winner to AF.
3. Dela → URL with `?j=…#/jamfor` reopens the exact comparison in a new tab.
4. `#/kapitalmotor` unaffected; old `?s=` link still opens Kapitalmotor.

- [ ] **Step 9: Commit**

```bash
git add apps/web-simple/src
git commit -m "feat(web-simple): comparison view with strategy columns, chart, KPIs and explainers"
```

---

### Task 9: Full verification pass

**Files:** none new.

- [ ] **Step 1: Run everything**

```bash
bun run check-types && bun test && bun run build
```

Expected: all clean, including the untouched document-reproduction anchor in `packages/engine/test/simulate.test.ts` and `kapitalmotor.test.ts`.

- [ ] **Step 2: Manual regression of the deployed-page flows**

With `cd apps/web-simple && bun run dev`:
- Every template card opens with sensible prefills and a visibly differing chart.
- "Egen jämförelse" starts with two identical strategies (flat difference of 0).
- Lägg till strategi caps at 3; Ta bort works down to 2.
- DCA template shows the deposit-override fields; others don't.

- [ ] **Step 3: Commit any fixes; then done**

If fixes were needed, commit them as `fix(web-simple): …`. The branch is ready for review/deploy (GitHub Pages workflow builds web-simple on push to master).
