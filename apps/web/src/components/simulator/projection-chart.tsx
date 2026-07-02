import { useAtomValue } from "@effect/atom-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { fmtKr } from "@/lib/format";
import { simulationAtom } from "@/state/simulator";

const COLORS = {
  total: "#6c8cff",
  af: "#34d399",
  isk: "#818cf8",
  loan: "#fbbf24",
} as const;

const SERIES_LABEL: Record<string, string> = {
  portfolio: "Total portfölj",
  af: "AF",
  isk: "ISK",
  loan: "Lån",
};

function ProjectionTooltip({
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
            <span className="text-muted-foreground">{SERIES_LABEL[p.dataKey] ?? p.dataKey}</span>
            <span className="ml-auto font-medium text-foreground">{fmtKr(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProjectionChart() {
  const sim = useAtomValue(simulationAtom);
  const rows = sim.rows;

  if (rows.length < 2) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        För kort horisont för att visa en prognos.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Prognos</div>
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows as unknown as Record<string, number>[]}>
            <defs>
              <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.total} stopOpacity={0.08} />
                <stop offset="100%" stopColor={COLORS.total} stopOpacity={0} />
              </linearGradient>
            </defs>
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
            <Tooltip content={<ProjectionTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
              formatter={(value: string) => SERIES_LABEL[value] ?? value}
            />
            <Area
              type="monotone"
              dataKey="portfolio"
              name="portfolio"
              stroke={COLORS.total}
              strokeWidth={2}
              fill="url(#portfolioFill)"
            />
            <Line
              type="monotone"
              dataKey="af"
              name="af"
              stroke={COLORS.af}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="isk"
              name="isk"
              stroke={COLORS.isk}
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="loan"
              name="loan"
              stroke={COLORS.loan}
              strokeWidth={1}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
