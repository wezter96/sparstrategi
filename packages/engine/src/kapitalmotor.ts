import type { TaxParams } from "./schema";
import { interestDeduction, iskTax, iskTaxRate, netTax } from "./tax";

/**
 * Faithful port of the "Belånad Kapitalmotor" document model
 * (`belanad-kapitalmotor-5mdr.html`). Distinct from `simulate.ts`'s
 * cashflow-driven engine in three ways:
 *
 * 1. Leverage is expressed as loan / eget kapital (equity), not loan / total
 *    portfolio (the standard LTV `simulate.ts` uses). `targetLtvOfEquity: 0.20`
 *    means "lån = 20% av eget kapital" — convert via `L_total = L/(1+L)` if you
 *    need the equivalent `targetLtv` for `simulate.ts`.
 * 2. ISK is sized so its schablonskatt exactly equals the ränteavdrag on the
 *    loan (tax-neutral calibration: isk = deduction / iskTaxRate + fribelopp),
 *    not sized to cover a cashflow need. The fribelopp is included because that
 *    capital is tax-free on ISK but would accrue latent capital-gains tax on AF.
 * 3. Any surplus (ISK return − interest − net tax) either gets withdrawn as
 *    consumption (`withdraw: true`) or reinvested into AF (`withdraw: false`)
 *    — both behaviors reproduce the document's two named scenarios exactly
 *    ("Tillväxt över tid" and "allt återinvesteras").
 */
export interface KapitalmotorInput {
  /** Grundförutsättning: eget kapital innan belåning. */
  equity: number;
  /** Belåningsgrad = lån / eget kapital (t.ex. 0.20 = 20%). */
  targetLtvOfEquity: number;
  expectedReturn: number;
  loanRate: number;
  taxParams: TaxParams;
  horizonYears: number;
  /** "split" = uppdelad AF+ISK (Alt 1). "allIsk" = hela portföljen i ISK (Alt 2). */
  mode: "split" | "allIsk";
  /** true = ta ut max hållbart uttag varje år. false = allt återinvesteras. */
  withdraw: boolean;
  /** Svensk kapitalvinstskatt på realiserad AF-vinst (normalt 0.30). */
  capitalGainsTaxRate: number;
  /** Löpande nytt sparande utöver grundkapitalet, tillförs AF-kontot varje år (default 0). */
  monthlySavings: number;
  /** Manuell ISK-andel (0–1) av totalen, i "split"-läge. Utelämnad ⇒ skatteneutral
   * autokalibrering (isk = ränteavdrag / ISK-skattesats), som i dokumentet. */
  manualIskShare?: number;
}

export interface KapitalmotorYear {
  year: number;
  portfolio: number;
  af: number;
  isk: number;
  loan: number;
  /** Belåningsgrad = lån / eget kapital, vid detta års slut (före årets återbelåning). */
  ltvOfEquity: number;
  equity: number;
  interest: number;
  iskTaxAmount: number;
  deduction: number;
  netTax: number;
  effectiveTaxRate: number;
  /** Detta årets uttag (0 om `withdraw` är false). */
  consumption: number;
  /** AF-kontots kostnadsbas (summan av allt icke-orealiserat kapital som satts in). */
  afBasis: number;
  /** Latent (orealiserad) reavinstskatt på AF: 30% × max(0, af − afBasis). */
  afLatentTax: number;
  /** Vad portföljen är värd om AF säljs idag, netto efter reavinstskatt. */
  realizedNetWorth: number;
  /** Skuldfritt nettovärde: portfölj − latent AF-skatt − lån. Pengar i handen
   * om allt likvideras och lånet löses — rättvis jämförelsemetrik mellan
   * alternativ som bär olika stora lån. */
  debtFreeNetWorth: number;
}

export interface KapitalmotorResult {
  rows: ReadonlyArray<KapitalmotorYear>;
}

const yearZero = (
  af: number,
  isk: number,
  loan: number,
  equity: number,
  basis: number,
  capitalGainsTaxRate: number,
): KapitalmotorYear => ({
  year: 0,
  portfolio: af + isk,
  af,
  isk,
  loan,
  ltvOfEquity: equity > 0 ? loan / equity : 0,
  equity: af + isk - loan,
  interest: 0,
  iskTaxAmount: 0,
  deduction: 0,
  netTax: 0,
  effectiveTaxRate: 0,
  consumption: 0,
  afBasis: basis,
  afLatentTax: Math.max(0, af - basis) * capitalGainsTaxRate,
  realizedNetWorth: af - Math.max(0, af - basis) * capitalGainsTaxRate + isk,
  debtFreeNetWorth:
    af - Math.max(0, af - basis) * capitalGainsTaxRate + isk - loan,
});

