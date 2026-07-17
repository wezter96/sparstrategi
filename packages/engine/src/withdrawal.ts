import type { TaxParams } from "./schema";
import { iskTax } from "./tax";

/**
 * Uttagsfas: hur länge räcker kapitalet vid ett löpande nettouttag?
 *
 * Modell per år (deterministisk, samma stil som jämförelsemotorn):
 *   1. Årets nettouttag = 12 × månadsuttag × (1 + inflation)^(år − 1) —
 *      uttaget är konstant i dagens penningvärde.
 *   2. AF: för att få ut nettot säljs brutto S = netto / (1 − reavinstskatt × g)
 *      där g = vinstandelen enligt genomsnittsmetoden (1 − anskaffningsvärde /
 *      kapital). ISK/skattefritt: brutto = netto.
 *   3. Avkastning på (ingående kapital − brutto/2) — halvårsapproximation för
 *      uttag spridda över året.
 *   4. ISK: schablonskatt på ingående kapital dras ur kapitalet.
 *   5. Räcker inte kapitalet säljs allt: årets uttag blir det som finns kvar
 *      netto, kapitalet 0 och `depletedYear` sätts.
 */
export interface WithdrawalInput {
  startCapital: number;
  /** Önskat nettouttag i dagens penningvärde, kr/mån. */
  monthlyWithdrawal: number;
  expectedReturn: number;
  /** Uttagen räknas upp med inflationen; reala värden deflateras med samma. */
  inflation: number;
  accountType: "isk" | "af" | "none";
  /** AF: anskaffningsvärde / kapital vid start (1 = ingen orealiserad vinst). */
  afBasisShare: number;
  taxParams: TaxParams;
  horizonYears: number;
}

export interface WithdrawalYear {
  year: number;
  /** Kapital vid årets slut, nominellt. */
  capital: number;
  /** Kapital vid årets slut i dagens penningvärde. */
  capitalReal: number;
  /** Kapital netto efter latent reavinstskatt (AF; för ISK/skattefritt = capital).
   * Jämför alltid detta mellan kontotyper — AF:s bruttokapital bär latent skatt. */
  capitalNet: number;
  /** Årets nettouttag (nominellt). */
  withdrawn: number;
  /** Årets skatt (schablon och/eller reavinst). */
  paidTax: number;
}

export interface WithdrawalResult {
  rows: ReadonlyArray<WithdrawalYear>;
  /** Första året uttaget tömde kapitalet; null = räcker hela horisonten. */
  depletedYear: number | null;
  totalWithdrawn: number;
  totalTax: number;
}

export function simulateWithdrawal(input: WithdrawalInput): WithdrawalResult {
  const { expectedReturn: r, inflation, taxParams: p, horizonYears } = input;
  const cg = p.afCapitalGainsRate;

  let capital = input.startCapital;
  let basis =
    input.accountType === "af"
      ? Math.min(1, Math.max(0, input.afBasisShare)) * capital
      : 0;
  let depletedYear: number | null = null;
  let totalWithdrawn = 0;
  let totalTax = 0;

  const latentNet = (cap: number, b: number): number =>
    input.accountType === "af" ? cap - cg * Math.max(0, cap - b) : cap;

  const rows: WithdrawalYear[] = [
    {
      year: 0,
      capital,
      capitalReal: capital,
      capitalNet: latentNet(capital, basis),
      withdrawn: 0,
      paidTax: 0,
    },
  ];

  for (let year = 1; year <= horizonYears; year++) {
    const deflator = (1 + inflation) ** year;
    if (depletedYear !== null || capital <= 0) {
      rows.push({ year, capital: 0, capitalReal: 0, capitalNet: 0, withdrawn: 0, paidTax: 0 });
      continue;
    }

    const targetNet = 12 * input.monthlyWithdrawal * (1 + inflation) ** (year - 1);
    const gainShare =
      input.accountType === "af" && capital > 0
        ? Math.max(0, 1 - basis / capital)
        : 0;
    const grossFactor = 1 - cg * gainShare;
    const gross = grossFactor > 0 ? targetNet / grossFactor : capital;
    const schablon = input.accountType === "isk" ? iskTax(capital, p) : 0;

    const growth = r * (capital - Math.min(gross, capital) / 2);
    const capitalEnd = capital + growth - gross - schablon;

    if (capitalEnd > 0) {
      const afTax = gross - targetNet;
      if (input.accountType === "af") {
        basis = Math.max(0, basis - (capital > 0 ? basis / capital : 0) * gross);
      }
      capital = capitalEnd;
      totalWithdrawn += targetNet;
      totalTax += schablon + afTax;
      rows.push({
        year,
        capital,
        capitalReal: capital / deflator,
        capitalNet: latentNet(capital, basis),
        withdrawn: targetNet,
        paidTax: schablon + afTax,
      });
      continue;
    }

    // Kapitalet räcker inte: sälj allt, betala skatten, ta ut resten.
    const grossAll = Math.max(0, capital + r * (capital / 2) - schablon);
    const afTaxAll = cg * gainShare * grossAll;
    const net = Math.max(0, grossAll - afTaxAll);
    depletedYear = year;
    capital = 0;
    basis = 0;
    totalWithdrawn += net;
    totalTax += schablon + afTaxAll;
    rows.push({
      year,
      capital: 0,
      capitalReal: 0,
      capitalNet: 0,
      withdrawn: net,
      paidTax: schablon + afTaxAll,
    });
  }

  return { rows, depletedYear, totalWithdrawn, totalTax };
}

export const defaultWithdrawalInput = (taxParams: TaxParams): WithdrawalInput => ({
  startCapital: 3_000_000,
  monthlyWithdrawal: 10_000,
  expectedReturn: 0.05,
  inflation: 0.02,
  accountType: "isk",
  afBasisShare: 0.5,
  taxParams,
  horizonYears: 40,
});
