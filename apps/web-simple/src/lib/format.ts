const group = (n: number, decimals: number): string => {
  const fixed = n.toFixed(decimals);
  const [int, frac] = fixed.split(".");
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return frac ? `${grouped},${frac}` : grouped;
};

export const fmtKr = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${group(value / 1e9, 2)} Mdr kr`;
  if (abs >= 1e6) return `${group(value / 1e6, 1)} Mkr`;
  if (abs >= 1e4) return `${group(value / 1e3, 1)} tkr`;
  return `${group(value, 0)} kr`;
};

export const fmtPct = (value: number): string => `${group(value * 100, 1)} %`;
