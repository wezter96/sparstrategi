import { useAtomValue } from "@effect/atom-react";
import { Button } from "@sparstrategi/ui/components/button";
import { DownloadIcon } from "lucide-react";

import { STRATEGY_COLORS } from "@/components/jamfor/jamfor-chart";
import { deflate } from "@/lib/deflate";
import { fmtKr } from "@/lib/format";
import { comparisonInputAtom, comparisonResultsAtom } from "@/state/comparison";

export function JamforTable() {
  const input = useAtomValue(comparisonInputAtom);
  const results = useAtomValue(comparisonResultsAtom);
  if (results.length === 0) return null;

  const { inflation, showReal } = input.display;
  const adjust = (v: number, year: number) => (showReal ? deflate(v, year, inflation) : v);

  const exportCsv = () => {
    const sep = ";";
    const header = ["År", ...results.map((r) => r.name)].join(sep);
    const lines = results[0]!.rows.map((row, idx) =>
      [
        row.year,
        ...results.map((r) => Math.round(adjust(r.rows[idx]?.value ?? 0, row.year))),
      ].join(sep),
    );
    const csv = `${header}\n${lines.join("\n")}`;
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sparstrategi-${input.templateId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <details className="rounded-xl border bg-card p-5">
      <summary className="cursor-pointer text-xs uppercase tracking-wider text-muted-foreground">
        Tabell per år{showReal ? " — dagens penningvärde" : ""}
      </summary>
      <div className="mt-3 flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
          <DownloadIcon className="size-3.5" aria-hidden />
          Exportera CSV
        </Button>
      </div>
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
                    {fmtKr(adjust(r.rows[idx]?.value ?? 0, row.year))}
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
