import { useAtom } from "@effect/atom-react";
import { Checkbox } from "@sparstrategi/ui/components/checkbox";
import { Label } from "@sparstrategi/ui/components/label";
import { NumberField } from "@sparstrategi/ui/components/number-field";

import { PctField } from "@/components/pct-field";
import { comparisonInputAtom } from "@/state/comparison";

export function AssumptionsBar({ lockDeposits }: { lockDeposits: boolean }) {
  const [input, setInput] = useAtom(comparisonInputAtom);
  const set = (key: "startCapital" | "monthlySavings" | "horizonYears", value: number) =>
    setInput({ ...input, assumptions: { ...input.assumptions, [key]: value } });

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
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
      <div className="space-y-2">
        <PctField
          label="Inflation (%/år)"
          value={input.display.inflation}
          onChange={(v) =>
            setInput({ ...input, display: { ...input.display, inflation: Math.max(0, v) } })
          }
          max={10}
          step={0.1}
        />
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-real"
            checked={input.display.showReal}
            onCheckedChange={(c) =>
              setInput({ ...input, display: { ...input.display, showReal: c === true } })
            }
          />
          <Label htmlFor="show-real" className="text-xs">
            Visa i dagens penningvärde
          </Label>
        </div>
      </div>
      {!lockDeposits ? (
        <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">
          I den här mallen kan strategierna åsidosätta start- och månadsbelopp — se fälten i
          respektive kolumn.
        </p>
      ) : null}
    </div>
  );
}
