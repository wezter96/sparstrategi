/**
 * Simplified Swedish holding-company (fåmansaktiebolag / 3:12) model, for
 * comparison against the private AF/ISK model in `kapitalmotor.ts`.
 *
 * SIMPLIFICATIONS (clearly flagged in the UI — this is not tax advice):
 * - Only "förenklingsregeln" (schablonbeloppet) is modeled, not
 *   "huvudregeln" (lönebaserat utrymme), which can give a much larger
 *   gränsbelopp if the company pays substantial salaries.
 * - Dividends above gränsbelopp are taxed at a single flat approximate rate
 *   (`dividendTaxRateAboveLimit`), not the real progressive tjänst-brackets
 *   with the 90.75 IBB cap.
 * - The company is assumed to hold its portfolio split between a
 *   kapitalförsäkring-like wrapper (schablonbeskattad, same SLR+1pp formula
 *   as personal ISK but taxed at the corporate rate) and a plain securities
 *   account (gains deferred until realized, like AF) — this mirrors real
 *   practice but the exact split mechanics are a simplification.
 * - Corporate interest-deduction-limitation rules (ränteavdragsbegränsning,
 *   EBITDA-regeln) are not modeled; interest is assumed fully deductible.
 */
export interface HoldingTaxParams {
  /** Statslåneränta, same input as personal TaxParams.slr. */
  slr: number;
  /** Bolagsskatt, 20.6% from 2021. */
  corporateTaxRate: number;
  /** Gränsbelopp/år enligt förenklingsregeln (2.75 × IBB). Uppdatera årligen. */
  gransbelopp: number;
  /** Uppräkningsränta för sparat utdelningsutrymme (SLR + 3 pp, ungefärligt). */
  allowanceUprate: number;
  /** Skatt på utdelning inom gränsbeloppet (kvalificerade andelar). */
  dividendTaxRateWithinLimit: number;
  /** Förenklad platt skattesats på utdelning/lön över gränsbeloppet. */
  dividendTaxRateAboveLimit: number;
  deductionRateLow: number;
  deductionRateHigh: number;
  deductionBreakpoint: number;
}

export const defaultHoldingTaxParams2026: HoldingTaxParams = {
  slr: 0.025,
  corporateTaxRate: 0.206,
  gransbelopp: 209_550,
  allowanceUprate: 0.055,
  dividendTaxRateWithinLimit: 0.2,
  dividendTaxRateAboveLimit: 0.53,
  deductionRateLow: 0.3,
  deductionRateHigh: 0.21,
  deductionBreakpoint: 100_000,
};

export interface HoldingInput {
  equity: number;
  targetLtvOfEquity: number;
  expectedReturn: number;
  loanRate: number;
  taxParams: HoldingTaxParams;
  horizonYears: number;
  /** true = ta ut gränsbeloppet som utdelning varje år. false = allt stannar i bolaget. */
  extractDividends: boolean;
  capitalGainsRatePrivate: number;
  /** Löpande nytt sparande, tillförs bolagets depå-del varje år (default 0). */
  monthlySavings: number;
}

export interface HoldingYear {
  year: number;
  companyPortfolio: number;
  companyVp: number;
  companyVpBasis: number;
  companyKf: number;
  loan: number;
  ltvOfEquity: number;
  companyEquity: number;
  interest: number;
  savedAllowance: number;
  dividendGross: number;
  dividendWithinLimit: number;
  dividendAboveLimit: number;
  dividendTax: number;
  personalWealthNet: number;
  companyLatentTax: number;
  totalNetWorth: number;
}

const corporateInterestDeduction = (interest: number, p: HoldingTaxParams): number => {
  if (interest <= 0) return 0;
  return (
    p.deductionRateLow * Math.min(interest, p.deductionBreakpoint) +
    p.deductionRateHigh * Math.max(0, interest - p.deductionBreakpoint)
  );
};

