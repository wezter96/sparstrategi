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

describe("requiredIskCapital", () => {
  test("matches the document's ~457 Mkr figure directly", () => {
    expect(requiredIskCapital(1_000_000_000, documentInput)).toBeCloseTo(457_142_857, -3);
  });

  test("is 0 when there's no interest or living-cost need", () => {
    expect(requiredIskCapital(0, { ...documentInput, monthlyLivingCosts: 0 })).toBe(0);
  });

  test("is Infinity when return is non-positive but there's a funding need", () => {
    expect(requiredIskCapital(1_000_000_000, { ...documentInput, expectedReturn: 0 })).toBe(
      Number.POSITIVE_INFINITY,
    );
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
