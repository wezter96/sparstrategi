import { useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@sparstrategi/ui/components/button";
import { Share2Icon } from "lucide-react";
import { toast } from "sonner";

import { AllocationChart } from "@/components/simulator/allocation-chart";
import { CashflowCard } from "@/components/simulator/cashflow-card";
import { InputPanel } from "@/components/simulator/input-panel";
import { KpiRow } from "@/components/simulator/kpi-row";
import { ProjectionChart } from "@/components/simulator/projection-chart";
import { ProjectionTable } from "@/components/simulator/projection-table";
import { TaxCard } from "@/components/simulator/tax-card";
import { inputAtom, shareUrl, simulationAtom } from "@/state/simulator";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const sim = useAtomValue(simulationAtom);
  const input = useAtomValue(inputAtom);

  const handleShare = () => {
    const url = shareUrl(input);
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Länk kopierad"))
      .catch(() => toast.error("Kunde inte kopiera länken"));
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sparstrategi-simulator</h1>
        <Button variant="outline" size="sm" onClick={handleShare}>
          <Share2Icon className="size-3.5" />
          Dela
        </Button>
      </div>
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <AllocationChart />
            <CashflowCard />
          </div>
          <ProjectionChart />
          <ProjectionTable />
          <TaxCard />
        </div>
      </div>
    </div>
  );
}
