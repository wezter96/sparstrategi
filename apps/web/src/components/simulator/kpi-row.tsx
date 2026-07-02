import { useAtomValue } from "@effect/atom-react";

import { fmtKr, fmtPct } from "@/lib/format";
import { simulationAtom } from "@/state/simulator";

function Kpi(props: {
  label: string;
  value: string;
  note?: string;
  tone?: "green" | "amber" | "accent";
}) {
  const toneClass =
    props.tone === "green"
      ? "text-emerald-400"
      : props.tone === "amber"
        ? "text-amber-400"
        : props.tone === "accent"
          ? "text-indigo-400"
          : "";
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{props.label}</div>
      <div className={`text-2xl font-bold ${toneClass}`}>{props.value}</div>
      {props.note ? <div className="mt-1 text-xs text-muted-foreground">{props.note}</div> : null}
    </div>
  );
}

export function KpiRow() {
  const sim = useAtomValue(simulationAtom);
  const y1 = sim.rows[1];
  const last = sim.rows.at(-1);
  if (!y1 || !last) return null;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Kpi
        label="Total portfölj"
        value={fmtKr(sim.calibration.initialPortfolio)}
        tone="accent"
        note={`Lån ${fmtKr(sim.calibration.initialLoan)}`}
      />
      <Kpi label="Tillväxt år 1" value={fmtKr(y1.growth)} tone="green" />
      <Kpi
        label="Effektiv skatt år 1"
        value={fmtPct(y1.effectiveTaxRate)}
        tone={y1.effectiveTaxRate === 0 ? "green" : "amber"}
      />
      <Kpi
        label={`Förmögenhet år ${last.year}`}
        value={fmtKr(last.equity)}
        tone="green"
        note={`Belåningsgrad ${fmtPct(last.ltv)} · efter latent skatt: ${fmtKr(last.equityAfterLatentTax)}`}
      />
    </div>
  );
}
