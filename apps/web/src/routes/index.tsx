import { useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";

import { InputPanel } from "@/components/simulator/input-panel";
import { KpiRow } from "@/components/simulator/kpi-row";
import { simulationAtom } from "@/state/simulator";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const sim = useAtomValue(simulationAtom);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold">Sparstrategi-simulator</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <InputPanel />
        <div className="space-y-4">
          {sim.warnings.length > 0 ? (
            <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-300">
              <ul className="list-inside list-disc space-y-1">
                {sim.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <KpiRow />
          <div id="charts-slot" />
        </div>
      </div>
    </div>
  );
}
