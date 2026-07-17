import { useAtomValue } from "@effect/atom-react";

import { deflate } from "@/lib/deflate";
import { fmtKr, fmtPct } from "@/lib/format";
import { alt1WithdrawAtom, kapitalmotorInputAtom } from "@/state/kapitalmotor";

export function KapitalmotorTable() {
  const { inflation, showReal } = useAtomValue(kapitalmotorInputAtom);
  const result = useAtomValue(alt1WithdrawAtom);
  const kr = (v: number, year: number) =>
    fmtKr(showReal ? deflate(v, year, inflation) : v);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
        Tillväxt över tid{showReal ? " — dagens penningvärde" : ""}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Varje rad visar läget vid slutet av respektive år, innan det årets återbelåning — Ränta,
        Ränteavdrag och Lån avser vad som faktiskt gällde under året. Belåning driftar därför ned
        mot ~18,5% här och återställs till målnivån mellan raderna (se grafen ovan).
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pr-3">År</th>
              <th className="py-2 pr-3 text-right">Portfölj</th>
              <th className="py-2 pr-3 text-right">AF</th>
              <th className="py-2 pr-3 text-right">ISK</th>
              <th className="py-2 pr-3 text-right">Lån</th>
              <th className="py-2 pr-3 text-right">Belåning</th>
              <th className="py-2 pr-3 text-right">Ränta</th>
              <th className="py-2 pr-3 text-right">Ränteavdrag</th>
              <th className="py-2 pr-3 text-right">Konsumtion</th>
              <th className="py-2 pr-3 text-right">Eff. skatt</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {result.rows.map((row) => (
              <tr key={row.year} className="border-b border-border/50">
                <td className="py-1.5 pr-3 font-medium">{row.year === 0 ? "Start" : row.year}</td>
                <td className="py-1.5 pr-3 text-right">{kr(row.portfolio, row.year)}</td>
                <td className="py-1.5 pr-3 text-right text-emerald-400">{kr(row.af, row.year)}</td>
                <td className="py-1.5 pr-3 text-right text-indigo-400">{kr(row.isk, row.year)}</td>
                <td className="py-1.5 pr-3 text-right">{kr(row.loan, row.year)}</td>
                <td className="py-1.5 pr-3 text-right">{fmtPct(row.ltvOfEquity)}</td>
                <td className="py-1.5 pr-3 text-right text-amber-400">
                  {row.year === 0 ? "–" : `− ${kr(row.interest, row.year)}`}
                </td>
                <td className="py-1.5 pr-3 text-right text-emerald-400">
                  {row.year === 0 ? "–" : `+ ${kr(row.deduction, row.year)}`}
                </td>
                <td className="py-1.5 pr-3 text-right">
                  {row.year === 0 ? "–" : kr(row.consumption, row.year)}
                </td>
                <td className="py-1.5 pr-3 text-right text-emerald-400">
                  {row.year === 0 ? "–" : fmtPct(row.netTax > 0 ? row.effectiveTaxRate : 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
