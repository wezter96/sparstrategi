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
