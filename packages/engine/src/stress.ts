import type { ScenarioInput } from "./schema";
import { simulateWithHooks, type YearRow } from "./simulate";

export interface StressInput {
  crashPct: number;
  crashYear: number;
}

export interface StressResult {
  postCrashLtv: number;
  marginCall: boolean;
  forcedSaleAmount: number;
  preCrashEquity: number;
  recoveryYear: number | null;
  rows: ReadonlyArray<YearRow>;
}

export function stressTest(input: ScenarioInput, stress: StressInput): StressResult {
  let postCrashLtv = 0;
  let marginCall = false;
  let forcedSaleAmount = 0;
  let preCrashEquity = 0;

  const result = simulateWithHooks(input, {
    onYearStart: (year, state) => {
      if (year !== stress.crashYear) return state;
      preCrashEquity = state.af + state.isk - state.loan;
      let af = state.af * (1 - stress.crashPct);
      let isk = state.isk * (1 - stress.crashPct);
      let loan = state.loan;
      const v = af + isk;
      postCrashLtv = v > 0 ? loan / v : 1;
      if (postCrashLtv > input.maxLtv) {
        marginCall = true;
        forcedSaleAmount = (loan - input.targetLtv * v) / (1 - input.targetLtv);
        const fromAf = Math.min(af, forcedSaleAmount);
        af -= fromAf;
        isk -= forcedSaleAmount - fromAf;
        loan -= forcedSaleAmount;
      }
      return { af, isk, loan };
    },
    allowReleverage: (state) => {
      const v = state.af + state.isk;
      return v > 0 && state.loan / v <= input.targetLtv;
    },
  });

  const recoveryRow = result.rows.find(
    (r) => r.year > stress.crashYear && r.equity >= preCrashEquity,
  );
  return {
    postCrashLtv,
    marginCall,
    forcedSaleAmount,
    preCrashEquity,
    recoveryYear: recoveryRow ? recoveryRow.year : null,
    rows: result.rows,
  };
}
