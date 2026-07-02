import { useAtomValue } from "@effect/atom-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { fmtKr } from "@/lib/format";
import { simulationAtom } from "@/state/simulator";

const COLORS = {
  af: "#34d399",
  isk: "#818cf8",
} as const;

function AllocationTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ name: string; value: number }>;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0]!;
  const share = total > 0 ? value / total : 0;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-popover-foreground">{name}</div>
      <div className="tabular-nums text-muted-foreground">
        {fmtKr(value)} · {(share * 100).toFixed(1)} %
      </div>
    </div>
  );
}

export function AllocationChart() {
  const sim = useAtomValue(simulationAtom);
  const { initialAf, initialIsk } = sim.calibration;
  const isk = Math.max(0, initialIsk);
  const af = Math.max(0, initialAf);
  const total = af + isk;

  if (total <= 0) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        Ingen allokering att visa.
      </div>
    );
  }

  const data = [
    { name: "AF", key: "af", value: af },
    { name: "ISK", key: "isk", value: isk },
  ].filter((d) => d.value > 0);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
        Allokering
      </div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="90%"
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
            >
              {data.map((d) => (
                <Cell key={d.key} fill={COLORS[d.key as keyof typeof COLORS]} />
              ))}
            </Pie>
            <Tooltip content={<AllocationTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-xs">
        {data.map((d) => (
          <div key={d.key} className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: COLORS[d.key as keyof typeof COLORS] }}
            />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="tabular-nums font-medium text-foreground">{fmtKr(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
