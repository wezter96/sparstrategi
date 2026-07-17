import { describe, expect, test } from "bun:test";
import { defaultTaxParams2026 } from "../src/schema";
import {
  compareStrategies,
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

describe("kontoskatt", () => {
  const isk = (over: Partial<StrategyInput> = {}): StrategyInput => ({
    ...defaultStrategyInput("isk"),
    fundFeeRate: 0,
    ...over,
  });

  test("utdelningsekvivalens på ISK: 7+0 och 3+4 ger exakt samma värde vid återinvestering", () => {
    const a = assumptions({ monthlySavings: 2_000 });
    const growth = simulateStrategy(a, isk({ priceGrowth: 0.07, dividendYield: 0 }));
    const dividend = simulateStrategy(a, isk({ priceGrowth: 0.03, dividendYield: 0.04 }));
    expect(dividend.final.value).toBeCloseTo(growth.final.value, 4);
  });

  test("på AF är utdelningsstrategin strikt sämre än tillväxt vid samma totalavkastning", () => {
    const a = assumptions();
    const growth = simulateStrategy(
      a,
      isk({ accountType: "af", priceGrowth: 0.07, dividendYield: 0 }),
    );
    const dividend = simulateStrategy(
      a,
      isk({ accountType: "af", priceGrowth: 0.03, dividendYield: 0.04 }),
    );
    expect(dividend.final.valueAfterRealization).toBeLessThan(
      growth.final.valueAfterRealization,
    );
  });

  test("brytpunkt: vid låg avkastning vinner AF, vid hög vinner ISK (efter full realisation)", () => {
    // Stort kapital så ISK-fribeloppet inte dominerar.
    const a = assumptions({ startCapital: 5_000_000 });
    const low = (acct: "isk" | "af") =>
      simulateStrategy(a, isk({ accountType: acct, priceGrowth: 0.02 })).final
        .valueAfterRealization;
    const high = (acct: "isk" | "af") =>
      simulateStrategy(a, isk({ accountType: acct, priceGrowth: 0.1 })).final
        .valueAfterRealization;
    expect(low("af")).toBeGreaterThan(low("isk"));
    expect(high("isk")).toBeGreaterThan(high("af"));
  });

  test("KF har ingen fribeloppseffekt: under 300 tkr betalar ISK 0 kr schablon, KF > 0", () => {
    const a = assumptions({ startCapital: 200_000, horizonYears: 1 });
    const onIsk = simulateStrategy(a, isk({ priceGrowth: 0.0 }));
    const onKf = simulateStrategy(a, isk({ accountType: "kf", priceGrowth: 0.0 }));
    expect(onIsk.final.paidTax).toBe(0);
    expect(onKf.final.paidTax).toBeGreaterThan(0);
  });

  test("källskatt: KF återfår allt, ISK tappar bara det som överstiger schablonskatten", () => {
    const a = assumptions({ startCapital: 1_000_000, horizonYears: 1 });
    const base = { priceGrowth: 0.04, dividendYield: 0.03, foreignWithholdingRate: 0.15 };
    const onKf = simulateStrategy(a, isk({ ...base, accountType: "kf" }));
    const onIsk = simulateStrategy(a, isk({ ...base }));
    // KF: schablon men ingen källskattekostnad. ISK: schablon + ev. oåterfådd källskatt.
    // Här: källskatt 0,15 × 3% × ~1 Mkr ≈ 4 500 kr > ISK-schablon (~7 350 kr)? Nej — 4 500 < 7 350,
    // alltså full avräkning: ISK och KF skiljer sig bara i fribeloppet.
    const kfSchablon = onKf.final.paidTax;
    const iskSchablon = onIsk.final.paidTax;
    expect(iskSchablon).toBeLessThan(kfSchablon); // fribeloppet 300 tkr
    // AF: kostnaden är max(källskatt, 30% × utdelning) = 30% × utdelning.
    const onAf = simulateStrategy(a, isk({ ...base, accountType: "af" }));
    const div = 0.03 * (1_000_000);
    expect(onAf.rows[1]!.paidTax).toBeCloseTo(0.3 * div, 0);
  });

  test("latent skatt: AF-raden redovisar 30 % av orealiserad vinst och valueAfterRealization drar av den", () => {
    const r = simulateStrategy(
      assumptions({ horizonYears: 5 }),
      isk({ accountType: "af", priceGrowth: 0.07 }),
    );
    const y5 = r.rows.at(-1)!;
    expect(y5.latentTax).toBeCloseTo(0.3 * (y5.value - y5.basis), 6);
    expect(y5.valueAfterRealization).toBeCloseTo(y5.value - y5.latentTax, 6);
  });
});

describe("transaktionskostnader", () => {
  test("courtage år 1: 12 månadsköp × 8 innehav × minimicourtage när procentsatsen är lägre", () => {
    const a = assumptions({ startCapital: 0, monthlySavings: 1_000, horizonYears: 1 });
    const s: StrategyInput = {
      ...defaultStrategyInput("aktier"),
      fundFeeRate: 0,
      holdingsCount: 8,
      courtageFlat: 5,
      courtageRate: 0.0025, // 0,25 % av 125 kr = 0,31 kr < 5 kr ⇒ flat gäller
    };
    const r = simulateStrategy(a, s);
    expect(r.final.paidTransactionCosts).toBeCloseTo(12 * 8 * 5, 6);
  });

  test("procentcourtage gäller när det överstiger minimicourtaget", () => {
    const a = assumptions({ startCapital: 1_000_000, monthlySavings: 0, horizonYears: 1 });
    const s: StrategyInput = {
      ...defaultStrategyInput("stort köp"),
      fundFeeRate: 0,
      holdingsCount: 1,
      courtageFlat: 5,
      courtageRate: 0.0025, // 0,25 % av 1 Mkr = 2 500 kr > 5 kr
    };
    const r = simulateStrategy(a, s);
    expect(r.rows[0]!.paidTransactionCosts).toBeCloseTo(2_500, 6);
  });

  test("ombalanseringskostnad är linjär i antal ombalanseringar (ettårshorisont)", () => {
    const a = assumptions({ startCapital: 1_000_000, horizonYears: 1 });
    const mk = (n: number): StrategyInput => ({
      ...defaultStrategyInput("rebal"),
      fundFeeRate: 0,
      priceGrowth: 0,
      rebalancesPerYear: n,
      turnoverShare: 0.1,
      spreadRate: 0.001,
      courtageRate: 0.0005,
    });
    const cost = (n: number) => simulateStrategy(a, mk(n)).final.paidTransactionCosts;
    const c0 = cost(0); // startköpets courtage, ingen ombalansering
    expect(cost(2) - c0).toBeCloseTo(2 * (cost(1) - c0), 4);
  });

  test("AF-ombalansering med full omsättning realiserar allt: latent skatt 0, basis = value", () => {
    const a = assumptions({ startCapital: 1_000_000, horizonYears: 10 });
    const s: StrategyInput = {
      ...defaultStrategyInput("af full rebal"),
      accountType: "af",
      fundFeeRate: 0,
      rebalancesPerYear: 1,
      turnoverShare: 1,
    };
    const r = simulateStrategy(a, s);
    for (const row of r.rows.slice(1)) {
      expect(row.latentTax).toBeCloseTo(0, 4);
      expect(row.basis).toBeCloseTo(row.value, 4);
    }
    // Årlig realisering är dyrare än att skjuta upp skatten:
    const deferred = simulateStrategy(a, { ...s, rebalancesPerYear: 0, turnoverShare: 0 });
    expect(deferred.final.valueAfterRealization).toBeGreaterThan(
      r.final.valueAfterRealization,
    );
  });

  test("ISK-ombalansering kostar courtage/spread men utlöser ingen skatt", () => {
    const a = assumptions({ startCapital: 1_000_000, horizonYears: 1 });
    const s: StrategyInput = {
      ...defaultStrategyInput("isk rebal"),
      fundFeeRate: 0,
      priceGrowth: 0,
      rebalancesPerYear: 1,
      turnoverShare: 0.2,
      spreadRate: 0.001,
    };
    const r = simulateStrategy(a, s);
    expect(r.final.paidTransactionCosts).toBeGreaterThan(0);
    // Enda skatten är schablon.
    const noRebal = simulateStrategy(a, { ...s, rebalancesPerYear: 0, turnoverShare: 0 });
    expect(r.final.paidTax).toBeCloseTo(noRebal.final.paidTax, 6);
  });
});

describe("compareStrategies och insättningsöverstyrning", () => {
  test("kör N strategier med samma antaganden och bevarar ordning/namn", () => {
    const rs = compareStrategies(assumptions(), [
      frictionFree({ name: "a" }),
      frictionFree({ name: "b", fundFeeRate: 0.015 }),
    ]);
    expect(rs.map((r) => r.name)).toEqual(["a", "b"]);
    expect(rs[0]!.final.value).toBeGreaterThan(rs[1]!.final.value);
  });

  test("engångsköp slår månadssparande vid positiv avkastning (deterministisk DCA-jämförelse)", () => {
    const a = assumptions({ startCapital: 0, monthlySavings: 5_000, horizonYears: 10 });
    const [lump, dca] = compareStrategies(a, [
      frictionFree({
        name: "engång",
        startCapitalOverride: 5_000 * 12 * 10,
        monthlySavingsOverride: 0,
      }),
      frictionFree({ name: "dca" }),
    ]);
    expect(lump!.final.value).toBeGreaterThan(dca!.final.value);
  });
});

describe("savingsStartYear", () => {
  test("inga insättningar t.o.m. startåret; därefter identiskt med en kortare sparhorisont", () => {
    const a = assumptions({ startCapital: 0, monthlySavings: 1_000, horizonYears: 10 });
    const delayed = simulateStrategy(a, frictionFree({ savingsStartYear: 5 }));
    expect(delayed.rows[5]!.value).toBe(0);
    expect(delayed.rows[5]!.frictionlessValue).toBe(0);
    const early = simulateStrategy(
      assumptions({ startCapital: 0, monthlySavings: 1_000, horizonYears: 5 }),
      frictionFree(),
    );
    expect(delayed.final.value).toBeCloseTo(early.final.value, 6);
  });

  test("default (utan fältet) sparar från år 1", () => {
    const a = assumptions({ startCapital: 0, monthlySavings: 1_000, horizonYears: 1 });
    const r = simulateStrategy(a, frictionFree());
    expect(r.rows[1]!.value).toBeGreaterThan(0);
  });
});

describe("kontotyp \"none\" (skattefri)", () => {
  test("ingen skatt någonstans: value följer (1+g)^n och paidTax är 0", () => {
    const a = assumptions({ startCapital: 100_000, monthlySavings: 0, horizonYears: 10 });
    const r = simulateStrategy(a, {
      ...defaultStrategyInput("amortering"),
      accountType: "none",
      priceGrowth: 0.0245,
      fundFeeRate: 0,
    });
    expect(r.final.paidTax).toBe(0);
    expect(r.rows.at(-1)!.value).toBeCloseTo(100_000 * Math.pow(1.0245, 10), 4);
    for (const row of r.rows) {
      expect(row.latentTax).toBe(0);
      expect(row.valueAfterRealization).toBe(row.value);
    }
  });
});

describe("belåning", () => {
  test("utan skatt/avgifter: value = start × (1 + (1+L)·g − L·i)^n", () => {
    const a = assumptions({ startCapital: 100_000, monthlySavings: 0, horizonYears: 10 });
    const r = simulateStrategy(
      a,
      frictionFree({ leverageOfEquity: 0.2, loanRate: 0.04 }),
    );
    const expected = 100_000 * Math.pow(1 + 1.2 * 0.07 - 0.2 * 0.04, 10);
    expect(r.rows.at(-1)!.value).toBeCloseTo(expected, 4);
  });

  test("ISK: schablon beräknas på exponerat belopp och nettas mot ränteavdraget", () => {
    const a = assumptions({ startCapital: 1_000_000, monthlySavings: 0, horizonYears: 1 });
    const s: StrategyInput = {
      ...defaultStrategyInput("belånad isk"),
      fundFeeRate: 0,
      priceGrowth: 0,
      leverageOfEquity: 0.2,
      loanRate: 0.04,
    };
    const r = simulateStrategy(a, s);
    const loan = 200_000;
    const interest = 0.04 * loan;
    const p = defaultTaxParams2026;
    const grossSchablon =
      Math.max(0, 1_200_000 - p.iskFreeAmount) * (Math.max(p.slr + 0.01, 0.0125) * 0.3);
    const expectedTax = Math.max(0, grossSchablon - 0.3 * interest);
    expect(r.final.paidTax).toBeCloseTo(expectedTax, 2);
  });

  test("leverageOfEquity 0 ändrar ingenting", () => {
    const a = assumptions({ monthlySavings: 2_000 });
    const base = simulateStrategy(a, frictionFree());
    const zero = simulateStrategy(a, frictionFree({ leverageOfEquity: 0, loanRate: 0.04 }));
    expect(zero.final.value).toBe(base.final.value);
    expect(zero.final.paidTax).toBe(base.final.paidTax);
  });
});
