import { useAtom } from "@effect/atom-react";
import { defaultStrategyInput } from "@sparstrategi/engine";
import { Button } from "@sparstrategi/ui/components/button";
import { BookmarkIcon, PlusIcon, Share2Icon } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { AssumptionsBar } from "@/components/jamfor/assumptions-bar";
import { GoalPanel } from "@/components/jamfor/goal-panel";
import { JamforChart } from "@/components/jamfor/jamfor-chart";
import { JamforKpis } from "@/components/jamfor/jamfor-kpis";
import { JamforTable } from "@/components/jamfor/jamfor-table";
import { StrategyColumn } from "@/components/jamfor/strategy-column";
import { useRoute } from "@/lib/router";
import { saveScenario } from "@/lib/saved";
import { templateById } from "@/lib/templates";
import {
  comparisonInputAtom,
  comparisonShareUrl,
  fromTemplate,
  serializeComparison,
} from "@/state/comparison";

export function JamforView() {
  const [input, setInput] = useAtom(comparisonInputAtom);
  const template = templateById(input.templateId);
  const route = useRoute();

  // App-genererade dela-länkar har alltid hash-id == payloadens templateId (se
  // `comparisonShareUrl`), så en `?j=`-payload skrivs aldrig över; endast
  // handredigerade URL:er med motstridigt hash-id nollställs till mallen.
  useEffect(() => {
    if (route.view !== "jamfor" || !route.templateId) return;
    const target = templateById(route.templateId).id;
    if (target !== input.templateId) setInput(fromTemplate(target));
  }, [route, input.templateId, setInput]);

  const handleShare = () => {
    navigator.clipboard
      .writeText(comparisonShareUrl(input))
      .then(() => toast.success("Länk kopierad"))
      .catch(() => toast.error("Kunde inte kopiera länken"));
  };

  const addStrategy = () =>
    setInput({
      ...input,
      strategies: [
        ...input.strategies,
        { ...defaultStrategyInput(`Strategi ${String.fromCharCode(65 + input.strategies.length)}`) },
      ],
    });

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{template.title}</h1>
          <p className="text-sm text-muted-foreground">{template.question}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const name = window.prompt("Namn på jämförelsen?", template.title);
              if (!name) return;
              saveScenario({
                name,
                kind: "jamfor",
                payload: serializeComparison(input),
                templateId: input.templateId,
              });
              toast.success("Jämförelse sparad — finns på startsidan");
            }}
          >
            <BookmarkIcon className="size-3.5" aria-hidden />
            Spara
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2Icon className="size-3.5" aria-hidden />
            Dela
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <AssumptionsBar lockDeposits={template.lockDeposits} />
        <div className="grid grid-cols-1 gap-4 md:grid-flow-col md:auto-cols-fr">
          {input.strategies.map((_, i) => (
            <StrategyColumn key={i} index={i} />
          ))}
        </div>
        {input.strategies.length < 3 ? (
          <Button type="button" variant="outline" size="sm" onClick={addStrategy}>
            <PlusIcon className="size-3.5" /> Lägg till strategi
          </Button>
        ) : null}
        <GoalPanel />
        <JamforKpis />
        <JamforChart />
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
            Varför blir det så här?
          </div>
          <p className="text-sm text-muted-foreground">{template.explainer}</p>
        </div>
        <JamforTable />
      </div>

      <footer className="mx-auto mt-10 max-w-7xl px-4 pb-6 text-xs text-muted-foreground">
        Fristående, uträkningarna körs helt i webbläsaren — inget sparas eller skickas till någon
        server. "Dela" kodar in dina värden i URL:en. Illustrativt räkneexempel, inte finansiell
        rådgivning.
      </footer>
    </div>
  );
}
