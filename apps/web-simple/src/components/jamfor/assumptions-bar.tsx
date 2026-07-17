import { useAtom } from "@effect/atom-react";
import { NumberField } from "@sparstrategi/ui/components/number-field";

import { comparisonInputAtom } from "@/state/comparison";

export function AssumptionsBar({ lockDeposits }: { lockDeposits: boolean }) {
  const [input, setInput] = useAtom(comparisonInputAtom);
  const set = (key: "startCapital" | "monthlySavings" | "horizonYears", value: number) =>
    setInput({ ...input, assumptions: { ...input.assumptions, [key]: value } });

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3">
      <NumberField
        label="Startkapital (kr)"
        value={input.assumptions.startCapital}
        onChange={(v) => set("startCapital", Math.max(0, v))}
        min={0}
        max={100_000_000}
        step={10_000}
      />
      <NumberField
        label="Månadssparande (kr/mån)"
        value={input.assumptions.monthlySavings}
        onChange={(v) => set("monthlySavings", Math.max(0, v))}
        min={0}
        max={1_000_000}
        step={500}
      />
      <NumberField
        label="Horisont (år)"
        value={input.assumptions.horizonYears}
        onChange={(v) => set("horizonYears", Math.min(50, Math.max(1, Math.round(v))))}
        min={1}
        max={50}
      />
      {!lockDeposits ? (
        <p className="text-xs text-muted-foreground sm:col-span-3">
          I den här mallen kan strategierna åsidosätta start- och månadsbelopp — se fälten i
          respektive kolumn.
        </p>
      ) : null}
    </div>
  );
}
