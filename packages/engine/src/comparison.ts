import type { TaxParams } from "./schema";
import { iskTax, iskTaxRate } from "./tax";

/**
 * Generell jämförelsemotor: N strategier med identiska insättningar simuleras
 * år för år. Varje "mall" i web-simple är bara förifyllda StrategyInput.
 *
 * Ordning per år (låst — testerna beror på den):
 *   1. Insättningar (12 månadsköp) minus courtage/valutaväxling → netDeposits.
 *   2. Kurstillväxt och utdelning på (capStart + netDeposits/2) — halvårs-
 *      approximation för insättningar; fondavgift på samma underlag.
 *   3. Schablonskatt (ISK med fribelopp / KF utan) på capStart.
 *   4. Utdelningsskatt + källskatt per kontotyp; återinvestera eller betala ut.
 *   5. Ombalansering: kostnader på omsatt volym; på AF realiseras vinst.
 */
export type ComparisonAccountType = "isk" | "af" | "kf";

export interface ComparisonAssumptions {
  startCapital: number;
  monthlySavings: number;
  horizonYears: number;
  taxParams: TaxParams;
}

export interface StrategyInput {
  name: string;
  /** Kursutveckling per år. Totalavkastning = priceGrowth + dividendYield. */
  priceGrowth: number;
  dividendYield: number;
  /** Årlig fondavgift, dras ur avkastningen. */
  fundFeeRate: number;
  accountType: ComparisonAccountType;
  reinvestDividends: boolean;
  /** Utländsk källskatt på utdelning. KF återfår allt, ISK upp till årets
   * schablonskatt (förenklad avräkning), AF avräknar mot utdelningsskatten. */
  foreignWithholdingRate: number;
  /** Antal innehav varje insättning delas över (per köp betalas courtage). */
  holdingsCount: number;
  /** Fast/minimicourtage per affär (kr): per affär betalas max(flat, rate × belopp). */
  courtageFlat: number;
  courtageRate: number;
  /** Valutaväxlingsavgift på handlad volym (0 för svenska värdepapper). */
  fxFeeRate: number;
  rebalancesPerYear: number;
  /** Andel av portföljen som säljs + återköps per ombalansering. */
  turnoverShare: number;
  /** Spreadkostnad per rundresa på omsatt volym. */
  spreadRate: number;
  /** Endast DCA-mallen: åsidosätter gemensamma insättningsantaganden. */
  startCapitalOverride?: number;
  monthlySavingsOverride?: number;
}

export interface StrategyYear {
  year: number;
  /** Kapital i kontot vid årets slut. */
  value: number;
  /** AF-kostnadsbas (för ISK/KF: lika med value — ingen latent skatt). */
  basis: number;
  latentTax: number;
  valueAfterRealization: number;
  /** Ackumulerade belopp t.o.m. detta år: */
  dividendsReceived: number;
  paidFees: number;
  paidTax: number;
  paidTransactionCosts: number;
  /** Samma insättningar och bruttoavkastning utan avgifter/skatt/kostnader. */
  frictionlessValue: number;
}

export interface StrategyFinal {
  value: number;
  valueAfterRealization: number;
  dividendsReceived: number;
  paidFees: number;
  paidTax: number;
  paidTransactionCosts: number;
  /** frictionlessValue − (valueAfterRealization + dividendsReceived).
   * Approximation: utbetalda utdelningar räknas oförräntade. */
  lostToFriction: number;
}

export interface StrategyResult {
  name: string;
  rows: ReadonlyArray<StrategyYear>;
  final: StrategyFinal;
}

export const defaultStrategyInput = (name: string): StrategyInput => ({
  name,
  priceGrowth: 0.07,
  dividendYield: 0,
  fundFeeRate: 0.002,
  accountType: "isk",
  reinvestDividends: true,
  foreignWithholdingRate: 0,
  holdingsCount: 1,
  courtageFlat: 0,
  courtageRate: 0,
  fxFeeRate: 0,
  rebalancesPerYear: 0,
  turnoverShare: 0,
  spreadRate: 0,
});

