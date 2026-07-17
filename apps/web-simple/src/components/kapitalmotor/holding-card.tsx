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
import { alt1ReinvestAtom, holdingAtom } from "@/state/kapitalmotor";

const COLORS = { private: "#34d399", holding: "#a78bfa" } as const;

export function KapitalmotorHoldingCard() {
  const holding = useAtomValue(holdingAtom);
  const privateAlt1 = useAtomValue(alt1ReinvestAtom);

  const data = holding.map((row, idx) => ({
    year: row.year,
    private: privateAlt1.rows[idx]?.portfolio ?? null,
    holding: row.totalNetWorth,
  }));

  const last = holding.at(-1);
  const lastPrivate = privateAlt1.rows.at(-1);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        Privat vs. holdingbolag
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Bolaget äger portföljen genom en kapitalförsäkring-liknande del (schablonbeskattad, taxas
        med bolagsskatt 20,6% i stället för 30%) och en vanlig depå (uppskjuten skatt, som AF).
        Överskott utöver gränsbeloppet (3:12, förenklingsregeln) tas ut som utdelning 20% inom
        gränsbeloppet, resten schablonmässigt som hög marginalskatt. Endast förenklingsregeln
        modelleras — inte lönebaserat utrymme. Detta är en grov approximation, inte skatterådgivning.
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
              dataKey="private"
              name="Privat · Alt 1 (bokfört, aldrig sälj)"
              stroke={COLORS.private}
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="holding"
              name="Holdingbolag · nettoförmögenhet (utdelat + kvar i bolaget efter latent skatt)"
              stroke={COLORS.holding}
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {last && lastPrivate ? (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Uttaget netto (utdelning), ack.</div>
            <div className="tabular-nums text-sm font-semibold">
              {fmtKr(last.personalWealthNet)}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Kvar i bolaget (efter latent skatt)</div>
            <div className="tabular-nums text-sm font-semibold">
              {fmtKr(last.companyVp + last.companyKf - last.companyLatentTax)}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">
              Holdingbolag totalt vs. Privat (bokfört)
            </div>
            <div className="tabular-nums text-sm font-semibold">
              {fmtKr(last.totalNetWorth - lastPrivate.portfolio)}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
