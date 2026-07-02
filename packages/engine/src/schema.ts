import { Schema } from "effect";

export const TaxParams = Schema.Struct({
  /** Statslåneränta (decimal, e.g. 0.025). ISK rate = max(slr + 1pp, 1.25%) × 30%. */
  slr: Schema.Number,
  /** Tax-free capital floor for ISK (300 000 kr from 2026). */
  iskFreeAmount: Schema.Number,
  /** Secured loans (portfolio credit) qualify for ränteavdrag. */
  deductionEligible: Schema.Boolean,
  /** 30% on interest up to the breakpoint. */
  deductionRateLow: Schema.Number,
  /** 21% above the breakpoint. */
  deductionRateHigh: Schema.Number,
  /** 100 000 kr/year. */
  deductionBreakpoint: Schema.Number,
  /** 30% on realized AF gains (reported as latent tax; AF is never sold in the core loop). */
  afCapitalGainsRate: Schema.Number,
});
export type TaxParams = typeof TaxParams.Type;

export const defaultTaxParams2026: TaxParams = {
  slr: 0.025,
  iskFreeAmount: 300_000,
  deductionEligible: true,
  deductionRateLow: 0.3,
  deductionRateHigh: 0.21,
  deductionBreakpoint: 100_000,
  afCapitalGainsRate: 0.3,
};

/** Flat model used by the source document: no free floor, flat 21% deduction. */
export const documentTaxParams: TaxParams = {
  slr: 0.025,
  iskFreeAmount: 0,
  deductionEligible: true,
  deductionRateLow: 0.21,
  deductionRateHigh: 0.21,
  deductionBreakpoint: 0,
  afCapitalGainsRate: 0.3,
};

export const WealthGoal = Schema.Struct({
  type: Schema.Literal("wealth"),
  amount: Schema.Number,
  year: Schema.Number,
});
export type WealthGoal = typeof WealthGoal.Type;

export const PassiveIncomeGoal = Schema.Struct({
  type: Schema.Literal("passiveIncome"),
  monthlyAmount: Schema.Number,
});
export type PassiveIncomeGoal = typeof PassiveIncomeGoal.Type;

export const Goal = Schema.Union([WealthGoal, PassiveIncomeGoal]);
export type Goal = typeof Goal.Type;

export const ScenarioInput = Schema.Struct({
  startCapital: Schema.Number,
  monthlySavings: Schema.Number,
  /** Target loan-to-value = loan / total portfolio (incl. loan). 0–0.6. */
  targetLtv: Schema.Number,
  /** Margin-call threshold (broker max LTV). */
  maxLtv: Schema.Number,
  loanRate: Schema.Number,
  expectedReturn: Schema.Number,
  monthlyLivingCosts: Schema.Number,
  horizonYears: Schema.Number,
  taxParams: TaxParams,
  goals: Schema.Array(Goal),
  /** Manual ISK share (fraction 0–1 of total portfolio). Absent → auto-calibrated (default). */
  manualIskShare: Schema.optional(Schema.Number),
});
export type ScenarioInput = typeof ScenarioInput.Type;

export const defaultScenarioInput: ScenarioInput = {
  startCapital: 1_000_000,
  monthlySavings: 10_000,
  targetLtv: 0.2,
  maxLtv: 0.5,
  loanRate: 0.03,
  expectedReturn: 0.07,
  monthlyLivingCosts: 0,
  horizonYears: 20,
  taxParams: defaultTaxParams2026,
  goals: [],
};
