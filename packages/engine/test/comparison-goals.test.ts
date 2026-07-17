import { describe, expect, test } from "bun:test";
import { defaultTaxParams2026 } from "../src/schema";
import {
  compareStrategies,
  defaultStrategyInput,
  simulateStrategy,
  type ComparisonAssumptions,
} from "../src/comparison";
import { evaluateComparisonGoal } from "../src/comparison-goals";
import {
  simulateComparisonMonteCarlo,
} from "../src/comparison-montecarlo";

const a: ComparisonAssumptions = {
  startCapital: 100_000,
  monthlySavings: 3_000,
  horizonYears: 20,
  taxParams: defaultTaxParams2026,
};

describe("sparmål i jämförelsemotorn", () => {
  test("mål som nås: hitYear sätts, shortfall 0, inget krävt extra sparande", () => {
    const s = [defaultStrategyInput("ISK")];
    const res = evaluateComparisonGoal(a, s, compareStrategies(a, s), {
      amount: 500_000,
      year: 20,
    });
    expect(res[0]!.hitYear).not.toBeNull();
    expect(res[0]!.hitYear!).toBeLessThanOrEqual(20);
    expect(res[0]!.shortfall).toBe(0);
    expect(res[0]!.requiredMonthlySavings).toBeNull();
  });

  test("mål som inte nås: krävt månadssparande löses, och att spara så mycket når målet", () => {
    const s = [defaultStrategyInput("ISK")];
    const goal = { amount: 3_000_000, year: 15 };
    const res = evaluateComparisonGoal(a, s, compareStrategies(a, s), goal);
    expect(res[0]!.hitYear === null || res[0]!.hitYear! > 15).toBe(true);
    expect(res[0]!.shortfall).toBeGreaterThan(0);
    const required = res[0]!.requiredMonthlySavings;
    expect(required).not.toBeNull();
    // Verifiera lösningen: kör med det lösta sparandet och kontrollera målet.
    const check = simulateStrategy(a, {
      ...s[0]!,
      monthlySavingsOverride: required!,
    });
    const at15 = check.rows.find((r) => r.year === 15)!;
    expect(at15.valueAfterRealization / goal.amount).toBeCloseTo(1, 4);
  });

  test("AF utvärderas netto efter latent skatt — senare hitYear än ISK vid samma bruttoavkastning", () => {
    const isk = defaultStrategyInput("ISK");
    const af = { ...defaultStrategyInput("AF"), accountType: "af" as const };
    const s = [isk, af];
    const res = evaluateComparisonGoal(a, s, compareStrategies(a, s), {
      amount: 800_000,
    });
    expect(res[0]!.hitYear).not.toBeNull();
    expect(res[1]!.hitYear).not.toBeNull();
    expect(res[1]!.hitYear!).toBeGreaterThanOrEqual(res[0]!.hitYear!);
  });

  test("onåbart mål: requiredMonthlySavings null", () => {
    const s = [defaultStrategyInput("ISK")];
    const res = evaluateComparisonGoal(a, s, compareStrategies(a, s), {
      amount: 10_000_000_000,
      year: 5,
    });
    expect(res[0]!.requiredMonthlySavings).toBeNull();
  });
});

describe("Monte Carlo i jämförelsemotorn", () => {
  const mc = simulateComparisonMonteCarlo({
    assumptions: a,
    strategy: defaultStrategyInput("ISK"),
    volatility: 0.18,
    paths: 300,
    seed: 42,
  });

  test("percentilerna är ordnade och medianen nära den deterministiska banan", () => {
    const det = simulateStrategy(a, defaultStrategyInput("ISK"));
    for (const y of mc.years) {
      expect(y.p10).toBeLessThanOrEqual(y.p50);
      expect(y.p50).toBeLessThanOrEqual(y.p90);
    }
    const detFinal = det.rows.at(-1)!.value;
    const mcFinal = mc.years.at(-1)!;
    // Lognormal: medianen ligger under väntevärdet men i samma härad.
    expect(mcFinal.p50).toBeGreaterThan(detFinal * 0.5);
    expect(mcFinal.p50).toBeLessThan(detFinal * 1.3);
    expect(mcFinal.p90).toBeGreaterThan(detFinal);
  });

  test("deterministisk: samma seed ger exakt samma band", () => {
    const again = simulateComparisonMonteCarlo({
      assumptions: a,
      strategy: defaultStrategyInput("ISK"),
      volatility: 0.18,
      paths: 300,
      seed: 42,
    });
    expect(again.years.at(-1)!.p50).toBe(mc.years.at(-1)!.p50);
  });

  test("noll volatilitet kollapsar bandet till den deterministiska banan", () => {
    const zero = simulateComparisonMonteCarlo({
      assumptions: a,
      strategy: defaultStrategyInput("ISK"),
      volatility: 0,
      paths: 10,
      seed: 1,
    });
    const det = simulateStrategy(a, defaultStrategyInput("ISK"));
    expect(zero.years.at(-1)!.p10 / det.rows.at(-1)!.value).toBeCloseTo(1, 6);
    expect(zero.years.at(-1)!.p90 / det.rows.at(-1)!.value).toBeCloseTo(1, 6);
  });

  test("priceGrowthByYear-override reproducerar konstant avkastning exakt", () => {
    const det = simulateStrategy(a, defaultStrategyInput("ISK"));
    const overridden = simulateStrategy(a, defaultStrategyInput("ISK"), {
      priceGrowthByYear: Array.from({ length: a.horizonYears }, () => 0.07),
    });
    expect(overridden.rows.at(-1)!.value).toBeCloseTo(det.rows.at(-1)!.value, 6);
  });
});
