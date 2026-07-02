import { useAtom, useAtomValue } from "@effect/atom-react";
import { Button } from "@sparstrategi/ui/components/button";
import { Label } from "@sparstrategi/ui/components/label";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { fmtKr, fmtPct } from "@/lib/format";
import { inputAtom, simulationAtom, stressResultAtom, stressSettingsAtom } from "@/state/simulator";

const COLORS = {
  base: "#6c8cff",
  stressed: "#f87171",
} as const;

const CRASH_OPTIONS = [
  { label: "−20%", value: 0.2 },
  { label: "−30%", value: 0.3 },
  { label: "−40%", value: 0.4 },
] as const;

const SERIES_LABEL: Record<string, string> = {
  base: "Bas",
  stressed: "Stressat",
};

function StressTooltip({
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

export function StressPanel() {
  const input = useAtomValue(inputAtom);
  const [settings, setSettings] = useAtom(stressSettingsAtom);
  const stressResult = useAtomValue(stressResultAtom);
  const sim = useAtomValue(simulationAtom);

  const crashYear = settings?.crashYear ?? 1;

  const setCrashPct = (crashPct: number) => setSettings({ crashPct, crashYear });
  const setCrashYear = (year: number) =>
    setSettings(settings ? { ...settings, crashYear: year } : null);

  const chartData =
    stressResult &&
    sim.rows.map((row) => ({
      year: row.year,
      base: row.equity,
      stressed: stressResult.rows.find((r) => r.year === row.year)?.equity ?? null,
    }));

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
        Krasch-test
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Kraschstorlek</Label>
          <div className="flex gap-1">
            {CRASH_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={settings?.crashPct === opt.value ? "default" : "outline"}
                onClick={() => setCrashPct(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">År</Label>
          <select
            className="h-8 rounded-none border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 dark:bg-input/30"
            value={crashYear}
            disabled={!settings}
            onChange={(e) => setCrashYear(Number(e.target.value))}
          >
            {Array.from({ length: input.horizonYears }, (_, i) => i + 1).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setSettings(null)}>
          Återställ
        </Button>
      </div>

      {stressResult ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">LTV efter krasch: </span>
              <span className="font-medium tabular-nums">{fmtPct(stressResult.postCrashLtv)}</span>
            </div>
            {stressResult.marginCall ? (
              <div className="rounded-lg border border-red-400/40 bg-red-400/10 px-2.5 py-1 text-xs text-red-300">
                MARGIN CALL — tvångsförsäljning {fmtKr(stressResult.forcedSaleAmount)}
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300">
                Ingen margin call
              </div>
            )}
            <div className="text-muted-foreground">
              {stressResult.recoveryYear !== null
                ? `Återhämtad år ${stressResult.recoveryYear}`
                : "Ej återhämtad inom horisonten"}
            </div>
          </div>

          {chartData && chartData.length > 1 ? (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
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
                  <Tooltip content={<StressTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="base"
                    name="Bas"
                    stroke={COLORS.base}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="stressed"
                    name="Stressat"
                    stroke={COLORS.stressed}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 text-sm text-muted-foreground">
          Välj en kraschstorlek för att se resultat.
        </div>
      )}
    </div>
  );
}
