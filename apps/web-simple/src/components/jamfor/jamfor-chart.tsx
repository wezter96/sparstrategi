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
import { comparisonResultsAtom } from "@/state/comparison";

export const STRATEGY_COLORS = ["#34d399", "#fbbf24", "#60a5fa"] as const;

export function JamforChart() {
  const results = useAtomValue(comparisonResultsAtom);
  if (results.length === 0) return null;

  const data = results[0]!.rows.map((row, idx) => {
    const point: Record<string, number> = { year: row.year };
    results.forEach((r, i) => {
      point[`s${i}`] = r.rows[idx]?.value ?? 0;
    });
    return point;
  });

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
        Värdeutveckling
      </div>
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
            {results.map((r, i) => (
              <Line
                key={r.name + i}
                type="monotone"
                dataKey={`s${i}`}
                name={r.name}
                stroke={STRATEGY_COLORS[i % STRATEGY_COLORS.length]}
                strokeWidth={2.5}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
