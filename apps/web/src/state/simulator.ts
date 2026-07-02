import { Schema } from "effect";
import { Atom } from "effect/unstable/reactivity";
import {
  ScenarioInput,
  defaultScenarioInput,
  evaluateGoals,
  simulate,
  stressTest,
  type GoalResult,
  type SimulationResult,
  type StressResult,
} from "@sparstrategi/engine";

const decodeInput = Schema.decodeUnknownSync(ScenarioInput);

export const serializeShared = (input: ScenarioInput): string =>
  btoa(encodeURIComponent(JSON.stringify(input)));

export const parseShared = (s: string): ScenarioInput | null => {
  try {
    return decodeInput(JSON.parse(decodeURIComponent(atob(s))));
  } catch {
    return null;
  }
};

export const shareUrl = (input: ScenarioInput): string =>
  `${window.location.origin}/?s=${encodeURIComponent(serializeShared(input))}`;

const initialInput = (): ScenarioInput => {
  if (typeof window === "undefined") return defaultScenarioInput;
  const s = new URLSearchParams(window.location.search).get("s");
  return (s && parseShared(s)) || defaultScenarioInput;
};

export const inputAtom = Atom.make(initialInput());

export const simulationAtom: Atom.Atom<SimulationResult> = Atom.make((get) =>
  simulate(get(inputAtom)),
);

export const goalResultsAtom: Atom.Atom<ReadonlyArray<GoalResult>> = Atom.make(
  (get) => evaluateGoals(get(inputAtom), get(simulationAtom)),
);

export const stressSettingsAtom = Atom.make<{
  crashPct: number;
  crashYear: number;
} | null>(null);

export const stressResultAtom: Atom.Atom<StressResult | null> = Atom.make((get) => {
  const settings = get(stressSettingsAtom);
  return settings ? stressTest(get(inputAtom), settings) : null;
});