export function simulateKapitalmotor(input: KapitalmotorInput): KapitalmotorResult {
  const {
    equity,
    targetLtvOfEquity: L,
    expectedReturn: r,
    loanRate: i,
    taxParams,
    horizonYears,
    mode,
    withdraw,
    capitalGainsTaxRate,
    monthlySavings,
    manualIskShare,
  } = input;
  const savingsAdded = 12 * monthlySavings;
  const te = iskTaxRate(taxParams);

  const loan0 = equity * L;
  const total0 = equity + loan0;

  let af: number;
  let isk: number;
  if (mode === "allIsk") {
    af = 0;
    isk = total0;
  } else if (manualIskShare !== undefined) {
    isk = manualIskShare * total0;
    af = total0 - isk;
  } else {
    const interest0 = loan0 * i;
    const deduction0 = interestDeduction(interest0, taxParams);
    // Skatteneutralt maximum: schablonskatten på (isk − fribelopp) täcks exakt
    // av ränteavdraget. Fribeloppet är skattefritt på ISK men skulle dra latent
    // reavinstskatt på AF — därför alltid i ISK.
    isk = te > 0 ? Math.min(total0, deduction0 / te + taxParams.iskFreeAmount) : 0;
    af = total0 - isk;
  }
  let loan = loan0;
  let basis = af;

  const rows: KapitalmotorYear[] = [yearZero(af, isk, loan, equity, basis, capitalGainsTaxRate)];

  // Invariant: each pushed row reports the state at the END of that year,
  // BEFORE that year's own re-leverage (i.e. using the loan/ISK that were
  // actually in effect throughout the year — matching the document's
  // Kassaflödet/Skatteprincip cards). Re-leverage only prepares `af`/`isk`/
  // `loan`/`basis` for the NEXT iteration; it must never be reflected in the
  // row it's computed within.
  for (let year = 1; year <= horizonYears; year++) {
    const loanPrev = loan;
    const iskPrev = isk;
    const afPrev = af;
    const interest = loanPrev * i;

    if (mode === "allIsk") {
      const totalPrev = afPrev + iskPrev;
      const totalReturn = totalPrev * r;
      const iskTaxAmount = iskTax(totalPrev, taxParams);
      const deduction = interestDeduction(interest, taxParams);
      const { net } = netTax(iskTaxAmount, deduction);
      const surplus = totalReturn - interest - net;

      const consumption = withdraw ? surplus : 0;
      const totalThisYear = (withdraw ? totalPrev : totalPrev + surplus) + savingsAdded;
      const equityThisYear = totalThisYear - loanPrev;

      rows.push({
        year,
        portfolio: totalThisYear,
        af: 0,
        isk: totalThisYear,
        loan: loanPrev,
        ltvOfEquity: equityThisYear > 0 ? loanPrev / equityThisYear : 0,
        equity: equityThisYear,
        interest,
        iskTaxAmount,
        deduction,
        netTax: net,
        effectiveTaxRate: totalReturn > 0 ? net / totalReturn : 0,
        consumption,
        afBasis: 0,
        afLatentTax: 0,
        realizedNetWorth: totalThisYear,
        debtFreeNetWorth: totalThisYear - loanPrev,
      });

      // Prepare next year's carried-forward state (re-leverage happens here).
      const loanNew = equityThisYear * L;
      loan = loanNew;
      isk = equityThisYear + loanNew;
      af = 0;
      basis = 0;
      continue;
    }

    // mode === "split"
    const iskReturn = iskPrev * r;
    const iskTaxAmount = iskTax(iskPrev, taxParams);
    const deduction = interestDeduction(interest, taxParams);
    const { net } = netTax(iskTaxAmount, deduction);
    const surplus = iskReturn - interest - net;

    const afOrganic = afPrev * (1 + r);
    let consumption = 0;
    let afThisYear = afOrganic;
    let basisThisYear = basis;
    if (withdraw) {
      consumption = surplus;
    } else {
      afThisYear = afOrganic + surplus;
      basisThisYear = basis + surplus;
    }
    afThisYear += savingsAdded;
    basisThisYear += savingsAdded;

    const equityThisYear = afThisYear + iskPrev - loanPrev;
    const afLatentTax = Math.max(0, afThisYear - basisThisYear) * capitalGainsTaxRate;

    rows.push({
      year,
      portfolio: afThisYear + iskPrev,
      af: afThisYear,
      isk: iskPrev,
      loan: loanPrev,
      ltvOfEquity: equityThisYear > 0 ? loanPrev / equityThisYear : 0,
      equity: equityThisYear,
      interest,
      iskTaxAmount,
      deduction,
      netTax: net,
      effectiveTaxRate: iskReturn > 0 ? net / iskReturn : 0,
      consumption,
      afBasis: basisThisYear,
      afLatentTax,
      realizedNetWorth: afThisYear - afLatentTax + iskPrev,
      debtFreeNetWorth: afThisYear - afLatentTax + iskPrev - loanPrev,
    });

    // Prepare next year's carried-forward state (re-leverage happens here).
    const loanNew = equityThisYear * L;
    const addLoan = loanNew - loanPrev;
    const totalAfterLever = equityThisYear + loanNew;

    const interestNext = loanNew * i;
    const deductionNext = interestDeduction(interestNext, taxParams);
    const iskNew =
      manualIskShare !== undefined
        ? manualIskShare * totalAfterLever
        : te > 0
          ? Math.min(totalAfterLever, deductionNext / te + taxParams.iskFreeAmount)
          : 0;
    const iskTopUp = iskNew - iskPrev;
    const netAddLoanToAF = addLoan - iskTopUp;
    const afNew = totalAfterLever - iskNew;

    af = afNew;
    isk = iskNew;
    loan = loanNew;
    basis = basisThisYear + netAddLoanToAF;
  }

  return { rows };
}

export const defaultKapitalmotorInput = (taxParams: TaxParams): KapitalmotorInput => ({
  equity: 5_000_000,
  targetLtvOfEquity: 0.2,
  expectedReturn: 0.08,
  loanRate: 0.04,
  taxParams,
  horizonYears: 10,
  mode: "split",
  withdraw: true,
  capitalGainsTaxRate: 0.3,
  monthlySavings: 0,
});