export function simulateStrategy(
  a: ComparisonAssumptions,
  s: StrategyInput,
): StrategyResult {
  const start = s.startCapitalOverride ?? a.startCapital;
  const monthly = s.monthlySavingsOverride ?? a.monthlySavings;
  const p = a.taxParams;
  const gainsRate = p.afCapitalGainsRate;
  const totalReturn = s.priceGrowth + s.dividendYield;

  /** Kostnad för ett köp om `amount` kr fördelat över alla innehav. */
  const tradeCost = (amount: number): number => {
    if (amount <= 0) return 0;
    const holdings = Math.max(1, s.holdingsCount);
    const perHolding = amount / holdings;
    const courtage =
      holdings * Math.max(s.courtageFlat, s.courtageRate * perHolding);
    return courtage + s.fxFeeRate * amount;
  };

  const startCost = tradeCost(start);
  let value = start - startCost;
  let basis = value;
  let paidTransactionCosts = startCost;
  let paidFees = 0;
  let paidTax = 0;
  let dividendsReceived = 0;
  let frictionless = start;

  const mkRow = (year: number): StrategyYear => {
    const latentTax =
      s.accountType === "af" ? gainsRate * Math.max(0, value - basis) : 0;
    return {
      year,
      value,
      basis: s.accountType === "af" ? basis : value,
      latentTax,
      valueAfterRealization: value - latentTax,
      dividendsReceived,
      paidFees,
      paidTax,
      paidTransactionCosts,
      frictionlessValue: frictionless,
    };
  };

  const rows: StrategyYear[] = [mkRow(0)];

  for (let year = 1; year <= a.horizonYears; year++) {
    // 1. Insättningar
    const deposits = 12 * monthly;
    const depositCost = 12 * tradeCost(monthly);
    const netDeposits = deposits - depositCost;
    paidTransactionCosts += depositCost;

    // 2. Avkastning och avgift
    const capStart = value;
    const mid = capStart + netDeposits / 2;
    const fee = s.fundFeeRate * mid;
    const appreciation = s.priceGrowth * mid;
    const dividends = s.dividendYield * mid;
    paidFees += fee;

    let newValue = capStart + netDeposits + appreciation - fee;
    basis += netDeposits;

    // 3. Schablonskatt på årets ingående kapital.
    const schablon =
      s.accountType === "isk"
        ? iskTax(capStart, p)
        : s.accountType === "kf"
          ? Math.max(0, capStart) * iskTaxRate(p)
          : 0;
    newValue -= schablon;
    paidTax += schablon;

    // 4. Utdelning: källskatt + kontoskatt.
    const withheld = s.foreignWithholdingRate * dividends;
    const divTax =
      s.accountType === "af"
        ? Math.max(withheld, gainsRate * dividends)
        : s.accountType === "kf"
          ? 0
          : Math.max(0, withheld - schablon);
    paidTax += divTax;
    const netDividends = dividends - divTax;
    if (s.reinvestDividends) {
      newValue += netDividends;
      basis += netDividends;
    } else {
      dividendsReceived += netDividends;
    }

    // 5. Ombalansering (Task 3) infogas här.

    value = Math.max(0, newValue);
    frictionless =
      frictionless * (1 + totalReturn) + deposits * (1 + totalReturn / 2);
    rows.push(mkRow(year));
  }

  const last = rows.at(-1)!;
  return {
    name: s.name,
    rows,
    final: {
      value: last.value,
      valueAfterRealization: last.valueAfterRealization,
      dividendsReceived: last.dividendsReceived,
      paidFees: last.paidFees,
      paidTax: last.paidTax,
      paidTransactionCosts: last.paidTransactionCosts,
      lostToFriction:
        last.frictionlessValue -
        (last.valueAfterRealization + last.dividendsReceived),
    },
  };
}
