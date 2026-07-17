import {
  compareStrategies,
  defaultTaxParams2026,
  type StrategyInput,
  type StrategyResult,
} from "@sparstrategi/engine";
import { Atom } from "effect/unstable/reactivity";

import { templateById } from "@/lib/templates";

export interface ComparisonUiInput {
  templateId: string;
  assumptions: { startCapital: number; monthlySavings: number; horizonYears: number };
  strategies: StrategyInput[];
}

const fromTemplate = (id: string): ComparisonUiInput => {
  const t = templateById(id);
  return {
    templateId: t.id,
    assumptions: { ...t.assumptions },
    strategies: t.strategies.map((s) => ({ ...s })),
  };
};

const serialize = (input: ComparisonUiInput): string =>
  btoa(encodeURIComponent(JSON.stringify(input)));

const parse = (s: string): ComparisonUiInput | null => {
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(s))) as ComparisonUiInput;
    if (!Array.isArray(parsed.strategies) || parsed.strategies.length === 0) return null;
    const base = fromTemplate(parsed.templateId ?? "egen");
    return {
      templateId: parsed.templateId ?? "egen",
      assumptions: { ...base.assumptions, ...parsed.assumptions },
      strategies: parsed.strategies,
    };
  } catch {
    return null;
  }
};

/** Jämförelsens dela-payload bor i `?j=` — krockar aldrig med kapitalmotorns `?s=`. */
export const comparisonShareUrl = (input: ComparisonUiInput): string =>
  `${window.location.origin}${window.location.pathname}?j=${encodeURIComponent(serialize(input))}#/jamfor`;

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

/** Sätts av mallkorten på startsidan innan navigering till #/jamfor. */
let pendingTemplate: string | null = null;
export const loadTemplate = (id: string): void => {
  pendingTemplate = id;
};
export const consumePendingTemplate = (): ComparisonUiInput | null => {
  if (pendingTemplate === null) return null;
  const input = fromTemplate(pendingTemplate);
  pendingTemplate = null;
  return input;
};
