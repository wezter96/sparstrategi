import { Atom } from "effect/unstable/reactivity";
import {
  defaultHoldingTaxParams2026,
  defaultMonteCarloPaths,
  defaultTaxParams2026,
  defaultVolatility,
  growthRateCurve,
  kellyOptimalLtvOfEquity,
  simulateHolding,
  simulateKapitalmotor,
  simulateMonteCarlo,
  type HoldingInput,
  type KapitalmotorInput,
  type MonteCarloInput,
} from "@sparstrategi/engine";

export interface KapitalmotorUiInput {
  equity: number;
  targetLtvOfEquity: number;
  expectedReturn: number;
  loanRate: number;
  horizonYears: number;
  capitalGainsTaxRate: number;
  extractDividends: boolean;
  volatility: number;
  maxLtvOfTotal: number;
  monthlySavings: number;
  /** Manuell ISK-andel (0–100 %). undefined ⇒ skatteneutral autokalibrering. */
  manualIskSharePct?: number;
}

export const defaultKapitalmotorUiInput: KapitalmotorUiInput = {
  equity: 5_000_000,
  targetLtvOfEquity: 0.2,
  expectedReturn: 0.08,
  loanRate: 0.04,
  horizonYears: 10,
  capitalGainsTaxRate: 0.3,
  extractDividends: true,
  volatility: defaultVolatility,
  maxLtvOfTotal: 0.6,
  monthlySavings: 0,
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

export const kapitalmotorShareUrl = (input: KapitalmotorUiInput): string =>
  `${window.location.origin}/kapitalmotor?s=${encodeURIComponent(serialize(input))}`;

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
  monthlySavings: ui.monthlySavings,
  manualIskShare:
    ui.manualIskSharePct !== undefined ? ui.manualIskSharePct / 100 : undefined,
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

const kellyParamsOf = (ui: KapitalmotorUiInput) => ({
  expectedReturn: ui.expectedReturn,
  volatility: ui.volatility,
  loanRate: ui.loanRate,
});

/** Kelly-optimal belåningsgrad (kontinuerlig approximation) för nuvarande μ/σ/r. */
export const kellyOptimalAtom = Atom.make((get) =>
  kellyOptimalLtvOfEquity(kellyParamsOf(get(kapitalmotorInputAtom))),
);

/** Tillväxttakt (analytisk) över ett spann av belåningsgrader, för Kelly-kurvan. */
export const kellyCurveAtom = Atom.make((get) => {
  const ui = get(kapitalmotorInputAtom);
  const kellyL = kellyOptimalLtvOfEquity(kellyParamsOf(ui));
  const maxL = Math.max(0.6, Math.min(3, kellyL * 2.2, ui.targetLtvOfEquity * 2.5));
  return growthRateCurve(kellyParamsOf(ui), { maxLtvOfEquity: maxL, steps: 60 });
});

/** Empirisk validering av Kelly-kurvan: stokastisk simulering med den faktiska,
 * diskreta årsvisa återbelåningsmekaniken (inte bara kontinuerlig approximation). */
export const monteCarloAtom = Atom.make((get) => {
  const ui = get(kapitalmotorInputAtom);
  const input: MonteCarloInput = {
    equity: ui.equity,
    targetLtvOfEquity: ui.targetLtvOfEquity,
    expectedReturn: ui.expectedReturn,
    volatility: ui.volatility,
    loanRate: ui.loanRate,
    taxParams: defaultTaxParams2026,
    horizonYears: ui.horizonYears,
    capitalGainsTaxRate: ui.capitalGainsTaxRate,
    maxLtvOfTotal: ui.maxLtvOfTotal,
    withdraw: false,
    monthlySavings: ui.monthlySavings,
    paths: defaultMonteCarloPaths,
    seed: 20260717,
  };
  return simulateMonteCarlo(input);
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
    monthlySavings: ui.monthlySavings,
  };
  return simulateHolding(input);
});
