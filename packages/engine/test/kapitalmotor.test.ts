import { describe, expect, test } from "bun:test";
import { defaultTaxParams2026 } from "../src/schema";
import { simulateKapitalmotor, type KapitalmotorInput } from "../src/kapitalmotor";

/**
 * Regression anchor: reproduces `belanad-kapitalmotor-5mdr.html` exactly.
 * 5 Mdr eget kapital, 20% belåning av eget kapital (→ 6 Mdr portfölj, 1 Mdr
 * lån), 8% avkastning, 4% låneränta, progressiv ränteavdrag 30%/21% (brytpunkt
 * 100 000 kr), ISK-schablonskatt 1,05% effektiv (SLR 2,5%). Do not weaken.
 */
const base: KapitalmotorInput = {
  equity: 5_000_000_000,
  targetLtvOfEquity: 0.2,
  expectedReturn: 0.08,
  loanRate: 0.04,
  taxParams: defaultTaxParams2026,
  horizonYears: 10,
  mode: "split",
  withdraw: true,
  capitalGainsTaxRate: 0.3,
};

describe("Alt 1 · split, withdraw (Tillväxt över tid-tabellen)", () => {
  const result = simulateKapitalmotor(base);

  test("start: 6,00 Mdr portfölj, 1,00 Mdr lån, AF 5,199 Mdr, ISK 0,801 Mdr", () => {
    const y0 = result.rows[0]!;
    expect(y0.portfolio).toBeCloseTo(6_000_000_000, -3);
    expect(y0.loan).toBeCloseTo(1_000_000_000, -3);
    expect(y0.af).toBeCloseTo(5_199_142_857, -1);
    expect(y0.isk).toBeCloseTo(800_857_143, -1);
  });

  test("år 1: ränta 40 Mkr, ränteavdrag 8,409 Mkr, konsumtion 24 068 571 kr, 0% nettoskatt", () => {
    const y1 = result.rows[1]!;
    expect(y1.interest).toBeCloseTo(40_000_000, -2);
    expect(y1.deduction).toBeCloseTo(8_409_000, -1);
    expect(y1.netTax).toBeCloseTo(0, 0);
    expect(y1.consumption).toBeCloseTo(24_068_571, -1);
    expect(y1.portfolio).toBeCloseTo(6_415_931_429, -1);
  });

  test("år 10: konsumtion 49 335 148 kr, portfölj 13,17 Mdr, belåning 20% av eget kapital vid start (visas 18,5% vid årsslut, pre-lever)", () => {
    const y10 = result.rows[10]!;
    expect(y10.consumption).toBeCloseTo(49_335_148, -1);
    expect(y10.portfolio).toBeCloseTo(13_170_529_579, -2);
    expect(y10.ltvOfEquity).toBeCloseTo(0.1846, 3);
  });

  test("belåningsgrad driftar till ≈18,5% varje årsslut (före det årets återbelåning) men återställs exakt till 20% vid varje årsskifte", () => {
    // Varje rad visar läget precis INNAN det årets egen återbelåning — därför
    // ~18,5%, inte 20% (se dokumentets förklaring). Men row[n+1].loan är det
    // JUST återbelånade lånet från skiftet mellan år n och n+1, så det ska
    // vara exakt 20% av row[n].equity.
    for (const row of result.rows.slice(1)) {
      expect(row.loan / row.equity).toBeCloseTo(0.1846, 3);
    }
    for (let n = 0; n < result.rows.length - 1; n++) {
      const row = result.rows[n]!;
      const next = result.rows[n + 1]!;
      expect(next.loan / row.equity).toBeCloseTo(0.2, 6);
    }
  });
});

describe("Alt 1 vs Alt 2 · allt återinvesteras (jämförelsegrafen)", () => {
  const reinvestSplit: KapitalmotorInput = { ...base, withdraw: false, horizonYears: 10 };
  const reinvestAllIsk: KapitalmotorInput = {
    ...base,
    mode: "allIsk",
    withdraw: false,
    horizonYears: 10,
  };

  test("Alt 1 (uppdelad) växer till 13,76 Mdr, Alt 2 (allt ISK) till 12,46 Mdr efter 10 år", () => {
    const alt1 = simulateKapitalmotor(reinvestSplit);
    const alt2 = simulateKapitalmotor(reinvestAllIsk);
    expect(alt1.rows.at(-1)!.portfolio / 13_757_702_871).toBeCloseTo(1, 5);
    expect(alt2.rows.at(-1)!.portfolio / 12_457_331_454).toBeCloseTo(1, 5);
  });

  test("Alt 1 har 0% effektiv skatt, Alt 2 ≈11,4%", () => {
    const alt1 = simulateKapitalmotor(reinvestSplit);
    const alt2 = simulateKapitalmotor(reinvestAllIsk);
    expect(alt1.rows[1]!.effectiveTaxRate).toBeCloseTo(0, 2);
    expect(alt2.rows[1]!.effectiveTaxRate).toBeCloseTo(0.1137, 3);
  });
});

describe("Realiserat AF-värde (latent skatt)", () => {
  test("brytpunkt: realiserat Alt 1 går om Alt 2 mellan år 22 och 23", () => {
    const long: KapitalmotorInput = { ...base, withdraw: false, horizonYears: 30 };
    const alt1 = simulateKapitalmotor(long);
    const alt2 = simulateKapitalmotor({ ...long, mode: "allIsk" });

    const diff = (y: number) => alt1.rows[y]!.realizedNetWorth - alt2.rows[y]!.portfolio;
    expect(diff(22)).toBeLessThan(0);
    expect(diff(23)).toBeGreaterThan(0);
  });

  test("år 100: realiserat Alt 1 ≈20 712 Mdr, bokfört (aldrig sälj) ≈27 236 Mdr, Alt 2 ≈9 948 Mdr", () => {
    const long: KapitalmotorInput = { ...base, withdraw: false, horizonYears: 100 };
    const alt1 = simulateKapitalmotor(long);
    const alt2 = simulateKapitalmotor({ ...long, mode: "allIsk" });
    const y100 = alt1.rows.at(-1)!;
    expect(y100.portfolio / 27_236_199_598_525).toBeCloseTo(1, 3);
    expect(y100.realizedNetWorth / 20_712_004_810_018).toBeCloseTo(1, 3);
    expect(alt2.rows.at(-1)!.portfolio / 9_948_244_465_371).toBeCloseTo(1, 3);
  });
});
