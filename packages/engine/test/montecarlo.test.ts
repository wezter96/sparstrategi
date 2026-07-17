import { describe, expect, test } from "bun:test";
import { defaultTaxParams2026 } from "../src/schema";
import { simulateMonteCarlo, type MonteCarloInput } from "../src/montecarlo";

const base: MonteCarloInput = {
  equity: 5_000_000_000,
  targetLtvOfEquity: 0.2,
  expectedReturn: 0.08,
  volatility: 0.18,
  loanRate: 0.04,
  taxParams: defaultTaxParams2026,
  horizonYears: 10,
  capitalGainsTaxRate: 0.3,
  maxLtvOfTotal: 0.6,
  withdraw: false,
  paths: 500,
  seed: 42,
};

describe("simulateMonteCarlo", () => {
  test("σ=0 degenererar till exakt det deterministiska scenariot (regressionsankaret)", () => {
    const result = simulateMonteCarlo({ ...base, volatility: 0 });
    const y10 = result.years[10]!;
    // Samma referensvärde som kapitalmotor-testernas "allt återinvesteras"-scenario.
    expect(y10.p50 / 13_757_702_871).toBeCloseTo(1, 3);
    expect(y10.p5).toBeCloseTo(y10.p95, 0);
  });

  test("är deterministisk för samma seed", () => {
    const a = simulateMonteCarlo(base);
    const b = simulateMonteCarlo(base);
    expect(a.years.at(-1)!.p50).toBe(b.years.at(-1)!.p50);
  });

  test("högre volatilitet ger bredare percentilspridning", () => {
    const low = simulateMonteCarlo({ ...base, volatility: 0.1 });
    const high = simulateMonteCarlo({ ...base, volatility: 0.35 });
    const spread = (r: ReturnType<typeof simulateMonteCarlo>) => {
      const y = r.years.at(-1)!;
      return y.p95 - y.p5;
    };
    expect(spread(high)).toBeGreaterThan(spread(low));
  });

  test("högre belåning vid hög volatilitet ökar sannolikheten för margin call", () => {
    const modest = simulateMonteCarlo({ ...base, volatility: 0.3, targetLtvOfEquity: 0.2 });
    const aggressive = simulateMonteCarlo({ ...base, volatility: 0.3, targetLtvOfEquity: 1.5 });
    expect(aggressive.finalMarginCallProbability).toBeGreaterThan(modest.finalMarginCallProbability);
  });

  test("percentiler är monotont ordnade varje år", () => {
    const result = simulateMonteCarlo(base);
    for (const y of result.years) {
      expect(y.p5).toBeLessThanOrEqual(y.p25);
      expect(y.p25).toBeLessThanOrEqual(y.p50);
      expect(y.p50).toBeLessThanOrEqual(y.p75);
      expect(y.p75).toBeLessThanOrEqual(y.p95);
    }
  });
});
