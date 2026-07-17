import {
  compareStrategies,
  defaultComparisonMonteCarloPaths,
  defaultComparisonVolatility,
  defaultStrategyInput,
  defaultTaxParams2026,
  evaluateComparisonGoal,
  simulateComparisonMonteCarlo,
  type ComparisonMonteCarloResult,
  type StrategyGoalResult,
  type StrategyInput,
  type StrategyResult,
} from "@sparstrategi/engine";
import { Atom } from "effect/unstable/reactivity";

import { defaultInflation } from "@/lib/deflate";
import { templateById } from "@/lib/templates";

export interface ComparisonUiInput {
  templateId: string;
  assumptions: { startCapital: number; monthlySavings: number; horizonYears: number };
  strategies: StrategyInput[];
  /** Inflationsantagande + om beloppen visas i dagens penningvärde. */
  display: { inflation: number; showReal: boolean };
  /** Sparmål: "när når jag beloppet?" (år 0 = horisontens slut). */
  goal: { enabled: boolean; amount: number; year: number };
  /** Monte Carlo-band i värdegrafen. */
  uncertainty: { enabled: boolean; volatility: number };
}

const defaultExtras = (): Pick<ComparisonUiInput, "display" | "goal" | "uncertainty"> => ({
  display: { inflation: defaultInflation, showReal: false },
  goal: { enabled: false, amount: 1_000_000, year: 0 },
  uncertainty: { enabled: false, volatility: defaultComparisonVolatility },
});

export const fromTemplate = (id: string): ComparisonUiInput => {
  const t = templateById(id);
  return {
    templateId: t.id,
    assumptions: { ...t.assumptions },
    strategies: t.strategies.map((s) => ({ ...s })),
    ...defaultExtras(),
  };
};

const serialize = (input: ComparisonUiInput): string =>
  btoa(encodeURIComponent(JSON.stringify(input)));

const parse = (s: string): ComparisonUiInput | null => {
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(s))) as ComparisonUiInput;
    if (!Array.isArray(parsed.strategies) || parsed.strategies.length === 0) return null;
    const base = fromTemplate(parsed.templateId ?? "egen");
    const extras = defaultExtras();
    return {
      templateId: parsed.templateId ?? "egen",
      assumptions: { ...base.assumptions, ...parsed.assumptions },
      strategies: parsed.strategies.map((s) => ({
        ...defaultStrategyInput("Strategi"),
        ...s,
        name: typeof s?.name === "string" ? s.name : "Strategi",
      })),
      // Äldre dela-länkar saknar fälten — falla tillbaka på standardvärden.
      display: { ...extras.display, ...parsed.display },
      goal: { ...extras.goal, ...parsed.goal },
      uncertainty: { ...extras.uncertainty, ...parsed.uncertainty },
    };
  } catch {
    return null;
  }
};

/** Jämförelsens dela-payload bor i `?j=` — krockar aldrig med kapitalmotorns `?s=`. */
export const comparisonShareUrl = (input: ComparisonUiInput): string =>
  `${window.location.origin}${window.location.pathname}?j=${encodeURIComponent(serialize(input))}#/jamfor/${input.templateId}`;

export const serializeComparison = serialize;

const initialInput = (): ComparisonUiInput => {
  if (typeof window !== "undefined") {
    const j = new URLSearchParams(window.location.search).get("j");
    const parsed = j && parse(j);
    if (parsed) return parsed;
  }
  return fromTemplate("egen");
};

export const comparisonInputAtom = Atom.make(initialInput());

export const comparisonResultsAtom = Atom.make((get): StrategyResult[] => {
  const input = get(comparisonInputAtom);
  return compareStrategies(
    { ...input.assumptions, taxParams: defaultTaxParams2026 },
    input.strategies,
  );
});

/** Sparmålsutvärdering per strategi; null när målet är avstängt. */
export const comparisonGoalAtom = Atom.make((get): StrategyGoalResult[] | null => {
  const input = get(comparisonInputAtom);
  if (!input.goal.enabled || input.goal.amount <= 0) return null;
  return evaluateComparisonGoal(
    { ...input.assumptions, taxParams: defaultTaxParams2026 },
    input.strategies,
    get(comparisonResultsAtom),
    {
      amount: input.goal.amount,
      year: input.goal.year > 0 ? input.goal.year : undefined,
    },
  );
});

/** Monte Carlo-band per strategi; null när osäkerhetsvisningen är avstängd. */
export const comparisonMonteCarloAtom = Atom.make(
  (get): ComparisonMonteCarloResult[] | null => {
    const input = get(comparisonInputAtom);
    if (!input.uncertainty.enabled) return null;
    const assumptions = { ...input.assumptions, taxParams: defaultTaxParams2026 };
    return input.strategies.map((strategy, i) =>
      simulateComparisonMonteCarlo({
        assumptions,
        strategy,
        volatility: input.uncertainty.volatility,
        paths: defaultComparisonMonteCarloPaths,
        // Olika seed per strategi men stabil mellan renderingar och dela-länkar.
        seed: 20260717 + i,
      }),
    );
  },
);
