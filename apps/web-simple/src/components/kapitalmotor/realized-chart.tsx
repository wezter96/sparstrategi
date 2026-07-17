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
import { kapitalmotorInputAtom, longHorizonAtom } from "@/state/kapitalmotor";

const COLORS = { book: "#6c8cff", realized: "#34d399", alt2: "#fbbf24" } as const;

export function KapitalmotorRealizedChart() {
  const { inflation, showReal } = useAtomValue(kapitalmotorInputAtom);
  const { alt1, alt2 } = useAtomValue(longHorizonAtom);
  const adjust = (v: number, year: number) => (showReal ? deflate(v, year, inflation) : v);

  // Allt skuldfritt (netto eget lån): alternativen bär olika stora lån, så
  // bruttoportföljer är inte jämförbara — Alt 1:s lån växer snabbare.
  const data = alt1.rows.map((row, idx) => ({
    year: row.year,
    book: adjust(row.equity, row.year),
    realized: adjust(row.debtFreeNetWorth, row.year),
    alt2: alt2.rows[idx] ? adjust(alt2.rows[idx]!.debtFreeNetWorth, row.year) : null,
  }));

  let crossoverYear: number | null = null;
  for (let idx = 1; idx < alt1.rows.length; idx++) {
    const diff = alt1.rows[idx]!.debtFreeNetWorth - (alt2.rows[idx]?.debtFreeNetWorth ?? 0);
    const prevDiff =
      alt1.rows[idx - 1]!.debtFreeNetWorth - (alt2.rows[idx - 1]?.debtFreeNetWorth ?? 0);
    if (prevDiff < 0 && diff >= 0) {
      crossoverYear = idx;
      break;
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
        Vad Alt 1 egentligen är värt — skuldfritt nettovärde
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Alla kurvor visar pengar i handen om lånet löses samma år: portfölj − lån, och för
        "realiserat" även − 30% skatt på AF-vinsten (AF beskattas bara vid försäljning).
        Lånen är olika stora i alternativen, så bruttoportföljer vore inte jämförbara.
        100 år, logaritmisk skala.
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
              name="Alt 1 · skuldfritt bokfört (aldrig sälj)"
              stroke={COLORS.book}
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="realized"
              name="Alt 1 · skuldfritt realiserat (−lån, −skatt på vinsten)"
              stroke={COLORS.realized}
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="alt2"
              name="Alt 2 · allt på ISK, skuldfritt (−lån)"
              stroke={COLORS.alt2}
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {crossoverYear ? (
        <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-2.5 text-xs text-amber-300">
          Brytpunkt ≈ år {crossoverYear}: före det ger Alt 2 (allt på ISK) mer pengar i handen
          om allt likvideras och lånet löses. Uppskjuten skatt lönar sig först på lång sikt.
        </div>
      ) : null}
    </div>
  );
}
