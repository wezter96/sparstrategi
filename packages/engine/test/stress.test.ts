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
