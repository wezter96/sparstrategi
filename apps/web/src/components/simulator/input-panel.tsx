import { useAtom, useAtomValue } from "@effect/atom-react";
import { Button } from "@sparstrategi/ui/components/button";
import { Checkbox } from "@sparstrategi/ui/components/checkbox";
import { Input } from "@sparstrategi/ui/components/input";
import { Label } from "@sparstrategi/ui/components/label";

import { inputAtom, simulationAtom } from "@/state/simulator";

function NumberField(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{props.label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={Number.isFinite(props.value) ? +props.value.toFixed(4) : 0}
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          onChange={(e) => props.onChange(Number(e.target.value))}
        />
        {props.suffix ? (
          <span className="text-xs text-muted-foreground">{props.suffix}</span>
        ) : null}
      </div>
      {props.min !== undefined && props.max !== undefined ? (
        <input
          type="range"
          className="w-full accent-primary"
          value={props.value}
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          onChange={(e) => props.onChange(Number(e.target.value))}
        />
      ) : null}
    </div>
  );
}

export function InputPanel() {
  const [input, setInput] = useAtom(inputAtom);
  const simulation = useAtomValue(simulationAtom);
  const set = <K extends keyof typeof input>(key: K, value: (typeof input)[K]) =>
    setInput({ ...input, [key]: value });
  const setTax = <K extends keyof typeof input.taxParams>(
    key: K,
    value: (typeof input.taxParams)[K],
  ) => setInput({ ...input, taxParams: { ...input.taxParams, [key]: value } });

  const isManual = input.manualIskShare !== undefined;
  const autoShare =
    simulation.calibration.initialPortfolio > 0
      ? simulation.calibration.initialIsk / simulation.calibration.initialPortfolio
      : 0;

  const setAutoMode = () => {
    const { manualIskShare: _drop, ...rest } = input;
    setInput(rest);
  };
  const setManualMode = () => {
    setInput({ ...input, manualIskShare: autoShare });
  };

  return (
    <aside className="space-y-4">
      <NumberField
        label="Startkapital (kr)"
        value={input.startCapital}
        onChange={(v) => set("startCapital", v)}
        min={0}
        max={20_000_000}
        step={50_000}
      />
      <NumberField
        label="Månadssparande (kr)"
        value={input.monthlySavings}
        onChange={(v) => set("monthlySavings", v)}
        min={0}
        max={100_000}
        step={500}
      />
      <NumberField
        label="Belåningsgrad (%)"
        value={input.targetLtv * 100}
        onChange={(v) => set("targetLtv", v / 100)}
        min={0}
        max={60}
        step={1}
        suffix="%"
      />
      <NumberField
        label="Låneränta (%)"
        value={input.loanRate * 100}
        onChange={(v) => set("loanRate", v / 100)}
        min={0}
        max={10}
        step={0.1}
        suffix="%"
      />
      <NumberField
        label="Förväntad avkastning (%)"
        value={input.expectedReturn * 100}
        onChange={(v) => set("expectedReturn", v / 100)}
        min={0}
        max={15}
        step={0.1}
        suffix="%"
      />
      <NumberField
        label="Levnadskostnader (kr/mån)"
        value={input.monthlyLivingCosts}
        onChange={(v) => set("monthlyLivingCosts", v)}
        min={0}
        max={200_000}
        step={1_000}
      />
      <NumberField
        label="Horisont (år)"
        value={input.horizonYears}
        onChange={(v) => set("horizonYears", Math.max(1, Math.round(v)))}
        min={1}
        max={50}
      />

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Fördelning AF/ISK</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={isManual ? "outline" : "default"}
            size="sm"
            onClick={setAutoMode}
          >
            Auto (kalibrerad)
          </Button>
          <Button
            type="button"
            variant={isManual ? "default" : "outline"}
            size="sm"
            onClick={setManualMode}
          >
            Manuell
          </Button>
        </div>
        {isManual ? (
          <NumberField
            label="ISK-andel (%)"
            value={(input.manualIskShare ?? 0) * 100}
            onChange={(v) => set("manualIskShare", Math.min(100, Math.max(0, v)) / 100)}
            min={0}
            max={100}
            step={1}
            suffix="%"
          />
        ) : null}
      </div>

      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Avancerat (skatteparametrar)
        </summary>
        <div className="mt-3 space-y-3">
          <NumberField
            label="Statslåneränta (%)"
            value={input.taxParams.slr * 100}
            onChange={(v) => setTax("slr", v / 100)}
            step={0.01}
            suffix="%"
          />
          <NumberField
            label="ISK fribelopp (kr)"
            value={input.taxParams.iskFreeAmount}
            onChange={(v) => setTax("iskFreeAmount", v)}
            step={10_000}
          />
          <NumberField
            label="Avdragssats, låg (%)"
            value={input.taxParams.deductionRateLow * 100}
            onChange={(v) => setTax("deductionRateLow", v / 100)}
            step={1}
            suffix="%"
          />
          <NumberField
            label="Avdragssats, hög (%)"
            value={input.taxParams.deductionRateHigh * 100}
            onChange={(v) => setTax("deductionRateHigh", v / 100)}
            step={1}
            suffix="%"
          />
          <NumberField
            label="Brytpunkt ränteavdrag (kr)"
            value={input.taxParams.deductionBreakpoint}
            onChange={(v) => setTax("deductionBreakpoint", v)}
            step={10_000}
          />
          <div className="flex items-center gap-2">
            <Checkbox
              checked={input.taxParams.deductionEligible}
              onCheckedChange={(c) => setTax("deductionEligible", c === true)}
            />
            <Label className="text-xs">Ränteavdrag (lån med säkerhet)</Label>
          </div>
          <NumberField
            label="Max belåningsgrad (%)"
            value={input.maxLtv * 100}
            onChange={(v) => set("maxLtv", v / 100)}
            min={0}
            max={90}
            suffix="%"
          />
        </div>
      </details>
    </aside>
  );
}
