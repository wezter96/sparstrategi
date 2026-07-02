import type { PassiveIncomeGoal, ScenarioInput, WealthGoal } from "./schema";
import { simulate, type SimulationResult } from "./simulate";

export interface WealthGoalResult {
  type: "wealth";
  goal: WealthGoal;
  achieved: boolean;
  hitYear: number | null;
  equityAtTargetYear: number;
  shortfall: number;
  requiredMonthlySavings: number | null;
}

export interface PassiveIncomeGoalResult {
  type: "passiveIncome";
  goal: PassiveIncomeGoal;
  requiredIskCapital: number;
  feasible: boolean;
  feasibleYear: number | null;
}

export type GoalResult = WealthGoalResult | PassiveIncomeGoalResult;

const MAX_MONTHLY_SAVINGS = 1_000_000;

const equityAtYear = (result: SimulationResult, year: number): number => {
  const row = result.rows.find((r) => r.year === year) ?? result.rows.at(-1);
  return row?.equity ?? 0;
};

const solveRequiredSavings = (
  input: ScenarioInput,
  goal: WealthGoal,
): number | null => {
  const hits = (monthly: number) =>
    equityAtYear(simulate({ ...input, monthlySavings: monthly }), goal.year) >=
    goal.amount;
  if (!hits(MAX_MONTHLY_SAVINGS)) return null;
  let lo = input.monthlySavings;
  let hi = MAX_MONTHLY_SAVINGS;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (hits(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
};

export function evaluateGoals(
  input: ScenarioInput,
  result: SimulationResult,
): ReadonlyArray<GoalResult> {
  return input.goals.map((goal): GoalResult => {
    if (goal.type === "wealth") {
      const equityAtTargetYear = equityAtYear(result, goal.year);
      const achieved = equityAtTargetYear >= goal.amount;
      const hit = result.rows.find((r) => r.equity >= goal.amount);
      return {
        type: "wealth",
        goal,
        achieved,
        hitYear: hit ? hit.year : null,
        equityAtTargetYear,
        shortfall: Math.max(0, goal.amount - equityAtTargetYear),
        requiredMonthlySavings: achieved ? null : solveRequiredSavings(input, goal),
      };
    }
    const required =
      input.expectedReturn > 0
        ? (12 * goal.monthlyAmount) / input.expectedReturn
        : Number.POSITIVE_INFINITY;
    const feasibleRow = result.rows.find((r) => r.portfolio >= required);
    return {
      type: "passiveIncome",
      goal,
      requiredIskCapital: required,
      feasible: feasibleRow !== undefined,
      feasibleYear: feasibleRow ? feasibleRow.year : null,
    };
  });
}
