import {
  defaultTaxParams2026,
  simulateWithdrawal,
  type WithdrawalInput,
  type WithdrawalResult,
} from "@sparstrategi/engine";
import { Atom } from "effect/unstable/reactivity";

export interface WithdrawalUiInput {
  startCapital: number;
  monthlyWithdrawal: number;
  expectedReturn: number;
  inflation: number;
  accountType: "isk" | "af" | "none";
  /** AF: anskaffningsvärdets andel av startkapitalet (0–1). */
  afBasisShare: number;
  horizonYears: number;
  showReal: boolean;
}

export const defaultWithdrawalUiInput: WithdrawalUiInput = {
  startCapital: 3_000_000,
  monthlyWithdrawal: 12_000,
  expectedReturn: 0.05,
  inflation: 0.02,
  accountType: "isk",
  afBasisShare: 0.5,
  horizonYears: 40,
  showReal: true,
};

const serialize = (input: WithdrawalUiInput): string =>
  btoa(encodeURIComponent(JSON.stringify(input)));

const parse = (s: string): WithdrawalUiInput | null => {
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(s)));
    return { ...defaultWithdrawalUiInput, ...parsed };
  } catch {
    return null;
  }
};

/** Uttagsvyns dela-payload bor i `?u=` — krockar inte med `?j=`/`?s=`. */
export const withdrawalShareUrl = (input: WithdrawalUiInput): string =>
  `${window.location.origin}${window.location.pathname}?u=${encodeURIComponent(serialize(input))}#/uttag`;

export const serializeWithdrawal = serialize;

const initialInput = (): WithdrawalUiInput => {
  if (typeof window !== "undefined") {
    const u = new URLSearchParams(window.location.search).get("u");
    const parsed = u && parse(u);
    if (parsed) return parsed;
  }
  return defaultWithdrawalUiInput;
};

export const withdrawalInputAtom = Atom.make(initialInput());

export const withdrawalResultAtom = Atom.make((get): WithdrawalResult => {
  const ui = get(withdrawalInputAtom);
  const input: WithdrawalInput = {
    startCapital: ui.startCapital,
    monthlyWithdrawal: ui.monthlyWithdrawal,
    expectedReturn: ui.expectedReturn,
    inflation: ui.inflation,
    accountType: ui.accountType,
    afBasisShare: ui.afBasisShare,
    taxParams: defaultTaxParams2026,
    horizonYears: ui.horizonYears,
  };
  return simulateWithdrawal(input);
});
