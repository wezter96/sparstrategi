import { useAtom } from "@effect/atom-react";
import type { ComparisonAccountType, StrategyInput } from "@sparstrategi/engine";
import { Button } from "@sparstrategi/ui/components/button";
import { Checkbox } from "@sparstrategi/ui/components/checkbox";
import { Label } from "@sparstrategi/ui/components/label";
import { NumberField } from "@sparstrategi/ui/components/number-field";
import { XIcon } from "lucide-react";

import { STRATEGY_COLORS } from "@/components/jamfor/jamfor-chart";
import { templateById } from "@/lib/templates";
import { comparisonInputAtom } from "@/state/comparison";

const ACCOUNT_LABELS: Record<ComparisonAccountType, string> = {
  isk: "ISK",
  af: "AF (depå)",
  kf: "KF",
  none: "Skattefritt",
};

/** Ett procentfält: UI i %, state i decimal. */
function PctField(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
  step?: number;
}) {
  return (
    <NumberField
      label={props.label}
      value={props.value * 100}
      onChange={(v) => props.onChange(v / 100)}
      min={0}
      max={props.max ?? 30}
      step={props.step ?? 0.1}
      suffix="%"
    />
  );
}

export function StrategyColumn({ index }: { index: number }) {
  const [input, setInput] = useAtom(comparisonInputAtom);
  const strategy = input.strategies[index];
  if (!strategy) return null;
  const template = templateById(input.templateId);
  const highlighted = new Set(template.highlightedFields);
  const canRemove = input.strategies.length > 2;

  const set = <K extends keyof StrategyInput>(key: K, value: StrategyInput[K]) =>
    setInput({
      ...input,
      strategies: input.strategies.map((s, i) => (i === index ? { ...s, [key]: value } : s)),
    });
  const remove = () =>
    setInput({ ...input, strategies: input.strategies.filter((_, i) => i !== index) });

  const isHi = (k: keyof StrategyInput) => highlighted.has(k);

  const renderField = (key: keyof StrategyInput) => {
    switch (key) {
      case "priceGrowth":
        return (
          <PctField key={key} label="Kurstillväxt (%/år)" value={strategy.priceGrowth} onChange={(v) => set("priceGrowth", v)} />
        );
      case "dividendYield":
        return (
          <PctField key={key} label="Direktavkastning (%/år)" value={strategy.dividendYield} onChange={(v) => set("dividendYield", v)} />
        );
      case "fundFeeRate":
        return (
          <PctField key={key} label="Fondavgift (%/år)" value={strategy.fundFeeRate} onChange={(v) => set("fundFeeRate", v)} max={5} step={0.05} />
        );
      case "accountType":
        return (
          <div key={key} className="space-y-1">
            <Label className="text-xs">Sparform</Label>
            <div className="flex gap-1.5">
              {(Object.keys(ACCOUNT_LABELS) as ComparisonAccountType[]).map((acct) => (
                <Button
                  key={acct}
                  type="button"
                  size="sm"
                  variant={strategy.accountType === acct ? "default" : "outline"}
                  onClick={() => set("accountType", acct)}
                >
                  {ACCOUNT_LABELS[acct]}
                </Button>
              ))}
            </div>
          </div>
        );
      case "reinvestDividends":
        return (
          <div key={key} className="flex items-center gap-2">
            <Checkbox
              checked={strategy.reinvestDividends}
              onCheckedChange={(c) => set("reinvestDividends", c === true)}
            />
            <Label className="text-xs">Återinvestera utdelningar</Label>
          </div>
        );
      case "foreignWithholdingRate":
        return (
          <PctField key={key} label="Utländsk källskatt på utdelning (%)" value={strategy.foreignWithholdingRate} onChange={(v) => set("foreignWithholdingRate", v)} max={35} step={1} />
        );
      case "holdingsCount":
        return (
          <NumberField key={key} label="Antal innehav" value={strategy.holdingsCount} onChange={(v) => set("holdingsCount", Math.max(1, Math.round(v)))} min={1} max={100} />
        );
      case "courtageFlat":
        return (
          <NumberField key={key} label="Minimicourtage (kr/affär)" value={strategy.courtageFlat} onChange={(v) => set("courtageFlat", Math.max(0, v))} min={0} max={200} step={1} />
        );
      case "courtageRate":
        return (
          <PctField key={key} label="Courtage (% av affär)" value={strategy.courtageRate} onChange={(v) => set("courtageRate", v)} max={2} step={0.05} />
        );
      case "fxFeeRate":
        return (
          <PctField key={key} label="Valutaväxlingsavgift (%)" value={strategy.fxFeeRate} onChange={(v) => set("fxFeeRate", v)} max={2} step={0.05} />
        );
      case "rebalancesPerYear":
        return (
          <NumberField key={key} label="Ombalanseringar per år" value={strategy.rebalancesPerYear} onChange={(v) => set("rebalancesPerYear", Math.max(0, Math.round(v)))} min={0} max={12} />
        );
      case "turnoverShare":
        return (
          <PctField key={key} label="Omsatt andel per ombalansering (%)" value={strategy.turnoverShare} onChange={(v) => set("turnoverShare", v)} max={100} step={5} />
        );
      case "spreadRate":
        return (
          <PctField key={key} label="Spread (% per rundresa)" value={strategy.spreadRate} onChange={(v) => set("spreadRate", v)} max={2} step={0.05} />
        );
      case "startCapitalOverride":
        return (
          <NumberField key={key} label="Eget startkapital (kr)" value={strategy.startCapitalOverride ?? input.assumptions.startCapital} onChange={(v) => set("startCapitalOverride", Math.max(0, v))} min={0} max={100_000_000} step={10_000} />
        );
      case "monthlySavingsOverride":
        return (
          <NumberField key={key} label="Eget månadssparande (kr/mån)" value={strategy.monthlySavingsOverride ?? input.assumptions.monthlySavings} onChange={(v) => set("monthlySavingsOverride", Math.max(0, v))} min={0} max={1_000_000} step={500} />
        );
      case "savingsStartYear":
        return (
          <NumberField key={key} label="Börjar spara efter år" value={strategy.savingsStartYear ?? 0} onChange={(v) => set("savingsStartYear", Math.max(0, Math.round(v)))} min={0} max={40} />
        );
      case "leverageOfEquity":
        return (
          <PctField key={key} label="Belåning (% av eget kapital)" value={strategy.leverageOfEquity ?? 0} onChange={(v) => set("leverageOfEquity", v)} max={100} step={5} />
        );
      case "loanRate":
        return (
          <PctField key={key} label="Låneränta (%/år)" value={strategy.loanRate ?? 0} onChange={(v) => set("loanRate", v)} max={15} step={0.1} />
        );
      default:
        return null;
    }
  };

  const ALL_FIELDS: ReadonlyArray<keyof StrategyInput> = [
    "priceGrowth",
    "dividendYield",
    "fundFeeRate",
    "accountType",
    "reinvestDividends",
    "foreignWithholdingRate",
    "holdingsCount",
    "courtageFlat",
    "courtageRate",
    "fxFeeRate",
    "rebalancesPerYear",
    "turnoverShare",
    "spreadRate",
    "savingsStartYear",
    "leverageOfEquity",
    "loanRate",
    ...(template.lockDeposits
      ? []
      : (["startCapitalOverride", "monthlySavingsOverride"] as const)),
  ];
  const expanded = ALL_FIELDS.filter(isHi);
  const collapsed = ALL_FIELDS.filter((k) => !isHi(k));

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <input
          value={strategy.name}
          onChange={(e) => set("name", e.target.value)}
          className="w-full bg-transparent text-sm font-semibold outline-none"
          style={{ color: STRATEGY_COLORS[index % STRATEGY_COLORS.length] }}
          aria-label="Strateginamn"
        />
        {canRemove ? (
          <button type="button" onClick={remove} aria-label="Ta bort strategi">
            <XIcon className="size-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        ) : null}
      </div>
      {expanded.map(renderField)}
      {collapsed.length > 0 ? (
        <details className="pt-1">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Fler antaganden
          </summary>
          <div className="mt-2 space-y-3">{collapsed.map(renderField)}</div>
        </details>
      ) : null}
    </div>
  );
}
