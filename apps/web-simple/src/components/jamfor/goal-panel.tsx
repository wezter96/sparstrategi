import { useAtom, useAtomValue } from "@effect/atom-react";
import { Checkbox } from "@sparstrategi/ui/components/checkbox";
import { Label } from "@sparstrategi/ui/components/label";
import { NumberField } from "@sparstrategi/ui/components/number-field";

import { STRATEGY_COLORS } from "@/components/jamfor/jamfor-chart";
import { fmtKr } from "@/lib/format";
import { comparisonGoalAtom, comparisonInputAtom } from "@/state/comparison";

export function GoalPanel() {
  const [input, setInput] = useAtom(comparisonInputAtom);
  const results = useAtomValue(comparisonGoalAtom);
  const targetYear = input.goal.year > 0 ? input.goal.year : input.assumptions.horizonYears;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Checkbox
          id="goal-enabled"
          checked={input.goal.enabled}
          onCheckedChange={(c) =>
            setInput({ ...input, goal: { ...input.goal, enabled: c === true } })
          }
        />
        <Label htmlFor="goal-enabled" className="text-xs uppercase tracking-wider">
          Sparmål
        </Label>
      </div>
      {input.goal.enabled ? (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumberField
              label="Målbelopp (kr)"
              value={input.goal.amount}
              onChange={(v) => setInput({ ...input, goal: { ...input.goal, amount: Math.max(0, v) } })}
              min={0}
              max={1_000_000_000}
              step={100_000}
            />
            <NumberField
              label="Målår (0 = horisontens slut)"
              value={input.goal.year}
              onChange={(v) =>
                setInput({
                  ...input,
                  goal: { ...input.goal, year: Math.min(50, Math.max(0, Math.round(v))) },
                })
              }
              min={0}
              max={50}
            />
          </div>
          {results ? (
            <ul className="space-y-1.5 text-xs">
              {results.map((r, i) => (
                <li key={r.name + i} className="flex flex-wrap items-baseline gap-x-2">
                  <span
                    className="font-semibold"
                    style={{ color: STRATEGY_COLORS[i % STRATEGY_COLORS.length] }}
                  >
                    {r.name}:
                  </span>
                  {r.hitYear !== null && r.hitYear <= targetYear ? (
                    <span>
                      målet nås år {r.hitYear} — {fmtKr(r.valueAtTargetYear)} vid år {targetYear}.
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      nås inte till år {targetYear} ({fmtKr(r.valueAtTargetYear)}, saknas{" "}
                      {fmtKr(r.shortfall)}).{" "}
                      {r.requiredMonthlySavings !== null
                        ? `Kräver ca ${fmtKr(r.requiredMonthlySavings)}/mån.`
                        : "Onåbart även med kraftigt höjt sparande."}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            Målet utvärderas mot värdet efter skatt vid försäljning (nominellt), så AF:s latenta
            skatt räknas in.
          </p>
        </div>
      ) : null}
    </div>
  );
}
