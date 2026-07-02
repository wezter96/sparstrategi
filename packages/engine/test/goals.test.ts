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
