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
