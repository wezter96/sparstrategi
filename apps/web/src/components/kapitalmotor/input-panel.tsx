import { useAtom } from "@effect/atom-react";
import { Checkbox } from "@sparstrategi/ui/components/checkbox";
import { Input } from "@sparstrategi/ui/components/input";
import { Label } from "@sparstrategi/ui/components/label";

import { kapitalmotorInputAtom, type KapitalmotorUiInput } from "@/state/kapitalmotor";

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

export function KapitalmotorInputPanel() {
  const [input, setInput] = useAtom(kapitalmotorInputAtom);
  const set = <K extends keyof KapitalmotorUiInput>(key: K, value: KapitalmotorUiInput[K]) =>
    setInput({ ...input, [key]: value });

  return (
    <aside className="space-y-4">
      <NumberField
        label="Eget kapital, grundförutsättning (kr)"
        value={input.equity}
        onChange={(v) => set("equity", v)}
        min={1_000_000}
        max={10_000_000_000}
        step={1_000_000}
      />
      <NumberField
        label="Belåningsgrad, av eget kapital (%)"
        value={input.targetLtvOfEquity * 100}
        onChange={(v) => set("targetLtvOfEquity", v / 100)}
        min={0}
        max={60}
        step={1}
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
        label="Låneränta (%)"
        value={input.loanRate * 100}
        onChange={(v) => set("loanRate", v / 100)}
        min={0}
        max={10}
        step={0.1}
        suffix="%"
      />
      <NumberField
        label="Horisont (år)"
        value={input.horizonYears}
        onChange={(v) => set("horizonYears", Math.max(1, Math.round(v)))}
        min={1}
        max={50}
      />
      <NumberField
        label="Kapitalvinstskatt, AF vid realisation (%)"
        value={input.capitalGainsTaxRate * 100}
        onChange={(v) => set("capitalGainsTaxRate", v / 100)}
        min={0}
        max={60}
        step={1}
        suffix="%"
      />
      <div className="flex items-center gap-2 pt-2">
        <Checkbox
          checked={input.extractDividends}
          onCheckedChange={(c) => set("extractDividends", c === true)}
        />
        <Label className="text-xs">Holdingbolag: ta ut gränsbelopp som utdelning varje år</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Skatteparametrar (ISK-schablonskatt, ränteavdrag, bolagsskatt, 3:12-gränsbelopp) använder
        2026 års standardvärden. Belåningsgraden avser lån / eget kapital — inte lån / total
        portfölj som i huvudsimulatorn.
      </p>
    </aside>
  );
}
