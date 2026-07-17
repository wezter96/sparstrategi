/**
 * Kelly-kriteriet för belånad exponering (Merton/Kelly continuous-time
 * leverage). Svarar på: vilken hävstång maximerar den FÖRVÄNTADE
 * SAMMANSATTA (geometriska) tillväxttakten — inte den aritmetiska
 * förväntade avkastningen, som är vilseledande vid hävstång eftersom
 * volatilitet urholkar sammansättningen kvadratiskt med hävstången.
 *
 * f = total exponering / eget kapital (1 = ingen belåning, 1,2 = 20%
 * belåning av eget kapital, osv). L (belåningsgrad av eget kapital) = f − 1.
 *
 * g(f) = r + f·(μ − r) − ½·f²·σ²          (kontinuerlig approximation)
 * f*   = (μ − r) / σ²                      (tillväxtmaximerande exponering)
 *
 * OBS: μ ska vara den ARITMETISKA förväntade årsavkastningen, inte den
 * geometriska. Formeln är en kontinuerlig-tid-approximation (Merton) —
 * `montecarlo.ts` validerar den empiriskt mot motorns faktiska diskreta,
 * årsvisa återbelåningsmekanik.
 */
export interface KellyParams {
  /** Portföljens förväntade aritmetiska årsavkastning (t.ex. 0,08). */
  expectedReturn: number;
  /** Portföljens förväntade årliga standardavvikelse (t.ex. 0,18). */
  volatility: number;
  /** Låneränta. */
  loanRate: number;
}

/** Tillväxtmaximerande total exponering (f*) = (μ − r) / σ². */
export const kellyOptimalExposure = (p: KellyParams): number => {
  if (p.volatility <= 0) return Number.POSITIVE_INFINITY;
  return (p.expectedReturn - p.loanRate) / (p.volatility * p.volatility);
};

/** Tillväxtmaximerande belåningsgrad av eget kapital, L* = f* − 1. */
export const kellyOptimalLtvOfEquity = (p: KellyParams): number => kellyOptimalExposure(p) - 1;

/** Förväntad geometrisk (sammansatt) tillväxttakt vid exponering f. */
export const geometricGrowthRate = (f: number, p: KellyParams): number =>
  p.loanRate + f * (p.expectedReturn - p.loanRate) - 0.5 * f * f * p.volatility * p.volatility;

export interface GrowthCurvePoint {
  ltvOfEquity: number;
  exposure: number;
  growthRate: number;
}

/**
 * Tillväxttakt över ett spann av belåningsgrader, för att rita "tillväxt vs.
 * hävstång"-kurvan och visa var toppen (Kelly-optimum) ligger relativt
 * nuvarande inställning.
 */
export const growthRateCurve = (
  p: KellyParams,
  options?: { maxLtvOfEquity?: number; steps?: number },
): ReadonlyArray<GrowthCurvePoint> => {
  const maxL = options?.maxLtvOfEquity ?? 1.5;
  const steps = options?.steps ?? 60;
  const points: GrowthCurvePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const ltvOfEquity = (maxL * i) / steps;
    const exposure = 1 + ltvOfEquity;
    points.push({ ltvOfEquity, exposure, growthRate: geometricGrowthRate(exposure, p) });
  }
  return points;
};

export const defaultVolatility = 0.18;
