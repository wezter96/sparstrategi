import { useAtomValue } from "@effect/atom-react";

import { STRATEGY_COLORS } from "@/components/jamfor/jamfor-chart";
import { fmtKr } from "@/lib/format";
import { comparisonResultsAtom } from "@/state/comparison";

export function JamforTable() {
  const results = useAtomValue(comparisonResultsAtom);
  if (results.length === 0) return null;

  return (
    <details className="rounded-xl border bg-card p-5">
      <summary className="cursor-pointer text-xs uppercase tracking-wider text-muted-foreground">
        Tabell per år
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-1.5 pr-2 text-left font-normal">År</th>
              {results.map((r, i) => (
                <th
                  key={r.name + i}
                  className="py-1.5 pl-3 font-normal"
                  style={{ color: STRATEGY_COLORS[i % STRATEGY_COLORS.length] }}
                >
                  {r.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results[0]!.rows.map((row, idx) => (
              <tr key={row.year} className="border-b border-border/40">
                <td className="py-1 pr-2 text-left">{row.year}</td>
                {results.map((r, i) => (
                  <td key={i} className="py-1 pl-3">
                    {fmtKr(r.rows[idx]?.value ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
