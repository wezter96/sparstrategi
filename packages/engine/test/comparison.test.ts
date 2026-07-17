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
