import { useAtomValue } from "@effect/atom-react";
import { Button } from "@sparstrategi/ui/components/button";
import { Toaster } from "@sparstrategi/ui/components/sonner";
import { Share2Icon } from "lucide-react";
import { toast } from "sonner";

import { KapitalmotorComparisonChart } from "@/components/kapitalmotor/comparison-chart";
import { KapitalmotorHoldingCard } from "@/components/kapitalmotor/holding-card";
import { KapitalmotorInputPanel } from "@/components/kapitalmotor/input-panel";
import { KapitalmotorKpiRow } from "@/components/kapitalmotor/kpi-row";
import { KapitalmotorRealizedChart } from "@/components/kapitalmotor/realized-chart";
import { KapitalmotorTable } from "@/components/kapitalmotor/table";
import { ThemeProvider } from "@/components/theme-provider";
import { kapitalmotorInputAtom, kapitalmotorShareUrl } from "@/state/kapitalmotor";

function KapitalmotorPage() {
  const input = useAtomValue(kapitalmotorInputAtom);

  const handleShare = () => {
    const url = kapitalmotorShareUrl(input);
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Länk kopierad"))
      .catch(() => toast.error("Kunde inte kopiera länken"));
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Belånad Kapitalmotor</h1>
          <p className="text-sm text-muted-foreground">
            AF/ISK-uppdelning, belåning och holdingbolag — jämför strategier, dela resultatet.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleShare}>
          <Share2Icon className="size-3.5" />
          Dela
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <KapitalmotorInputPanel />
        <div className="space-y-4">
          <KapitalmotorKpiRow />
          <KapitalmotorTable />
          <KapitalmotorComparisonChart />
          <KapitalmotorRealizedChart />
          <KapitalmotorHoldingCard />
        </div>
      </div>
      <footer className="mx-auto mt-10 max-w-7xl px-4 pb-6 text-xs text-muted-foreground">
        Fristående, uträkningarna körs helt i webbläsaren — inget sparas eller skickas till någon
        server. "Dela" kodar in dina värden i URL:en. Illustrativt räkneexempel, inte finansiell
        rådgivning.
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      disableTransitionOnChange
      storageKey="vite-ui-theme"
    >
      <KapitalmotorPage />
      <Toaster richColors />
    </ThemeProvider>
  );
}
