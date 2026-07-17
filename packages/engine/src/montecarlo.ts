import type { TaxParams } from "./schema";
import { interestDeduction, iskTax, iskTaxRate, netTax } from "./tax";

/**
 * Stochastic validation of the Kelly analysis: runs the SAME split-mode
 * (AF+ISK) leverage mechanics as `kapitalmotor.ts`, but with random annual
 * returns instead of a constant one, across many simulated paths. Shows the
 * spread of outcomes (percentiles) and the probability of a margin call —
 * the thing a single deterministic scenario can never reveal.
 */
export interface MonteCarloInput {
  equity: number;
  targetLtvOfEquity: number;
  /** Aritmetisk förväntad årsavkastning (samma μ som i Kelly-beräkningen). */
  expectedReturn: number;
  volatility: number;
  loanRate: number;
  taxParams: TaxParams;
  horizonYears: number;
  capitalGainsTaxRate: number;
  /** Mäklarens marginalkrav: lån / total portfölj (standard-LTV, inte av eget kapital). */
  maxLtvOfTotal: number;
  /** true = ta ut hållbart uttag varje år (som huvudtabellen); false = allt återinvesteras. */
  withdraw: boolean;
  /** Löpande nytt sparande utöver grundkapitalet, tillförs AF-kontot varje år (default 0). */
  monthlySavings: number;
  paths: number;
  seed: number;
}

export interface MonteCarloYearSummary {
  year: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  /** Andel av banorna som redan fått en margin call vid eller före detta år. */
  cumulativeMarginCallProbability: number;
}

export interface MonteCarloResult {
  years: ReadonlyArray<MonteCarloYearSummary>;
  finalMarginCallProbability: number;
}

// mulberry32 — liten, snabb, deterministisk PRNG (samma indata ⇒ samma resultat,
// vilket krävs för delade länkar och stabil UI mellan renderingar).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalSample(rand: () => number): number {
  // Box-Muller
  const u1 = Math.max(rand(), 1e-12);
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

const percentile = (sorted: ReadonlyArray<number>, p: number): number => {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[idx]!;
};

export function simulateMonteCarlo(input: MonteCarloInput): MonteCarloResult {
  const {
    equity,
    targetLtvOfEquity: L,
    expectedReturn: mu,
    volatility: sigma,
    loanRate: i,
    taxParams,
    horizonYears,
    withdraw,
    maxLtvOfTotal,
    monthlySavings,
    paths,
    seed,
  } = input;
  const te = iskTaxRate(taxParams);
  const rand = mulberry32(seed);
  const driftAdj = Math.log(1 + mu) - 0.5 * sigma * sigma;
  const savingsAdded = 12 * monthlySavings;

  // portfolio[year][pathIndex]
  const portfolioByYear: number[][] = Array.from({ length: horizonYears + 1 }, () => []);
  const ruinedByYear: number[] = new Array(horizonYears + 1).fill(0);

  const loan0 = equity * L;
  const total0 = equity + loan0;

  for (let path = 0; path < paths; path++) {
    let af: number;
    let isk: number;
    {
      const interest0 = loan0 * i;
      const deduction0 = interestDeduction(interest0, taxParams);
      isk = te > 0 ? deduction0 / te : 0;
      af = total0 - isk;
    }
    let loan = loan0;
    let ruined = false;

    portfolioByYear[0]!.push(af + isk);

    for (let year = 1; year <= horizonYears; year++) {
      if (ruined) {
        portfolioByYear[year]!.push(0);
        continue;
      }

      const z = normalSample(rand);
      const r = Math.exp(driftAdj + sigma * z) - 1;

      const loanPrev = loan;
      const iskPrev = isk;
      const afPrev = af;
      const interest = loanPrev * i;

      const iskReturn = iskPrev * r;
      const iskTaxAmount = iskTax(iskPrev, taxParams);
      const deduction = interestDeduction(interest, taxParams);
      const { net } = netTax(iskTaxAmount, deduction);
      const surplus = iskReturn - interest - net;

      const afOrganic = afPrev * (1 + r);
      let afThisYear = afOrganic;
      if (!withdraw) afThisYear = afOrganic + surplus;
      afThisYear += savingsAdded;

      const totalThisYear = afThisYear + iskPrev;
      const equityThisYear = totalThisYear - loanPrev;

      if (equityThisYear <= 0 || (totalThisYear > 0 && loanPrev / totalThisYear > maxLtvOfTotal)) {
        ruined = true;
        ruinedByYear[year] = (ruinedByYear[year] ?? 0) + 1;
        portfolioByYear[year]!.push(Math.max(0, equityThisYear));
        continue;
      }

      portfolioByYear[year]!.push(totalThisYear);

      const loanNew = equityThisYear * L;
      const totalAfterLever = equityThisYear + loanNew;
      const interestNext = loanNew * i;
      const deductionNext = interestDeduction(interestNext, taxParams);
      const iskNew = te > 0 ? deductionNext / te : 0;
      af = totalAfterLever - iskNew;
      isk = iskNew;
      loan = loanNew;
    }
  }

  let cumulativeRuined = 0;
  const years: MonteCarloYearSummary[] = [];
  for (let year = 0; year <= horizonYears; year++) {
    cumulativeRuined += ruinedByYear[year] ?? 0;
    const values = [...portfolioByYear[year]!].sort((a, b) => a - b);
    years.push({
      year,
      p5: percentile(values, 0.05),
      p25: percentile(values, 0.25),
      p50: percentile(values, 0.5),
      p75: percentile(values, 0.75),
      p95: percentile(values, 0.95),
      cumulativeMarginCallProbability: cumulativeRuined / paths,
    });
  }

  return { years, finalMarginCallProbability: cumulativeRuined / paths };
}

export const defaultMonteCarloPaths = 2000;
