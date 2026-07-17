import { useAtom, useAtomValue } from "@effect/atom-react";
import { Checkbox } from "@sparstrategi/ui/components/checkbox";
import { Label } from "@sparstrategi/ui/components/label";
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

import { PctField } from "@/components/pct-field";
import { deflate } from "@/lib/deflate";
import { fmtKr } from "@/lib/format";
import {
  comparisonInputAtom,
  comparisonMonteCarloAtom,
  comparisonResultsAtom,
} from "@/state/comparison";

export const STRATEGY_COLORS = ["#34d399", "#fbbf24", "#60a5fa"] as const;

export function JamforChart() {
  const [input, setInput] = useAtom(comparisonInputAtom);
  const results = useAtomValue(comparisonResultsAtom);
  const mc = useAtomValue(comparisonMonteCarloAtom);
  if (results.length === 0) return null;

  const { inflation, showReal } = input.display;
  const adjust = (v: number, year: number) => (showReal ? deflate(v, year, inflation) : v);

  const data = results[0]!.rows.map((row, idx) => {
    const point: Record<string, number | [number, number]> = { year: row.year };
    results.forEach((r, i) => {
      point[`s${i}`] = adjust(r.rows[idx]?.value ?? 0, row.year);
      const band = mc?.[i]?.years[idx];
      if (band) {
        point[`b${i}`] = [adjust(band.p10, row.year), adjust(band.p90, row.year)];
      }
    });
    return point;
  });

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Värdeutveckling{showReal ? " — dagens penningvärde" : ""}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-uncertainty"
              checked={input.uncertainty.enabled}
              onCheckedChange={(c) =>
                setInput({
                  ...input,
                  uncertainty: { ...input.uncertainty, enabled: c === true },
                })
              }
            />
            <Label htmlFor="show-uncertainty" className="text-xs">
              Visa osäkerhet (Monte Carlo, p10–p90)
            </Label>
          </div>
          {input.uncertainty.enabled ? (
            <div className="w-36">
              <PctField
                label="Volatilitet (%/år)"
                value={input.uncertainty.volatility}
                onChange={(v) =>
                  setInput({
                    ...input,
                    uncertainty: { ...input.uncertainty, volatility: Math.max(0, v) },
                  })
                }
                max={60}
                step={1}
              />
            </div>
          ) : null}
        </div>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
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
              formatter={(value: unknown, name: unknown) => {
                if (Array.isArray(value)) {
                  return [`${fmtKr(Number(value[0]))} – ${fmtKr(Number(value[1]))}`, String(name)];
                }
                return [fmtKr(Number(value)), String(name)];
              }}
              labelFormatter={(l) => `År ${l}`}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
            {mc
              ? results.map((r, i) => (
                  <Area
                    key={`band-${r.name}${i}`}
                    dataKey={`b${i}`}
                    name={`${r.name} p10–p90`}
                    stroke="none"
                    fill={STRATEGY_COLORS[i % STRATEGY_COLORS.length]}
                    fillOpacity={0.12}
                    legendType="none"
                    activeDot={false}
                  />
                ))
              : null}
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
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {mc ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Bandet visar var 10:e till 90:e percentilen av utfall hamnar vid{" "}
          {(input.uncertainty.volatility * 100).toFixed(0)} % årlig volatilitet — full skatte- och
          avgiftslogik per simulerad bana, samma mått som linjen (värde före realisation). Linjen
          är det deterministiska scenariot.
        </p>
      ) : null}
    </div>
  );
}
