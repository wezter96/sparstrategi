/** Deflatera ett nominellt belopp år `year` till dagens penningvärde. */
export const deflate = (value: number, year: number, inflation: number): number =>
  value / (1 + inflation) ** year;

export const defaultInflation = 0.02;
