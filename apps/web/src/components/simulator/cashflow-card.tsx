import { useAtomValue } from "@effect/atom-react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { fmtKr } from "@/lib/format";
import { inputAtom, simulationAtom } from "@/state/simulator";

const COLORS = {
  positive: "#818cf8",
  negative: "#f87171",
};

function CashflowTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: { name: string; value: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0]!.payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-popover-foreground">{name}</div>
      <div className="tabular-nums text-muted-foreground">{fmtKr(value)}</div>
    </div>
  );
}

export function CashflowCard() {
  const sim = useAtomValue(simulationAtom);
  const input = useAtomValue(inputAtom);
  const y1 = sim.rows[1];
  if (!y1) return null;

  const livingCosts = 12 * input.monthlyLivingCosts;
  const need = y1.interest + livingCosts;
  const iskGain = y1.withdrawal;

  const data = [
    { name: "ISK-avkastning", value: iskGain },
    { name: "Ränta", value: -y1.interest },
    { name: "Levnadskostnader", value: -livingCosts },
  ].filter((d) => d.value !== 0);

  const balanced = Math.abs(iskGain - need) < Math.max(1, need * 0.01);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
        Kassaflöde, år 1
      </div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickFormatter={(v: number) => fmtKr(v)}
            />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              width={110}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <Tooltip content={<CashflowTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="value" radius={4}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.value >= 0 ? COLORS.positive : COLORS.negative} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {balanced ? (
        <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-2.5 text-xs text-emerald-300">
          Kassaflöde ±0 — ISK:s stamkapital förblir intakt.
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 p-2.5 text-xs text-red-300">
          Kassaflödet täcker inte behovet — ISK:s stamkapital eroderas över tid.
        </div>
      )}
    </div>
  );
}
