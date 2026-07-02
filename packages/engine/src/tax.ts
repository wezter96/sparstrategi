import type { TaxParams } from "./schema";

/** Effective yearly tax rate on ISK capital: max(SLR + 1pp, 1.25%) × 30%. */
export const iskTaxRate = (p: TaxParams): number =>
  Math.max(p.slr + 0.01, 0.0125) * 0.3;

/** Schablonskatt on capital above the tax-free floor. Simplification: uses
 * year-start capital as kapitalunderlag (real rule averages quarters + deposits). */
export const iskTax = (capital: number, p: TaxParams): number =>
  Math.max(0, capital - p.iskFreeAmount) * iskTaxRate(p);

/** Ränteavdrag (skattereduktion): 30% up to the breakpoint, 21% above.
 * Requires a secured loan (deductionEligible). */
export const interestDeduction = (interest: number, p: TaxParams): number => {
  if (!p.deductionEligible || interest <= 0) return 0;
  return (
    p.deductionRateLow * Math.min(interest, p.deductionBreakpoint) +
    p.deductionRateHigh * Math.max(0, interest - p.deductionBreakpoint)
  );
};

/** Deduction is a skattereduktion: nets against the ISK tax; the surplus is
 * usable against other income tax (överskjutande skattereduktion). */
export const netTax = (
  iskTaxAmount: number,
  deduction: number,
): { net: number; excessReduction: number } => ({
  net: Math.max(0, iskTaxAmount - deduction),
  excessReduction: Math.max(0, deduction - iskTaxAmount),
});
