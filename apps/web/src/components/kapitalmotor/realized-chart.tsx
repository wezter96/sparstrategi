import { useAtomValue } from "@effect/atom-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { fmtKr } from "@/lib/format";
import { longHorizonAtom } from "@/state/kapitalmotor";

const COLORS = { book: "#6c8cff", realized: "#34d399", alt2: "#fbbf24" } as const;

export function KapitalmotorRealizedChart() {
  const { alt1, alt2 } = useAtomValue(longHorizonAtom);

  const data = alt1.rows.map((row, idx) => ({
    year: row.year,
    book: row.portfolio,
    realized: row.realizedNetWorth,
    alt2: alt2.rows[idx]?.portfolio ?? null,
  }));

  let crossoverYear: number | null = null;
  for (let idx = 1; idx < alt1.rows.length; idx++) {
    const diff = alt1.rows[idx]!.realizedNetWorth - (alt2.rows[idx]?.portfolio ?? 0);
    const prevDiff = alt1.rows[idx - 1]!.realizedNetWorth - (alt2.rows[idx - 1]?.portfolio ?? 0);
    if (prevDiff < 0 && diff >= 0) {
      crossoverYear = idx;
      break;
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
        Vad Alt 1 egentligen är värt — den uppskjutna skatten
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        AF-kontot beskattas bara vid försäljning (30% på vinsten). "Realiserat netto" visar vad
        det vore värt om det såldes det året, i stället för att aldrig säljas. 100 år,
        logaritmisk skala.
      </p>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="year"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              scale="log"
              domain={["auto", "auto"]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickFormatter={(v: number) => fmtKr(v)}
              width={72}
            />
            <Tooltip
              formatter={(value: unknown, name: unknown) => [fmtKr(Number(value)), String(name)]}
              labelFormatter={(l) => `År ${l}`}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
            <Line
              type="monotone"
              dataKey="book"
              name="Alt 1 · bokfört (aldrig sälj)"
              stroke={COLORS.book}
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="realized"
              name="Alt 1 · realiserat netto (−skatt på vinsten)"
              stroke={COLORS.realized}
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="alt2"
              name="Alt 2 · allt på ISK"
              stroke={COLORS.alt2}
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {crossoverYear ? (
        <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-2.5 text-xs text-amber-300">
          Brytpunkt ≈ år {crossoverYear}: före det skulle Alt 2 (allt på ISK) faktiskt ge mer
          pengar i handen om AF-kontot löstes in. Uppskjuten skatt lönar sig först på lång sikt.
        </div>
      ) : null}
    </div>
  );
}
