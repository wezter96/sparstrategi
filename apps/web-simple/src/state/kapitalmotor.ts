import { Atom } from "effect/unstable/reactivity";
import {
  defaultHoldingTaxParams2026,
  defaultTaxParams2026,
  simulateHolding,
  simulateKapitalmotor,
  type HoldingInput,
  type KapitalmotorInput,
} from "@sparstrategi/engine";

export interface KapitalmotorUiInput {
  equity: number;
  targetLtvOfEquity: number;
  expectedReturn: number;
  loanRate: number;
  horizonYears: number;
  capitalGainsTaxRate: number;
  extractDividends: boolean;
}

export const defaultKapitalmotorUiInput: KapitalmotorUiInput = {
  equity: 5_000_000_000,
  targetLtvOfEquity: 0.2,
  expectedReturn: 0.08,
  loanRate: 0.04,
  horizonYears: 10,
  capitalGainsTaxRate: 0.3,
  extractDividends: true,
};

const serialize = (input: KapitalmotorUiInput): string =>
  btoa(encodeURIComponent(JSON.stringify(input)));

const parse = (s: string): KapitalmotorUiInput | null => {
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(s)));
    return { ...defaultKapitalmotorUiInput, ...parsed };
  } catch {
    return null;
  }
};

// Standalone single-page app: share the current page (origin + path, e.g. the
// GitHub Pages project path) rather than a `/kapitalmotor` sub-route.
export const kapitalmotorShareUrl = (input: KapitalmotorUiInput): string =>
  `${window.location.origin}${window.location.pathname}?s=${encodeURIComponent(serialize(input))}`;

const initialInput = (): KapitalmotorUiInput => {
  if (typeof window === "undefined") return defaultKapitalmotorUiInput;
  const s = new URLSearchParams(window.location.search).get("s");
  return (s && parse(s)) || defaultKapitalmotorUiInput;
};

export const kapitalmotorInputAtom = Atom.make(initialInput());

const toEngineInput = (
  ui: KapitalmotorUiInput,
  mode: "split" | "allIsk",
  withdraw: boolean,
): KapitalmotorInput => ({
  equity: ui.equity,
  targetLtvOfEquity: ui.targetLtvOfEquity,
  expectedReturn: ui.expectedReturn,
  loanRate: ui.loanRate,
  taxParams: defaultTaxParams2026,
  horizonYears: ui.horizonYears,
  mode,
  withdraw,
  capitalGainsTaxRate: ui.capitalGainsTaxRate,
});

/** Alt 1, uttagsläge (dokumentets "Tillväxt över tid"). */
export const alt1WithdrawAtom = Atom.make((get) =>
  simulateKapitalmotor(toEngineInput(get(kapitalmotorInputAtom), "split", true)),
);

/** Alt 1 vs Alt 2, allt återinvesteras (jämförelsegrafen + realiserat värde). */
export const alt1ReinvestAtom = Atom.make((get) =>
  simulateKapitalmotor(toEngineInput(get(kapitalmotorInputAtom), "split", false)),
);
export const alt2ReinvestAtom = Atom.make((get) =>
  simulateKapitalmotor(toEngineInput(get(kapitalmotorInputAtom), "allIsk", false)),
);

/** Samma scenario över 100 år, för det logaritmiska långsiktsdiagrammet. */
export const longHorizonAtom = Atom.make((get) => {
  const ui = get(kapitalmotorInputAtom);
  const long = { ...ui, horizonYears: 100 };
  return {
    alt1: simulateKapitalmotor(toEngineInput(long, "split", false)),
    alt2: simulateKapitalmotor(toEngineInput(long, "allIsk", false)),
  };
});

export const holdingAtom = Atom.make((get) => {
  const ui = get(kapitalmotorInputAtom);
  const input: HoldingInput = {
    equity: ui.equity,
    targetLtvOfEquity: ui.targetLtvOfEquity,
    expectedReturn: ui.expectedReturn,
    loanRate: ui.loanRate,
    taxParams: defaultHoldingTaxParams2026,
    horizonYears: ui.horizonYears,
    extractDividends: ui.extractDividends,
    capitalGainsRatePrivate: ui.capitalGainsTaxRate,
  };
  return simulateHolding(input);
});
