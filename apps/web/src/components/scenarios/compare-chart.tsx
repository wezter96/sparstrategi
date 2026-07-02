import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { simulate } from "@sparstrategi/engine";
import type { Scenario } from "@sparstrategi/contract";

import { fmtKr } from "@/lib/format";

const COLORS = ["#6c8cff", "#34d399", "#fbbf24", "#f87171", "#818cf8"] as const;

function CompareTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: number | string;
  payload?: ReadonlyArray<{ dataKey: string; value: number; color: string }>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium text-popover-foreground">År {label}</div>
      <div className="space-y-0.5">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center gap-2 tabular-nums">
            <span
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            <span className="text-muted-foreground">{p.dataKey}</span>
            <span className="ml-auto font-medium text-foreground">{fmtKr(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompareChart({ scenarios }: { scenarios: ReadonlyArray<Scenario> }) {
  const results = scenarios.map((scenario) => ({ scenario, sim: simulate(scenario.input) }));

  const maxYear = Math.max(
    0,
    ...results.map((r) => r.sim.rows[r.sim.rows.length - 1]?.year ?? 0),
  );

  const data: Array<Record<string, number>> = Array.from({ length: maxYear + 1 }, (_, year) => {
    const row: Record<string, number> = { year };
    for (const { scenario, sim } of results) {
      const yearRow = sim.rows.find((r) => r.year === year);
      if (yearRow) row[scenario.name] = yearRow.equity;
    }
    return row;
  });

  const goalLines = results.flatMap(({ scenario }) =>
    scenario.input.goals
      .filter((g) => g.type === "wealth")
      .map((g) => ({ key: `${scenario.id}-${g.amount}-${g.year}`, amount: g.amount })),
  );

  if (results.length < 2) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        Välj minst två scenarier för att jämföra.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
        Jämförelse
      </div>
      <div className="h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="year"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickFormatter={(v: number) => `${v}`}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickFormatter={(v: number) => fmtKr(v)}
              width={72}
            />
            <Tooltip content={<CompareTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
            {results.map(({ scenario }, i) => (
              <Line
                key={scenario.id}
                type="monotone"
                dataKey={scenario.name}
                name={scenario.name}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
            {goalLines.map((g) => (
              <ReferenceLine
                key={g.key}
                y={g.amount}
                stroke="#f87171"
                strokeDasharray="4 4"
                label={{
                  value: fmtKr(g.amount),
                  position: "right",
                  fill: "var(--muted-foreground)",
                  fontSize: 10,
                }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
