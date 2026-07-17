import {
  simulateStrategy,
  type ComparisonAssumptions,
  type StrategyInput,
  type StrategyResult,
} from "./comparison";

/**
 * Sparmål för jämförelsemotorn: "när når strategin X kr?" och "hur mycket
 * måste jag månadsspara för att nå X kr till år Y?". Målet utvärderas mot
 * `valueAfterRealization` — vad kontot faktiskt är värt efter latent skatt —
 * så att AF inte ser bättre ut än det är.
 */
export interface ComparisonGoal {
  amount: number;
  /** Målår; utelämnat = horisontens slut. */
  year?: number;
}

export interface StrategyGoalResult {
  name: string;
  /** Första året målet nås (netto efter latent skatt), null = nås aldrig inom horisonten. */
  hitYear: number | null;
  valueAtTargetYear: number;
  shortfall: number;
  /** Månadssparande som krävs för att nå målet till målåret; null om målet
   * redan nås med nuvarande sparande, eller om det är onåbart (< 1 Mkr/mån). */
  requiredMonthlySavings: number | null;
}

const MAX_MONTHLY = 1_000_000;

const netValueAt = (result: StrategyResult, year: number): number =>
  (result.rows.find((r) => r.year === year) ?? result.rows.at(-1)!)
    .valueAfterRealization;

export function evaluateComparisonGoal(
  a: ComparisonAssumptions,
  strategies: ReadonlyArray<StrategyInput>,
  results: ReadonlyArray<StrategyResult>,
  goal: ComparisonGoal,
): StrategyGoalResult[] {
  const targetYear = Math.min(goal.year ?? a.horizonYears, a.horizonYears);

  return strategies.map((s, idx) => {
    const result = results[idx] ?? simulateStrategy(a, s);
    const valueAtTargetYear = netValueAt(result, targetYear);
    const hit = result.rows.find((r) => r.valueAfterRealization >= goal.amount);
    const achieved = valueAtTargetYear >= goal.amount;

    let requiredMonthlySavings: number | null = null;
    if (!achieved) {
      const hits = (monthly: number) =>
        netValueAt(
          simulateStrategy(a, { ...s, monthlySavingsOverride: monthly }),
          targetYear,
        ) >= goal.amount;
      if (hits(MAX_MONTHLY)) {
        let lo = s.monthlySavingsOverride ?? a.monthlySavings;
        let hi = MAX_MONTHLY;
        for (let i = 0; i < 50; i++) {
          const mid = (lo + hi) / 2;
          if (hits(mid)) hi = mid;
          else lo = mid;
        }
        requiredMonthlySavings = hi;
      }
    }

    return {
      name: s.name,
      hitYear: hit ? hit.year : null,
      valueAtTargetYear,
      shortfall: Math.max(0, goal.amount - valueAtTargetYear),
      requiredMonthlySavings,
    };
  });
}
