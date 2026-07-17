import { describe, expect, test } from "bun:test";
import {
  geometricGrowthRate,
  growthRateCurve,
  kellyOptimalExposure,
  kellyOptimalLtvOfEquity,
} from "../src/kelly";

const params = { expectedReturn: 0.08, volatility: 0.18, loanRate: 0.04 };

describe("kellyOptimalExposure", () => {
  test("f* = (μ − r) / σ² för μ=8%, r=4%, σ=18%", () => {
    // (0.08 - 0.04) / 0.18^2 = 0.04 / 0.0324 = 1.2346
    expect(kellyOptimalExposure(params)).toBeCloseTo(1.2346, 3);
  });

  test("L* = f* − 1 ≈ 23,5% belåning av eget kapital", () => {
    expect(kellyOptimalLtvOfEquity(params)).toBeCloseTo(0.2346, 3);
  });

  test("σ=0 ger oändlig optimal exponering (riskfri hävstångsvinst)", () => {
    expect(kellyOptimalExposure({ ...params, volatility: 0 })).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("geometricGrowthRate", () => {
  test("toppen av tillväxtkurvan ligger vid f* (Kelly-optimum)", () => {
    const fStar = kellyOptimalExposure(params);
    const atStar = geometricGrowthRate(fStar, params);
    const below = geometricGrowthRate(fStar - 0.1, params);
    const above = geometricGrowthRate(fStar + 0.1, params);
    expect(atStar).toBeGreaterThan(below);
    expect(atStar).toBeGreaterThan(above);
  });

  test("för mycket hävstång (bortom Kelly) sänker den förväntade tillväxttakten", () => {
    const fStar = kellyOptimalExposure(params);
    const doubleStar = geometricGrowthRate(2 * fStar, params);
    const atStar = geometricGrowthRate(fStar, params);
    expect(doubleStar).toBeLessThan(atStar);
  });
});

describe("growthRateCurve", () => {
  test("kurvan är konkav och toppar nära Kelly-optimum", () => {
    const curve = growthRateCurve(params, { maxLtvOfEquity: 1.0, steps: 200 });
    const peak = curve.reduce((best, p) => (p.growthRate > best.growthRate ? p : best));
    const fStar = kellyOptimalExposure(params);
    expect(peak.exposure).toBeCloseTo(fStar, 1);
  });
});