export function simulateHolding(input: HoldingInput): ReadonlyArray<HoldingYear> {
  const { equity, targetLtvOfEquity: L, expectedReturn: r, loanRate: i, taxParams: p, horizonYears } =
    input;
  const savingsAdded = 12 * input.monthlySavings;

  /** Schablonintäkt (SLR + 1pp, floor 1,25%) taxed at the corporate rate instead of 30%. */
  const kfTaxRate = Math.max(p.slr + 0.01, 0.0125) * p.corporateTaxRate;

  const loan0 = equity * L;
  const total0 = equity + loan0;
  const interest0 = loan0 * i;
  const deduction0 = corporateInterestDeduction(interest0, p);
  let kf = kfTaxRate > 0 ? deduction0 / kfTaxRate : 0;
  let vp = total0 - kf;
  let vpBasis = vp;
  let loan = loan0;
  let savedAllowance = p.gransbelopp;
  let personalWealthNet = 0;

  const rows: HoldingYear[] = [
    {
      year: 0,
      companyPortfolio: vp + kf,
      companyVp: vp,
      companyVpBasis: vpBasis,
      companyKf: kf,
      loan,
      ltvOfEquity: equity > 0 ? loan / equity : 0,
      companyEquity: vp + kf - loan,
      interest: 0,
      savedAllowance,
      dividendGross: 0,
      dividendWithinLimit: 0,
      dividendAboveLimit: 0,
      dividendTax: 0,
      personalWealthNet,
      companyLatentTax: Math.max(0, vp - vpBasis) * p.corporateTaxRate,
      totalNetWorth: personalWealthNet + vp + kf - loan,
    },
  ];

  for (let year = 1; year <= horizonYears; year++) {
    const loanPrev = loan;
    const kfPrev = kf;
    const vpPrev = vp;
    const interest = loanPrev * i;

    const kfReturn = kfPrev * r;
    const kfTaxAmount = kfPrev * kfTaxRate;
    const deduction = corporateInterestDeduction(interest, p);
    const netCorpTax = Math.max(0, kfTaxAmount - deduction);
    const surplus = kfReturn - interest - netCorpTax;

    const vpOrganic = vpPrev * (1 + r);

    savedAllowance = savedAllowance * (1 + p.allowanceUprate) + p.gransbelopp;

    let dividendGross = 0;
    let dividendWithinLimit = 0;
    let dividendAboveLimit = 0;
    let dividendTax = 0;
    let vpAfterSurplus = vpOrganic + surplus + savingsAdded;
    let extractedNet = 0;

    if (input.extractDividends) {
      dividendGross = Math.min(savedAllowance, Math.max(0, vpAfterSurplus));
      dividendWithinLimit = Math.min(dividendGross, savedAllowance);
      dividendAboveLimit = Math.max(0, dividendGross - dividendWithinLimit);
      dividendTax =
        dividendWithinLimit * p.dividendTaxRateWithinLimit +
        dividendAboveLimit * p.dividendTaxRateAboveLimit;
      extractedNet = dividendGross - dividendTax;
      vpAfterSurplus -= dividendGross;
      savedAllowance -= dividendWithinLimit;
      vpBasis = Math.max(0, vpBasis - dividendGross);
    }
    personalWealthNet += extractedNet;

    const totalPreLever = vpAfterSurplus + kfPrev;
    const equityNow = totalPreLever - loanPrev;
    const loanNew = equityNow * L;
    const addLoan = loanNew - loanPrev;
    const totalAfterLever = equityNow + loanNew;

    const interestNext = loanNew * i;
    const deductionNext = corporateInterestDeduction(interestNext, p);
    const kfNew = kfTaxRate > 0 ? deductionNext / kfTaxRate : 0;
    const kfTopUp = kfNew - kfPrev;
    const netAddLoanToVp = addLoan - kfTopUp;
    const vpNew = totalAfterLever - kfNew;

    vpBasis += netAddLoanToVp + savingsAdded;
    vp = vpNew;
    kf = kfNew;
    loan = loanNew;

    const companyLatentTax = Math.max(0, vp - vpBasis) * p.corporateTaxRate;

    rows.push({
      year,
      companyPortfolio: vp + kf,
      companyVp: vp,
      companyVpBasis: vpBasis,
      companyKf: kf,
      loan,
      ltvOfEquity: equityNow > 0 ? loanNew / equityNow : 0,
      companyEquity: equityNow,
      interest,
      savedAllowance,
      dividendGross,
      dividendWithinLimit,
      dividendAboveLimit,
      dividendTax,
      personalWealthNet,
      companyLatentTax,
      totalNetWorth: personalWealthNet + vp - companyLatentTax + kf,
    });
  }

  return rows;
}
