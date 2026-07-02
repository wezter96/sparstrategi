import { useAtom, useAtomValue } from "@effect/atom-react";
import { Button } from "@sparstrategi/ui/components/button";
import { Input } from "@sparstrategi/ui/components/input";
import { Label } from "@sparstrategi/ui/components/label";
import { useState } from "react";
import type { Goal } from "@sparstrategi/engine";

import { fmtKr } from "@/lib/format";
import { goalResultsAtom, inputAtom } from "@/state/simulator";

type GoalType = Goal["type"];

function GoalForm() {
  const [input, setInput] = useAtom(inputAtom);
  const [type, setType] = useState<GoalType>("wealth");
  const [amount, setAmount] = useState(5_000_000);
  const [year, setYear] = useState(10);

  const addGoal = () => {
    const goal: Goal =
      type === "wealth"
        ? { type: "wealth", amount, year: Math.min(year, input.horizonYears) }
        : { type: "passiveIncome", monthlyAmount: amount };
    setInput({ ...input, goals: [...input.goals, goal] });
  };

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Måltyp</Label>
        <select
          className="h-8 rounded-none border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 dark:bg-input/30"
          value={type}
          onChange={(e) => setType(e.target.value as GoalType)}
        >
          <option value="wealth">Förmögenhetsmål</option>
          <option value="passiveIncome">Passiv inkomst</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          {type === "wealth" ? "Belopp (kr)" : "Belopp (kr/mån)"}
        </Label>
        <Input
          type="number"
          value={amount}
          min={0}
          step={type === "wealth" ? 100_000 : 1_000}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-32"
        />
      </div>
      {type === "wealth" ? (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">År</Label>
          <Input
            type="number"
            value={year}
            min={1}
            max={input.horizonYears}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-20"
          />
        </div>
      ) : null}
      <Button size="sm" onClick={addGoal}>
        Lägg till
      </Button>
    </div>
  );
}

export function GoalsPanel() {
  const [input, setInput] = useAtom(inputAtom);
  const goalResults = useAtomValue(goalResultsAtom);

  const removeGoal = (index: number) => {
    setInput({ ...input, goals: input.goals.filter((_, i) => i !== index) });
  };

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Mål</div>
      <div className="space-y-3">
        <GoalForm />
        {goalResults.length === 0 ? (
          <div className="text-sm text-muted-foreground">Inga mål tillagda ännu.</div>
        ) : (
          <div className="space-y-2">
            {goalResults.map((result, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="text-sm">
                  {result.type === "wealth" ? (
                    result.achieved ? (
                      <span className="text-emerald-400">
                        ✓ Uppnått år {result.hitYear}
                      </span>
                    ) : (
                      <div className="text-amber-400">
                        <div>✗ Saknas {fmtKr(result.shortfall)}</div>
                        <div className="text-xs text-muted-foreground">
                          {result.requiredMonthlySavings !== null
                            ? `kräver ${fmtKr(result.requiredMonthlySavings)}/mån extra`
                            : "onåbart inom taket"}
                        </div>
                      </div>
                    )
                  ) : (
                    <div>
                      <div className="text-foreground">
                        Kräver {fmtKr(result.requiredIskCapital)} i ISK-kapital
                      </div>
                      <div
                        className={`text-xs ${result.feasible ? "text-emerald-400" : "text-amber-400"}`}
                      >
                        {result.feasible
                          ? `möjligt från år ${result.feasibleYear}`
                          : "ej möjligt inom horisonten"}
                      </div>
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeGoal(i)}>
                  Ta bort
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
