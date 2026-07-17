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

import { deflate } from "@/lib/deflate";
import { fmtKr } from "@/lib/format";
import {
  alt1ReinvestAtom,
  alt2ReinvestAtom,
  kapitalmotorInputAtom,
} from "@/state/kapitalmotor";

const COLORS = { alt1: "#34d399", alt2: "#fbbf24" } as const;

export function KapitalmotorComparisonChart() {
  const { inflation, showReal } = useAtomValue(kapitalmotorInputAtom);
  const alt1 = useAtomValue(alt1ReinvestAtom);
  const alt2 = useAtomValue(alt2ReinvestAtom);
  const adjust = (v: number, year: number) => (showReal ? deflate(v, year, inflation) : v);

  // Skuldfritt eget kapital (portfölj − lån): lånen är olika stora i
  // alternativen, så bruttoportföljer är inte jämförbara.
  const data = alt1.rows.map((row, idx) => ({
    year: row.year,
    alt1: adjust(row.equity, row.year),
    alt2: alt2.rows[idx] ? adjust(alt2.rows[idx]!.equity, row.year) : null,
  }));

  const last1 = alt1.rows.at(-1);
  const last2 = alt2.rows.at(-1);
  const diff =
    last1 && last2 ? adjust(last1.equity, last1.year) - adjust(last2.equity, last2.year) : 0;

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
        Alt 1 vs Alt 2 — allt återinvesteras
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Inga uttag i något alternativ — isolerar den rena skatteeffekten av kontostrukturen.
        Kurvorna visar skuldfritt eget kapital (portfölj minus lån)
        {showReal ? " i dagens penningvärde" : ""}.
      </p>
      <div className="h-[280px]">
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
              dataKey="alt1"
              name="Alt 1 · Uppdelad (AF+ISK)"
              stroke={COLORS.alt1}
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="alt2"
              name="Alt 2 · Allt på ISK"
              stroke={COLORS.alt2}
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {last1 && last2 ? (
        <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-2.5 text-xs text-emerald-300">
          Skillnad efter {last1.year} år: {fmtKr(diff)} mer eget kapital i Alt 1, enbart av
          skatteskäl. Obs: före latent AF-skatt — se skuldfritt realiserat nedan.
        </div>
      ) : null}
    </div>
  );
}
