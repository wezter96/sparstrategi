import { useAtom, useAtomValue } from "@effect/atom-react";
import { Button } from "@sparstrategi/ui/components/button";
import { Checkbox } from "@sparstrategi/ui/components/checkbox";
import { Label } from "@sparstrategi/ui/components/label";
import { NumberField } from "@sparstrategi/ui/components/number-field";
import { BookmarkIcon, Share2Icon } from "lucide-react";
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
import { toast } from "sonner";

import { PctField } from "@/components/pct-field";
import { fmtKr } from "@/lib/format";
import { saveScenario } from "@/lib/saved";
import {
  serializeWithdrawal,
  withdrawalInputAtom,
  withdrawalResultAtom,
  withdrawalShareUrl,
  type WithdrawalUiInput,
} from "@/state/withdrawal";

const ACCOUNT_LABELS = { isk: "ISK", af: "AF (depå)", none: "Skattefritt" } as const;

export function UttagView() {
  const [input, setInput] = useAtom(withdrawalInputAtom);
  const result = useAtomValue(withdrawalResultAtom);
  const set = <K extends keyof WithdrawalUiInput>(key: K, value: WithdrawalUiInput[K]) =>
    setInput({ ...input, [key]: value });

  const handleShare = () => {
    navigator.clipboard
      .writeText(withdrawalShareUrl(input))
      .then(() => toast.success("Länk kopierad"))
      .catch(() => toast.error("Kunde inte kopiera länken"));
  };

  const data = result.rows.map((row) => ({
    year: row.year,
    kapital: input.showReal ? row.capitalReal : row.capital,
    netto:
      input.accountType === "af"
        ? input.showReal
          ? row.capitalNet / (1 + input.inflation) ** row.year
          : row.capitalNet
        : null,
  }));

  const lastsForever = result.depletedYear === null;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hur länge räcker kapitalet?</h1>
          <p className="text-sm text-muted-foreground">
            Uttagsfasen: löpande uttag i dagens penningvärde, skatt per kontotyp.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const name = window.prompt("Namn på scenariot?", "Uttag");
              if (!name) return;
              saveScenario({ name, kind: "uttag", payload: serializeWithdrawal(input) });
              toast.success("Scenario sparat — finns på startsidan");
            }}
          >
            <BookmarkIcon className="size-3.5" aria-hidden />
            Spara
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2Icon className="size-3.5" aria-hidden />
            Dela
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <NumberField
            label="Startkapital (kr)"
            value={input.startCapital}
            onChange={(v) => set("startCapital", Math.max(0, v))}
            min={0}
            max={100_000_000}
            step={100_000}
          />
          <NumberField
            label="Uttag (kr/mån, dagens penningvärde)"
            value={input.monthlyWithdrawal}
            onChange={(v) => set("monthlyWithdrawal", Math.max(0, v))}
            min={0}
            max={1_000_000}
            step={1_000}
          />
          <PctField
            label="Förväntad avkastning (%/år)"
            value={input.expectedReturn}
            onChange={(v) => set("expectedReturn", v)}
            max={15}
          />
          <PctField
            label="Inflation (%/år)"
            value={input.inflation}
            onChange={(v) => set("inflation", v)}
            max={10}
          />
          <div className="space-y-1">
            <Label className="text-xs">Kontotyp</Label>
            <div className="flex gap-1.5">
              {(Object.keys(ACCOUNT_LABELS) as Array<keyof typeof ACCOUNT_LABELS>).map((acct) => (
                <Button
                  key={acct}
                  type="button"
                  size="sm"
                  variant={input.accountType === acct ? "default" : "outline"}
                  onClick={() => set("accountType", acct)}
                >
                  {ACCOUNT_LABELS[acct]}
                </Button>
              ))}
            </div>
          </div>
          {input.accountType === "af" ? (
            <PctField
              label="Anskaffningsvärdets andel av kapitalet (%)"
              value={input.afBasisShare}
              onChange={(v) => set("afBasisShare", Math.min(1, v))}
              max={100}
              step={5}
            />
          ) : null}
          <NumberField
            label="Horisont (år)"
            value={input.horizonYears}
            onChange={(v) => set("horizonYears", Math.min(60, Math.max(1, Math.round(v))))}
            min={1}
            max={60}
          />
          <div className="flex items-center gap-2">
            <Checkbox
              id="uttag-show-real"
              checked={input.showReal}
              onCheckedChange={(c) => set("showReal", c === true)}
            />
            <Label htmlFor="uttag-show-real" className="text-xs">
              Visa i dagens penningvärde
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            ISK: schablonskatt på kapitalet varje år, uttag skattefria. AF: 30 % skatt på
            vinstandelen av varje försäljning (genomsnittsmetoden) — därför säljs mer brutto än
            du får ut netto. Skattefritt: t.ex. redan skattade pengar.
          </p>
        </aside>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Kapitalet räcker
              </div>
              <div className="mt-1 text-lg font-bold">
                {lastsForever ? `> ${input.horizonYears} år` : `${result.depletedYear} år`}
              </div>
              <div className="text-xs text-muted-foreground">
                {lastsForever
                  ? "tar inte slut inom horisonten"
                  : `tar slut år ${result.depletedYear}`}
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Totalt uttaget
              </div>
              <div className="mt-1 text-lg font-bold">{fmtKr(result.totalWithdrawn)}</div>
              <div className="text-xs text-muted-foreground">nominellt över horisonten</div>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Total skatt
              </div>
              <div className="mt-1 text-lg font-bold">{fmtKr(result.totalTax)}</div>
              <div className="text-xs text-muted-foreground">
                {input.accountType === "isk"
                  ? "schablonskatt"
                  : input.accountType === "af"
                    ? "reavinstskatt på sålda andelar"
                    : "—"}
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
              Kapital över tid{input.showReal ? " — dagens penningvärde" : ""}
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
                  <Line
                    type="monotone"
                    dataKey="kapital"
                    name="Kapital"
                    stroke="#34d399"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  {input.accountType === "af" ? (
                    <Line
                      type="monotone"
                      dataKey="netto"
                      name="Netto efter latent skatt"
                      stroke="#fbbf24"
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      dot={false}
                    />
                  ) : null}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
              Varför blir det så här?
            </div>
            <p className="text-sm text-muted-foreground">
              Uttaget räknas upp med inflationen varje år så att köpkraften är konstant — det är
              därför kurvan viker av snabbare än ett fast nominellt uttag skulle antyda. En vanlig
              tumregel är 4 %-regeln: ta ut högst ~4 % av startkapitalet per år (inflationsjusterat)
              så överlever portföljen de flesta 30-årsperioder. Testa: sätt uttaget till en
              tolftedel av 4 % av startkapitalet och se hur länge det räcker med din avkastning.
            </p>
          </div>
        </div>
      </div>

      <footer className="mx-auto mt-10 max-w-7xl px-4 pb-6 text-xs text-muted-foreground">
        Fristående, uträkningarna körs helt i webbläsaren — inget sparas eller skickas till någon
        server. "Dela" kodar in dina värden i URL:en. Illustrativt räkneexempel, inte finansiell
        rådgivning.
      </footer>
    </div>
  );
}
