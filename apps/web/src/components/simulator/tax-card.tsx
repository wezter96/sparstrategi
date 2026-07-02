import { useAtomValue } from "@effect/atom-react";

import { fmtKr } from "@/lib/format";
import { simulationAtom } from "@/state/simulator";

function TaxRow(props: { label: string; value: string; tone?: "amber" | "green"; bold?: boolean }) {
  const toneClass =
    props.tone === "amber" ? "text-amber-400" : props.tone === "green" ? "text-emerald-400" : "";
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={`text-sm ${props.bold ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
        {props.label}
      </span>
      <span className={`tabular-nums text-sm ${props.bold ? "font-semibold" : ""} ${toneClass}`}>
        {props.value}
      </span>
    </div>
  );
}

export function TaxCard() {
  const sim = useAtomValue(simulationAtom);
  const y1 = sim.rows[1];
  if (!y1) return null;

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
        Skatteanalys, år 1
      </div>
      <div className="divide-y divide-border/50">
        <TaxRow label="ISK-schablonskatt" value={`− ${fmtKr(y1.iskTax)}`} tone="amber" />
        <TaxRow label="Ränteavdrag" value={`+ ${fmtKr(y1.deduction)}`} tone="green" />
        <TaxRow label="Netto skattekostnad" value={fmtKr(y1.netTax)} bold />
        {y1.excessReduction > 0 ? (
          <TaxRow
            label="Överskjutande skattereduktion"
            value={fmtKr(y1.excessReduction)}
            tone="green"
          />
        ) : null}
        <TaxRow
          label="Latent skatt AF (vid försäljning)"
          value={`− ${fmtKr(y1.afLatentTax)}`}
          tone="amber"
        />
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        Realiseras först vid försäljning — ingår ej i årets skatt
      </div>
      {y1.netTax === 0 ? (
        <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-2.5 text-xs text-emerald-300">
          ISK-schablonskatten nollställs av ränteavdraget.
        </div>
      ) : null}
    </div>
  );
}
