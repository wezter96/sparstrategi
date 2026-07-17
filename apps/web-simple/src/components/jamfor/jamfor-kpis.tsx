import { useAtomValue } from "@effect/atom-react";

import { STRATEGY_COLORS } from "@/components/jamfor/jamfor-chart";
import { fmtKr } from "@/lib/format";
import { comparisonResultsAtom } from "@/state/comparison";

export function JamforKpis() {
  const results = useAtomValue(comparisonResultsAtom);
  if (results.length === 0) return null;

  const best = results.reduce((a, b) =>
    b.final.valueAfterRealization > a.final.valueAfterRealization ? b : a,
  );
  const worst = results.reduce((a, b) =>
    b.final.valueAfterRealization < a.final.valueAfterRealization ? b : a,
  );
  const diff = best.final.valueAfterRealization - worst.final.valueAfterRealization;
  const diffPct =
    worst.final.valueAfterRealization > 0 ? diff / worst.final.valueAfterRealization : 0;

  return (
    <div className="space-y-3">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${results.length}, 1fr)` }}>
        {results.map((r, i) => (
          <div key={r.name + i} className="rounded-xl border bg-card p-4">
            <div
              className="text-xs font-semibold"
              style={{ color: STRATEGY_COLORS[i % STRATEGY_COLORS.length] }}
            >
              {r.name}
            </div>
            <div className="mt-1 text-lg font-bold">{fmtKr(r.final.valueAfterRealization)}</div>
            <div className="text-xs text-muted-foreground">efter skatt vid försäljning</div>
            <dl className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Värde före realisation</dt>
                <dd>{fmtKr(r.final.value)}</dd>
              </div>
              {r.final.dividendsReceived > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Utbetalda utdelningar</dt>
                  <dd>{fmtKr(r.final.dividendsReceived)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Betalt i avgifter</dt>
                <dd>{fmtKr(r.final.paidFees)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Betalt i skatt</dt>
                <dd>{fmtKr(r.final.paidTax)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Transaktionskostnader</dt>
                <dd>{fmtKr(r.final.paidTransactionCosts)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Förlorat till friktion</dt>
                <dd>{fmtKr(r.final.lostToFriction)}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
      {results.length > 1 && diff > 0 ? (
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-2.5 text-xs text-emerald-300">
          Skillnad: {fmtKr(diff)} ({(diffPct * 100).toFixed(0)} %) mer i {best.name} än i{" "}
          {worst.name}, efter skatt vid försäljning.
        </div>
      ) : null}
    </div>
  );
}
