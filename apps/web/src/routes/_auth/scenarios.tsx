import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@sparstrategi/ui/components/button";
import { Checkbox } from "@sparstrategi/ui/components/checkbox";
import { Skeleton } from "@sparstrategi/ui/components/skeleton";
import { AsyncResult } from "effect/unstable/reactivity";
import { useState } from "react";
import { toast } from "sonner";
import type { Scenario } from "@sparstrategi/contract";

import { CompareChart } from "@/components/scenarios/compare-chart";
import { removeScenarioAtom, scenariosAtom } from "@/lib/api-client";
import { inputAtom } from "@/state/simulator";

export const Route = createFileRoute("/_auth/scenarios")({
  component: ScenariosRoute,
});

function ScenariosRoute() {
  const result = useAtomValue(scenariosAtom);
  const setInput = useAtomSet(inputAtom);
  const removeScenario = useAtomSet(removeScenarioAtom, { mode: "promise" });
  const navigate = useNavigate();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [removingId, setRemovingId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const open = (scenario: Scenario) => {
    setInput(scenario.input);
    navigate({ to: "/" });
  };

  const remove = async (id: string) => {
    setRemovingId(id);
    try {
      await removeScenario({ params: { id }, reactivityKeys: ["scenarios"] });
      toast.success("Scenario borttaget");
    } catch {
      toast.error("Kunde inte ta bort scenario");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold">Scenarier</h1>

      {AsyncResult.isInitial(result) ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : AsyncResult.isFailure(result) ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Kunde inte hämta scenarier.
        </div>
      ) : (
        <>
          {result.value.length === 0 ? (
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              Inga sparade scenarier ännu. Gå till simulatorn och spara ett scenario.
            </div>
          ) : (
            <div className="space-y-2">
              {result.value.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selected.has(s.id)}
                      onCheckedChange={() => toggle(s.id)}
                      aria-label={`Jämför ${s.name}`}
                    />
                    <div>
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Uppdaterad{" "}
                        {new Date(s.updatedAt).toLocaleDateString("sv-SE", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => open(s)}>
                      Öppna
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={removingId === s.id}
                      onClick={() => remove(s.id)}
                    >
                      Ta bort
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selected.size >= 2 ? (
            <div className="mt-6">
              <CompareChart scenarios={result.value.filter((s) => selected.has(s.id))} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
