import {
  simulateStrategy,
  type ComparisonAssumptions,
  type StrategyInput,
} from "./comparison";

/**
 * Osäkerhetsband för jämförelsemotorn: kör `simulateStrategy` med stokastiska
 * årsavkastningar (lognormal kring strategins kurstillväxt; utdelningen hålls
 * deterministisk) och rapporterar percentiler av `value` per år — samma mått
 * som värdegrafens deterministiska linje, så bandet och linjen är jämförbara.
 * Full skatte-/avgiftslogik per bana — inte en analytisk approximation.
 * Deterministisk PRNG (mulberry32) så att delade länkar ger samma band.
 */
export interface ComparisonMonteCarloInput {
  assumptions: ComparisonAssumptions;
  strategy: StrategyInput;
  /** Årlig volatilitet på kursutvecklingen (t.ex. 0.18). */
  volatility: number;
  paths: number;
  seed: number;
}

export interface ComparisonMonteCarloYear {
  year: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface ComparisonMonteCarloResult {
  years: ReadonlyArray<ComparisonMonteCarloYear>;
}

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
  const u1 = Math.max(rand(), 1e-12);
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

const percentile = (sorted: ReadonlyArray<number>, p: number): number => {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[idx]!;
};

export function simulateComparisonMonteCarlo(
  input: ComparisonMonteCarloInput,
): ComparisonMonteCarloResult {
  const { assumptions: a, strategy: s, volatility: sigma, paths, seed } = input;
  const rand = mulberry32(seed);
  const driftAdj = Math.log(1 + s.priceGrowth) - 0.5 * sigma * sigma;

  // valuesByYear[year][path]
  const valuesByYear: number[][] = Array.from({ length: a.horizonYears + 1 }, () => []);

  for (let path = 0; path < paths; path++) {
    const priceGrowthByYear = Array.from({ length: a.horizonYears }, () => {
      const z = normalSample(rand);
      return Math.exp(driftAdj + sigma * z) - 1;
    });
    const result = simulateStrategy(a, s, { priceGrowthByYear });
    for (const row of result.rows) {
      valuesByYear[row.year]!.push(row.value);
    }
  }

  const years: ComparisonMonteCarloYear[] = valuesByYear.map((values, year) => {
    const sorted = [...values].sort((x, y) => x - y);
    return {
      year,
      p10: percentile(sorted, 0.1),
      p50: percentile(sorted, 0.5),
      p90: percentile(sorted, 0.9),
    };
  });

  return { years };
}

export const defaultComparisonMonteCarloPaths = 400;
export const defaultComparisonVolatility = 0.18;
