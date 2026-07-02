import type { ScenarioInput } from "./schema";
import { interestDeduction, iskTax, netTax } from "./tax";

export interface YearRow {
  year: number;
  portfolio: number;
  af: number;
  isk: number;
  loan: number;
  ltv: number;
  equity: number;
  growth: number;
  interest: number;
  withdrawal: number;
  iskTax: number;
  deduction: number;
  netTax: number;
  excessReduction: number;
  effectiveTaxRate: number;
  newLoan: number;
  savingsAdded: number;
  warnings: ReadonlyArray<string>;
}

export interface Calibration {
  initialPortfolio: number;
  initialLoan: number;
  requiredIsk: number;
  initialAf: number;
  feasible: boolean;
}

export interface SimulationResult {
  calibration: Calibration;
  rows: ReadonlyArray<YearRow>;
  warnings: ReadonlyArray<string>;
}

export interface SimState {
  af: number;
  isk: number;
  loan: number;
}

export interface SimHooks {
  onYearStart?: (year: number, state: SimState) => SimState;
  allowReleverage?: (state: SimState) => boolean;
}

/** ISK capital needed so its return covers loan interest + living costs. */
export const requiredIskCapital = (loan: number, input: ScenarioInput): number => {
  const yearlyNeed = input.loanRate * loan + 12 * input.monthlyLivingCosts;
  if (yearlyNeed <= 0) return 0;
  if (input.expectedReturn <= 0) return Number.POSITIVE_INFINITY;
  return yearlyNeed / input.expectedReturn;
};

export function simulate(input: ScenarioInput): SimulationResult {
  return simulateWithHooks(input, {});
}

export function simulateWithHooks(input: ScenarioInput, hooks: SimHooks): SimulationResult {
  const r = input.expectedReturn;
  const initialPortfolio =
    input.targetLtv > 0 ? input.startCapital / (1 - input.targetLtv) : input.startCapital;
  const initialLoan = initialPortfolio - input.startCapital;
  const requiredIsk = requiredIskCapital(initialLoan, input);
  const feasible = requiredIsk <= initialPortfolio;

  // When there's no funding need (no loan interest / no living costs to cover)
  // AND the portfolio is unleveraged (no initial loan), default all capital to ISK —
  // it's the tax-favored account; AF only exists to size the leveraged portion when
  // the portfolio actually needs it. Leveraged scenarios always use the generic formula
  // (isk = min(requiredIsk, portfolio)) to avoid dumping leveraged AF into taxable ISK.
  let isk: number;
  let af: number;
  if (requiredIsk <= 0 && initialLoan <= 0) {
    isk = initialPortfolio;
    af = 0;
  } else {
    isk = Math.min(requiredIsk, initialPortfolio);
    af = initialPortfolio - isk;
  }
  let loan = initialLoan;
  const initialAf = af;

  const globalWarnings: string[] = [];
  if (!feasible) {
    globalWarnings.push(
      "Ej genomförbart: avkastningen kan inte täcka ränta och levnadskostnader",
    );
  }

  const rows: YearRow[] = [
    {
      year: 0,
      portfolio: af + isk,
      af,
      isk,
      loan,
      ltv: af + isk > 0 ? loan / (af + isk) : 0,
      equity: af + isk - loan,
      growth: 0,
      interest: 0,
      withdrawal: 0,
      iskTax: 0,
      deduction: 0,
      netTax: 0,
      excessReduction: 0,
      effectiveTaxRate: 0,
      newLoan: 0,
      savingsAdded: 0,
      warnings: [],
    },
  ];

  for (let year = 1; year <= input.horizonYears; year++) {
    if (hooks.onYearStart) {
      const next = hooks.onYearStart(year, { af, isk, loan });
      af = next.af;
      isk = next.isk;
      loan = next.loan;
    }

    const warnings: string[] = [];
    const iskAtStart = isk;

    // 1. Growth and cash needs
    const afGain = af * r;
    const iskGain = isk * r;
    const interest = loan * input.loanRate;
    const need = interest + 12 * input.monthlyLivingCosts;

    // 2. Withdraw from ISK; erosion falls through to AF
    let iskAfter = isk + iskGain - need;
    let afAfter = af + afGain;
    if (iskAfter < 0) {
      afAfter += iskAfter; // take shortfall from AF
      iskAfter = 0;
      warnings.push("ISK-uttag täcks av AF (principal erosion)");
    }

    // 3. Taxes (on year-start ISK capital), paid from AF
    const iskTaxAmount = iskTax(iskAtStart, input.taxParams);
    const deduction = interestDeduction(interest, input.taxParams);
    const { net, excessReduction } = netTax(iskTaxAmount, deduction);
    afAfter -= net;

    // 4. Savings
    const savingsAdded = 12 * input.monthlySavings;
    afAfter += savingsAdded;

    let exhausted = false;
    if (afAfter < 0) {
      afAfter = 0;
      exhausted = true;
      warnings.push("Portföljen är uttömd");
    }

    // 5. Re-leverage to target LTV; proceeds recalibrate ISK first, rest to AF
    const equityNow = afAfter + iskAfter - loan;
    const releverageAllowed =
      hooks.allowReleverage?.({ af: afAfter, isk: iskAfter, loan }) ?? true;
    let newLoan = 0;
    if (input.targetLtv > 0 && equityNow > 0 && !exhausted && releverageAllowed) {
      const loanTarget = (input.targetLtv * equityNow) / (1 - input.targetLtv);
      newLoan = Math.max(0, loanTarget - loan);
      if (newLoan > 0) {
        const iskTarget = requiredIskCapital(loan + newLoan, input);
        const topUp = Math.max(0, iskTarget - iskAfter);
        if (topUp > newLoan) {
          iskAfter += newLoan;
          warnings.push("ISK underkalibrerat");
        } else {
          iskAfter += topUp;
          afAfter += newLoan - topUp;
        }
        loan += newLoan;
      }
    }

    af = afAfter;
    isk = iskAfter;
    const portfolio = af + isk;
    const growth = afGain + iskGain;

    rows.push({
      year,
      portfolio,
      af,
      isk,
      loan,
      ltv: portfolio > 0 ? loan / portfolio : 0,
      equity: portfolio - loan,
      growth,
      interest,
      withdrawal: Math.min(need, iskAtStart + iskGain),
      iskTax: iskTaxAmount,
      deduction,
      netTax: net,
      excessReduction,
      effectiveTaxRate: growth > 0 ? net / growth : 0,
      newLoan,
      savingsAdded,
      warnings,
    });

    if (exhausted) break;
  }

  return {
    calibration: {
      initialPortfolio,
      initialLoan,
      requiredIsk,
      initialAf,
      feasible,
    },
    rows,
    warnings: globalWarnings,
  };
}
