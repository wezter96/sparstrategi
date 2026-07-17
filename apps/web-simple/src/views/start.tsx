import { navigate } from "@/lib/router";
import { templates } from "@/lib/templates";

export function StartView() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Sparstrategi</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">
        Jämför sparstrategier sida vid sida — avgifter, sparformer, utdelningar och
        transaktionskostnader. Allt räknas i webbläsaren, inget sparas.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => navigate("jamfor", t.id)}
            className="rounded-xl border bg-card p-5 text-left transition-colors hover:border-emerald-400/50"
          >
            <div className="text-sm font-semibold">{t.title}</div>
            <p className="mt-1 text-xs text-muted-foreground">{t.question}</p>
          </button>
        ))}
        <button
          type="button"
          onClick={() => navigate("kapitalmotor")}
          className="rounded-xl border border-dashed bg-card p-5 text-left transition-colors hover:border-emerald-400/50"
        >
          <div className="text-sm font-semibold">Belånad Kapitalmotor</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Avancerat: belåning, AF/ISK-kalibrering, Kelly, Monte Carlo och holdingbolag.
          </p>
        </button>
      </div>
      <footer className="mt-10 text-xs text-muted-foreground">
        Illustrativa räkneexempel, inte finansiell rådgivning.
      </footer>
    </div>
  );
}
