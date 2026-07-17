import { describe, expect, test } from "bun:test";
import { defaultTaxParams2026 } from "../src/schema";
import { simulateKapitalmotor, type KapitalmotorInput } from "../src/kapitalmotor";

/**
 * Regression anchor: reproduces `belanad-kapitalmotor-5mdr.html`, med ett
 * avsiktligt tillägg: ISK-kalibreringen inkluderar fribeloppet (300 tkr), som
 * dokumentet saknar. Alla avvikelser från dokumentets tal är exakt fribeloppets
 * bidrag (300 tkr flyttat AF→ISK, avkastning 24 tkr/år på det). 5 Mdr eget
 * kapital, 20% belåning av eget kapital (→ 6 Mdr portfölj, 1 Mdr lån), 8%
 * avkastning, 4% låneränta, progressiv ränteavdrag 30%/21% (brytpunkt
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
  monthlySavings: 0,
};

describe("Alt 1 · split, withdraw (Tillväxt över tid-tabellen)", () => {
  const result = simulateKapitalmotor(base);

  test("start: 6,00 Mdr portfölj, 1,00 Mdr lån, AF 5,1988 Mdr, ISK 0,8012 Mdr (dokumentets 0,8009 + fribeloppet 300 tkr)", () => {
    const y0 = result.rows[0]!;
    expect(y0.portfolio).toBeCloseTo(6_000_000_000, -3);
    expect(y0.loan).toBeCloseTo(1_000_000_000, -3);
    expect(y0.af).toBeCloseTo(5_198_842_857, -1);
    expect(y0.isk).toBeCloseTo(801_157_143, -1);
  });

  test("år 1: ränta 40 Mkr, ränteavdrag 8,409 Mkr (fullt utnyttjat), konsumtion 24 092 571 kr, 0% nettoskatt", () => {
    const y1 = result.rows[1]!;
    expect(y1.interest).toBeCloseTo(40_000_000, -2);
    expect(y1.deduction).toBeCloseTo(8_409_000, -1);
    expect(y1.netTax).toBeCloseTo(0, 0);
    // Dokumentets 24 068 571 kr + fribeloppets avkastning 300 tkr × 8% = 24 tkr.
    expect(y1.consumption).toBeCloseTo(24_092_571, -1);
    expect(y1.portfolio).toBeCloseTo(6_415_907_429, -1);
  });

  test("år 10: konsumtion 49 357 690 kr, portfölj 13,17 Mdr, belåning 20% av eget kapital vid start (visas 18,5% vid årsslut, pre-lever)", () => {
    const y10 = result.rows[10]!;
    expect(y10.consumption).toBeCloseTo(49_357_690, -1);
    expect(y10.portfolio).toBeCloseTo(13_170_115_826, -2);
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

describe("Skuldfritt nettovärde (latent skatt + lån)", () => {
  test("debtFreeNetWorth = realizedNetWorth − lån, båda lägena", () => {
    const long: KapitalmotorInput = { ...base, withdraw: false, horizonYears: 30 };
    for (const mode of ["split", "allIsk"] as const) {
      const { rows } = simulateKapitalmotor({ ...long, mode });
      for (const row of rows) {
        expect(row.debtFreeNetWorth).toBeCloseTo(row.realizedNetWorth - row.loan, 6);
      }
    }
  });

  test("rättvis brytpunkt (skuldfritt netto): Alt 1 går om Alt 2 mellan år 29 och 30", () => {
    // Jämför pengar-i-handen: portfölj − latent AF-skatt − eget lån. Lånen är
    // olika stora (Alt 1:s eget kapital växer snabbare), så bruttojämförelse
    // utan låneavdrag gynnar Alt 1 och gav en falsk brytpunkt vid ~år 23.
    const long: KapitalmotorInput = { ...base, withdraw: false, horizonYears: 35 };
    const alt1 = simulateKapitalmotor(long);
    const alt2 = simulateKapitalmotor({ ...long, mode: "allIsk" });

    const diff = (y: number) => alt1.rows[y]!.debtFreeNetWorth - alt2.rows[y]!.debtFreeNetWorth;
    expect(diff(29)).toBeLessThan(0);
    expect(diff(30)).toBeGreaterThan(0);
  });

  test("år 100: Alt 1 bokfört ≈27 236 Mdr, realiserat ≈20 712 Mdr, skuldfritt ≈16 483 Mdr; Alt 2 skuldfritt ≈8 390 Mdr", () => {
    const long: KapitalmotorInput = { ...base, withdraw: false, horizonYears: 100 };
    const alt1 = simulateKapitalmotor(long);
    const alt2 = simulateKapitalmotor({ ...long, mode: "allIsk" });
    const y100 = alt1.rows.at(-1)!;
    expect(y100.portfolio / 27_236_199_598_525).toBeCloseTo(1, 3);
    expect(y100.realizedNetWorth / 20_712_005_530_018).toBeCloseTo(1, 3);
    expect(y100.debtFreeNetWorth / 16_482_781_989_874).toBeCloseTo(1, 3);
    expect(alt2.rows.at(-1)!.debtFreeNetWorth / 8_390_345_690_146).toBeCloseTo(1, 3);
  });
});

describe("Fribeloppet i ISK-kalibreringen", () => {
  test("autokalibrerad ISK = ränteavdrag/skattesats + fribelopp, och nettoskatten är exakt 0", () => {
    const { rows } = simulateKapitalmotor(base);
    // te = max(2,5% + 1pp, 1,25%) × 30% = 1,05%; avdrag år 1 = 8 409 000 kr.
    expect(rows[0]!.isk).toBeCloseTo(8_409_000 / 0.0105 + 300_000, 0);
    for (const row of rows.slice(1)) {
      expect(row.netTax).toBeCloseTo(0, 6);
      expect(row.deduction - row.iskTaxAmount).toBeCloseTo(0, 0); // avdraget fullt utnyttjat
    }
  });

  test("litet kapital: ISK klampas till hela portföljen (AF ≥ 0)", () => {
    const { rows } = simulateKapitalmotor({ ...base, equity: 200_000 });
    expect(rows[0]!.isk).toBeCloseTo(240_000, 6); // hela portföljen (200 tkr + 40 tkr lån)
    expect(rows[0]!.af).toBeCloseTo(0, 6);
  });
});
