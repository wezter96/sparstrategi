import { useAtomValue } from "@effect/atom-react";

import { fmtKr, fmtPct } from "@/lib/format";
import { alt1WithdrawAtom, kapitalmotorInputAtom } from "@/state/kapitalmotor";

function Kpi(props: { label: string; value: string; note: string; tone?: "green" | "amber" }) {
  const toneClass =
    props.tone === "amber" ? "text-amber-400" : props.tone === "green" ? "text-emerald-400" : "";
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        {props.label}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${toneClass}`}>{props.value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{props.note}</div>
    </div>
  );
}

export function KapitalmotorKpiRow() {
  const input = useAtomValue(kapitalmotorInputAtom);
  const withdraw = useAtomValue(alt1WithdrawAtom);
  const y0 = withdraw.rows[0]!;
  const y1 = withdraw.rows[1];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi
        label="Startportfölj"
        value={fmtKr(y0.portfolio)}
        note={`${fmtKr(input.equity)} eget kapital + ${fmtKr(y0.loan)} lån`}
      />
      <Kpi
        label="Möjlig konsumtion, år 1"
        value={y1 ? fmtKr(y1.consumption / 12) + "/mån" : "–"}
        note="Växer varje år portföljen växer"
        tone="green"
      />
      <Kpi
        label="Effektiv skattesats"
        value={y1 ? fmtPct(y1.netTax / (y1.isk * input.expectedReturn)) : "0 %"}
        note="Ränteavdrag = ISK-schablonskatt"
        tone="green"
      />
      <Kpi
        label="Belåningsgrad"
        value={fmtPct(input.targetLtvOfEquity)}
        note="Av eget kapital · återställs varje år"
        tone="amber"
      />
    </div>
  );
}
