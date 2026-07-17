import { useAtomValue } from "@effect/atom-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { fmtKr, fmtPct } from "@/lib/format";
import {
  kapitalmotorInputAtom,
  kellyCurveAtom,
  kellyOptimalAtom,
  monteCarloAtom,
} from "@/state/kapitalmotor";

export function KapitalmotorKellyCard() {
  const input = useAtomValue(kapitalmotorInputAtom);
  const kellyL = useAtomValue(kellyOptimalAtom);
  const curve = useAtomValue(kellyCurveAtom);
  const mc = useAtomValue(monteCarloAtom);

  const current = input.targetLtvOfEquity;
  const diff = current - kellyL;
  const verdict =
    Math.abs(diff) < 0.02
      ? "nära Kelly-optimum"
      : diff > 0
        ? "över Kelly-optimum — mer belåning skulle sänka förväntad tillväxttakt"
        : "under Kelly-optimum — mer belåning skulle höja förväntad tillväxttakt (till priset av högre risk)";

  const curveData = curve.map((p) => ({ ltv: p.ltvOfEquity, growth: p.growthRate }));

  const fanData = mc.years.map((y) => ({
    year: y.year,
    base: y.p5,
    innerLow: y.p25 - y.p5,
    mid: y.p75 - y.p25,
    innerHigh: y.p95 - y.p75,
    p50: y.p50,
  }));

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
        Kelly-kriteriet — teoretiskt optimal hävstång
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Vår modell antar hittills konstant avkastning varje år. I verkligheten är avkastningen
        stokastisk, och då är "mer belåning = mer förmögenhet" inte längre sant obegränsat —
        volatilitet urholkar den sammansatta tillväxten med kvadraten på hävstången. Kelly-formeln
        f* = (μ − r) / σ² ger den hävstång som maximerar den FÖRVÄNTADE sammansatta
        tillväxttakten (kontinuerlig approximation). Monte Carlo-simuleringen nedan validerar det
        empiriskt mot motorns faktiska, diskreta återbelåningsmekanik.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Kelly-optimal belåningsgrad</div>
          <div className="tabular-nums text-lg font-semibold text-emerald-400">
            {fmtPct(kellyL)}
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Nuvarande belåningsgrad</div>
          <div className="tabular-nums text-lg font-semibold">{fmtPct(current)}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">
            Sannolikhet för margin call, {input.horizonYears} år
          </div>
          <div className="tabular-nums text-lg font-semibold text-amber-400">
            {fmtPct(mc.finalMarginCallProbability)}
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 p-2.5 text-xs">
        Ni ligger {verdict}.
      </div>

      <div className="mt-5 h-[220px]">
        <div className="mb-1 text-xs text-muted-foreground">
          Förväntad geometrisk tillväxttakt vid olika belåningsgrad
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={curveData}>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="ltv"
              tickFormatter={(v: number) => fmtPct(v)}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              tickFormatter={(v: number) => fmtPct(v)}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              width={56}
            />
            <Tooltip
              formatter={(value: unknown) => [fmtPct(Number(value)), "Tillväxttakt"]}
              labelFormatter={(l: unknown) => `Belåning: ${fmtPct(Number(l))}`}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Line type="monotone" dataKey="growth" stroke="#6c8cff" strokeWidth={2.5} dot={false} />
            <ReferenceLine x={kellyL} stroke="#34d399" strokeDasharray="4 4" label={{ value: "Kelly", fill: "#34d399", fontSize: 11 }} />
            <ReferenceLine x={current} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: "Nu", fill: "#fbbf24", fontSize: 11 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 h-[260px]">
        <div className="mb-1 text-xs text-muted-foreground">
          Monte Carlo — spridning i portföljvärde ({defaultPathsLabel(mc.years.length)})
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={fanData}>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="year"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              tickFormatter={(v: number) => fmtKr(v)}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              width={72}
            />
            <Tooltip
              formatter={(value: unknown, name: unknown) => [fmtKr(Number(value)), String(name)]}
              labelFormatter={(l: unknown) => `År ${String(l)}`}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }} />
            <Area dataKey="base" stackId="fan" stroke="none" fill="transparent" name="" legendType="none" />
            <Area
              dataKey="innerLow"
              stackId="fan"
              stroke="none"
              fill="#6c8cff"
              fillOpacity={0.12}
              name="P5–P95"
            />
            <Area
              dataKey="mid"
              stackId="fan"
              stroke="none"
              fill="#6c8cff"
              fillOpacity={0.3}
              name="P25–P75"
            />
            <Area
              dataKey="innerHigh"
              stackId="fan"
              stroke="none"
              fill="#6c8cff"
              fillOpacity={0.12}
              name=""
              legendType="none"
            />
            <Line type="monotone" dataKey="p50" stroke="#34d399" strokeWidth={2.5} dot={false} name="Median" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Bandet visar var 5:e till 95:e percentilen av utfall hamnar givet σ={fmtPct(input.volatility)}{" "}
        årlig volatilitet — inte en prognos, utan en illustration av spridningen som den
        deterministiska tabellen längre upp döljer helt.
      </p>
    </div>
  );
}

function defaultPathsLabel(yearsLength: number): string {
  return `${yearsLength - 1} år, 2000 simulerade banor`;
}
