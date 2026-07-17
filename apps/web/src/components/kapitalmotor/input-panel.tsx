import { useAtom } from "@effect/atom-react";
import { Button } from "@sparstrategi/ui/components/button";
import { Checkbox } from "@sparstrategi/ui/components/checkbox";
import { Label } from "@sparstrategi/ui/components/label";
import { NumberField } from "@sparstrategi/ui/components/number-field";

import { kapitalmotorInputAtom, type KapitalmotorUiInput } from "@/state/kapitalmotor";

export function KapitalmotorInputPanel() {
  const [input, setInput] = useAtom(kapitalmotorInputAtom);
  const set = <K extends keyof KapitalmotorUiInput>(key: K, value: KapitalmotorUiInput[K]) =>
    setInput({ ...input, [key]: value });
  const isManual = input.manualIskSharePct !== undefined;

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
        label="Löpande sparande (kr/mån)"
        value={input.monthlySavings}
        onChange={(v) => set("monthlySavings", v)}
        min={0}
        max={10_000_000}
        step={1_000}
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
        label="Volatilitet, årlig (%)"
        value={input.volatility * 100}
        onChange={(v) => set("volatility", v / 100)}
        min={0}
        max={50}
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
        label="Mäklarens marginalkrav, lån / total portfölj (%)"
        value={input.maxLtvOfTotal * 100}
        onChange={(v) => set("maxLtvOfTotal", v / 100)}
        min={10}
        max={90}
        step={1}
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

      <div className="space-y-2 border-t pt-3">
        <Label className="text-xs text-muted-foreground">Fördelning AF/ISK (Alt 1)</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={isManual ? "outline" : "default"}
            size="sm"
            onClick={() => setInput({ ...input, manualIskSharePct: undefined })}
          >
            Auto (skatteneutral)
          </Button>
          <Button
            type="button"
            variant={isManual ? "default" : "outline"}
            size="sm"
            onClick={() => set("manualIskSharePct", input.manualIskSharePct ?? 13.3)}
          >
            Manuell
          </Button>
        </div>
        {isManual ? (
          <NumberField
            label="ISK-andel av totalen (%)"
            value={input.manualIskSharePct ?? 0}
            onChange={(v) => set("manualIskSharePct", Math.min(100, Math.max(0, v)))}
            min={0}
            max={100}
            step={1}
            suffix="%"
          />
        ) : null}
        <p className="text-xs text-muted-foreground">
          Auto räknar ut den ISK-andel som gör nettoskatten exakt 0 kr. En manuell andel — för
          liten eller för stor — ger nästan alltid en positiv effektiv skattesats, eftersom
          ränteavdraget då inte längre matchar ISK-schablonskatten exakt.
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Skatteparametrar (ISK-schablonskatt, ränteavdrag, bolagsskatt, 3:12-gränsbelopp) använder
        2026 års standardvärden. Belåningsgraden avser lån / eget kapital — inte lån / total
        portfölj som i huvudsimulatorn.
      </p>
    </aside>
  );
}
