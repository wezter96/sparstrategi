import { useAtomValue } from "@effect/atom-react";

import { fmtKr, fmtPct } from "@/lib/format";
import { simulationAtom } from "@/state/simulator";

const columns = [
  { key: "year", label: "År" },
  { key: "portfolio", label: "Portfölj" },
  { key: "af", label: "AF" },
  { key: "isk", label: "ISK" },
  { key: "growth", label: "Tillväxt" },
  { key: "loan", label: "Lån" },
  { key: "ltv", label: "Belåning" },
  { key: "interest", label: "Ränta" },
  { key: "deduction", label: "Avdrag" },
  { key: "netTax", label: "Skatt" },
  { key: "effectiveTaxRate", label: "Eff. skatt" },
] as const;

export function ProjectionTable() {
  const sim = useAtomValue(simulationAtom);
  const rows = sim.rows;

  if (rows.length < 2) return null;

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
        Årsvis utveckling
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              {columns.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-2 py-1.5 font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year} className="border-b border-border/50 last:border-0">
                <td className="px-2 py-1.5 tabular-nums">{row.year}</td>
                <td className="px-2 py-1.5 tabular-nums">{fmtKr(row.portfolio)}</td>
                <td className="px-2 py-1.5 tabular-nums text-emerald-400">{fmtKr(row.af)}</td>
                <td className="px-2 py-1.5 tabular-nums text-indigo-400">{fmtKr(row.isk)}</td>
                <td className="px-2 py-1.5 tabular-nums">{fmtKr(row.growth)}</td>
                <td className="px-2 py-1.5 tabular-nums text-amber-400">{fmtKr(row.loan)}</td>
                <td className="px-2 py-1.5 tabular-nums">{fmtPct(row.ltv)}</td>
                <td className="px-2 py-1.5 tabular-nums">{fmtKr(row.interest)}</td>
                <td className="px-2 py-1.5 tabular-nums text-emerald-400">
                  {fmtKr(row.deduction)}
                </td>
                <td className="px-2 py-1.5 tabular-nums">{fmtKr(row.netTax)}</td>
                <td
                  className={`px-2 py-1.5 tabular-nums ${
                    row.netTax === 0 ? "bg-emerald-400/10 font-medium text-emerald-400" : ""
                  }`}
                >
                  {fmtPct(row.effectiveTaxRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
