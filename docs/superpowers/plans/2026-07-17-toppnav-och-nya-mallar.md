# Toppnav och fyra nya jämförelsemallar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toppnavigation med Kapitalmotorn först + malldropdown, hash-deep-links `#/jamfor/:mallId`, och fyra nya mallar (tidigt, risk, belaning, amortera) med tre små motortillägg (`savingsStartYear`, belåning, kontotyp `"none"`).

**Architecture:** Hash-routern utökas till `{view, templateId}` så mallval blir deep-linkbart och pending-template-mekanismen försvinner. Ny `TopNav`-komponent renderas i `App.tsx`. Motortilläggen görs i `packages/engine/src/comparison.ts` som bakåtkompatibla valfria fält — med defaultvärden reduceras all ny kod exakt till dagens beteende, så befintliga tester ligger orörda.

**Tech Stack:** React 19, `@effect/atom-react`, shadcn-komponenter från `@sparstrategi/ui`, bun:test.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-17-toppnav-och-nya-mallar-design.md`.
- Arbeta direkt på `master` (användarens val). Committa per task.
- UI-copy på svenska. Pengar i kr, räntor som decimaltal (0.07 = 7 %).
- `bun test` (inte vitest). Typkoll: `bun run check-types`.
- Dokumentreproduktionstestet (`packages/engine/test/simulate.test.ts`) får inte röras.
- Mallen `egen` MÅSTE ligga sist i `templates`-arrayen (`templateById` faller tillbaka på `.at(-1)`).
- `apps/web` (fulla appen) rörs inte.

---

### Task 1: Router med mall-deep-links

**Files:**
- Modify: `apps/web-simple/src/lib/router.ts` (hela filen ersätts)
- Modify: `apps/web-simple/src/state/comparison.ts` (exportera `fromTemplate`, ta bort pending-mekanismen, mall-id i dela-hash)
- Modify: `apps/web-simple/src/views/start.tsx`, `apps/web-simple/src/views/jamfor.tsx`, `apps/web-simple/src/App.tsx`

**Interfaces:**
- Produces: `type View`, `interface Route { view: View; templateId?: string }`, `parseHash(hash: string): Route`, `navigate(view: View, templateId?: string): void`, `useRoute(): Route` — allt från `@/lib/router`. `fromTemplate(id: string): ComparisonUiInput` exporteras från `@/state/comparison`. `loadTemplate`/`consumePendingTemplate` TAS BORT.

- [ ] **Step 1: Ersätt `router.ts`**

```ts
import { useEffect, useState } from "react";

export type View = "start" | "jamfor" | "kapitalmotor";

export interface Route {
  view: View;
  /** Endast jamfor: mall-id ur hashen, t.ex. #/jamfor/avgift. */
  templateId?: string;
}

export const parseHash = (hash: string): Route => {
  if (hash.startsWith("#/kapitalmotor")) return { view: "kapitalmotor" };
  if (hash.startsWith("#/jamfor")) {
    const id = hash.replace(/^#\//, "").split("/")[1];
    return id ? { view: "jamfor", templateId: id } : { view: "jamfor" };
  }
  return { view: "start" };
};

/** Gamla dela-länkar (`?s=` utan hash) ska fortsätta öppna Kapitalmotorn. */
const initialRoute = (): Route => {
  if (window.location.hash === "" && new URLSearchParams(window.location.search).has("s")) {
    return { view: "kapitalmotor" };
  }
  return parseHash(window.location.hash);
};

export const navigate = (view: View, templateId?: string): void => {
  window.location.hash =
    view === "start" ? "#/" : templateId ? `#/${view}/${templateId}` : `#/${view}`;
};

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(initialRoute);
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
```

- [ ] **Step 2: Uppdatera `state/comparison.ts`**

Gör `fromTemplate` exporterad (`export const fromTemplate = ...`, oförändrad kropp). Ta bort hela blocket från kommentaren `/** Sätts av mallkorten ... */` t.o.m. `consumePendingTemplate` (rad 72–82). Lägg mall-id i dela-hashen så ett öppnat `?j=` aldrig nollställs av mall-effekten:

```ts
export const comparisonShareUrl = (input: ComparisonUiInput): string =>
  `${window.location.origin}${window.location.pathname}?j=${encodeURIComponent(serialize(input))}#/jamfor/${input.templateId}`;
```

- [ ] **Step 3: Uppdatera `start.tsx`**

Ta bort importen av `loadTemplate`. Mallkortens onClick blir:

```tsx
onClick={() => navigate("jamfor", t.id)}
```

- [ ] **Step 4: Uppdatera `jamfor.tsx`**

Byt importer: `import { navigate, useRoute } from "@/lib/router";` och
`import { comparisonInputAtom, comparisonShareUrl, fromTemplate } from "@/state/comparison";` (ta bort `consumePendingTemplate`). Ersätt pending-effekten med mall-synk från hashen. OBS: jämför mot `templateById(...).id` — okänt hash-id faller tillbaka till "egen", och att jämföra mot det upplösta id:t (inte rå-hashen) förhindrar en oändlig reset-loop:

```tsx
const route = useRoute();
useEffect(() => {
  if (route.view !== "jamfor" || !route.templateId) return;
  const target = templateById(route.templateId).id;
  if (target !== input.templateId) setInput(fromTemplate(target));
}, [route, input.templateId, setInput]);
```

- [ ] **Step 5: Uppdatera `App.tsx`**

`const route = useRoute();` och växla på `route.view` i stället för `view`. (Import: `useRoute` i stället för `useView`.)

- [ ] **Step 6: Verifiera**

Run: `cd /Users/anton/Documents/repos/sparstrategi && bun run check-types`
Expected: PASS (inga typfel).
Run: `bun run dev:web` är fulla appen — web-simple startas med `cd apps/web-simple && bun run dev`. Kontrollera i webbläsaren: `#/jamfor/avgift` öppnar avgiftsmallen direkt; mallkort på startsidan navigerar; bakåtknapp växlar mall; `#/jamfor/okänt-id` visar "egen".

- [ ] **Step 7: Commit**

```bash
git add apps/web-simple/src
git commit -m "feat(web-simple): template deep links #/jamfor/:mallId, drop pending-template"
```

---

### Task 2: TopNav-komponent

**Files:**
- Create: `apps/web-simple/src/components/top-nav.tsx`
- Modify: `apps/web-simple/src/App.tsx`, `apps/web-simple/src/views/jamfor.tsx`, `apps/web-simple/src/views/kapitalmotor.tsx`

**Interfaces:**
- Consumes: `Route`, `navigate` från Task 1; `templates` från `@/lib/templates`; `DropdownMenu`-familjen och `Button` från `@sparstrategi/ui`.
- Produces: `TopNav({ route }: { route: Route })` från `@/components/top-nav`.

- [ ] **Step 1: Skapa `top-nav.tsx`**

OBS: dropdownen är byggd på Base UI (`MenuPrimitive`) — triggern tar INTE `asChild`; styla den direkt med klasser.

```tsx
import { Button } from "@sparstrategi/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@sparstrategi/ui/components/dropdown-menu";
import { CheckIcon, ChevronDownIcon } from "lucide-react";

import { navigate, type Route } from "@/lib/router";
import { templates } from "@/lib/templates";

export function TopNav({ route }: { route: Route }) {
  const activeTemplateId = route.view === "jamfor" ? route.templateId : undefined;
  return (
    <header className="border-b">
      <nav className="container mx-auto flex h-12 max-w-7xl items-center gap-1 px-4">
        <button
          type="button"
          onClick={() => navigate("start")}
          className="mr-3 text-sm font-bold"
        >
          Sparstrategi
        </button>
        <Button
          type="button"
          size="sm"
          variant={route.view === "kapitalmotor" ? "secondary" : "ghost"}
          onClick={() => navigate("kapitalmotor")}
        >
          Kapitalmotor
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            className={`inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
              route.view === "jamfor" ? "bg-secondary text-secondary-foreground" : ""
            }`}
          >
            Jämförelser
            <ChevronDownIcon className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {templates.map((t) => (
              <DropdownMenuItem key={t.id} onClick={() => navigate("jamfor", t.id)}>
                {t.title}
                {t.id === activeTemplateId ? <CheckIcon className="ml-auto size-3.5" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </header>
  );
}
```

- [ ] **Step 2: Rendera i `App.tsx`**

```tsx
import { TopNav } from "@/components/top-nav";
// ... i return, direkt innanför ThemeProvider:
<TopNav route={route} />
{route.view === "kapitalmotor" ? ( ... )}
```

- [ ] **Step 3: Ta bort "← Alla verktyg"**

I `jamfor.tsx` (rad 50–56) och `kapitalmotor.tsx` (rad 31–37): ta bort `<button ...>Alla verktyg</button>`-blocket och den då oanvända `ArrowLeftIcon`-importen. I `kapitalmotor.tsx` blir även `navigate`-importen oanvänd — ta bort den.

- [ ] **Step 4: Verifiera**

Run: `bun run check-types` → PASS. I dev-servern: navet syns på alla tre vyer; Kapitalmotor-tabben först och markerad på `#/kapitalmotor`; dropdownen listar alla mallar med bock på aktiv; loggan går till start.

- [ ] **Step 5: Commit**

```bash
git add apps/web-simple/src
git commit -m "feat(web-simple): top nav with kapitalmotor tab and template dropdown"
```

---

### Task 3: Motorfält `savingsStartYear`

**Files:**
- Modify: `packages/engine/src/comparison.ts`
- Test: `packages/engine/test/comparison.test.ts`

**Interfaces:**
- Produces: `StrategyInput.savingsStartYear?: number` — antal år utan månadsinsättningar (default 0 = spara från år 1). Gäller både riktiga insättningar och `frictionlessValue`-spåret.

- [ ] **Step 1: Skriv failande test**

Lägg till sist i `comparison.test.ts` (använder befintliga `assumptions`/`frictionFree`-hjälparna):

```ts
describe("savingsStartYear", () => {
  test("inga insättningar t.o.m. startåret; därefter identiskt med en kortare sparhorisont", () => {
    const a = assumptions({ startCapital: 0, monthlySavings: 1_000, horizonYears: 10 });
    const delayed = simulateStrategy(a, frictionFree({ savingsStartYear: 5 }));
    expect(delayed.rows[5]!.value).toBe(0);
    expect(delayed.rows[5]!.frictionlessValue).toBe(0);
    const early = simulateStrategy(
      assumptions({ startCapital: 0, monthlySavings: 1_000, horizonYears: 5 }),
      frictionFree(),
    );
    expect(delayed.final.value).toBeCloseTo(early.final.value, 6);
  });

  test("default (utan fältet) sparar från år 1", () => {
    const a = assumptions({ startCapital: 0, monthlySavings: 1_000, horizonYears: 1 });
    const r = simulateStrategy(a, frictionFree());
    expect(r.rows[1]!.value).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Kör testet — ska faila**

Run: `cd packages/engine && bun test test/comparison.test.ts`
Expected: FAIL — `delayed.rows[5]!.value` > 0 (fältet ignoreras) samt TS-fel på okänt fält.

- [ ] **Step 3: Implementera**

I `StrategyInput` (efter `monthlySavingsOverride`):

```ts
  /** Antal år utan månadsinsättningar (0 = spara från år 1). Mallen "tidigt". */
  savingsStartYear?: number;
```

I årsloopen i `simulateStrategy`, ersätt steg 1-raderna:

```ts
    // 1. Insättningar (0 t.o.m. savingsStartYear)
    const monthlyThisYear = year > (s.savingsStartYear ?? 0) ? monthly : 0;
    const deposits = 12 * monthlyThisYear;
    const depositCost = 12 * tradeCost(monthlyThisYear);
    const netDeposits = deposits - depositCost;
```

`frictionless`-raden längst ner i loopen använder redan `deposits` — den följer med automatiskt.

- [ ] **Step 4: Kör testerna — allt grönt**

Run: `cd packages/engine && bun test`
Expected: PASS, inklusive alla befintliga tester.

- [ ] **Step 5: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): savingsStartYear on StrategyInput for delayed-start comparisons"
```

---

### Task 4: Mallarna `tidigt` och `risk`

**Files:**
- Modify: `apps/web-simple/src/lib/templates.ts` (nya poster FÖRE `egen`)

**Interfaces:**
- Consumes: `savingsStartYear` från Task 3.
- Produces: mall-id `tidigt` och `risk` (dropdownen i Task 2 plockar upp dem automatiskt).

- [ ] **Step 1: Lägg till mallarna före `egen`-posten**

```ts
  {
    id: "tidigt",
    title: "Börja tidigt eller vänta?",
    question: "Samma månadssparande — men den ena väntar tio år med att börja.",
    explainer:
      "Tid i marknaden slår nästan allt annat. Den som väntar tio år måste inte bara ta igen " +
      "insättningarna — utan även all avkastning de tidiga insättningarna hunnit generera, och " +
      "avkastningen på den avkastningen. Notera att gapet i slutvärde är mycket större än de " +
      "insättningar som missades: det är ränta-på-ränta-effekten. Dra i horisonten och se hur " +
      "gapet växer med tiden.",
    assumptions: { startCapital: 0, monthlySavings: 3_000, horizonYears: 30 },
    strategies: [
      { ...s("Börjar nu") },
      { ...s("Väntar 10 år"), savingsStartYear: 10 },
    ],
    highlightedFields: ["savingsStartYear"],
    lockDeposits: true,
  },
  {
    id: "risk",
    title: "Spara mer eller ta mer risk?",
    question: "1 000 kr extra i månaden — eller en procentenhet högre avkastning?",
    explainer:
      "Tidigt i spartiden dominerar insättningarna: 1 000 kr extra i månaden slår lätt en " +
      "procentenhet i avkastning. Men avkastningen verkar på hela kapitalet, så när portföljen " +
      "vuxit sig stor vänder det — brytpunkten syns där kurvorna korsas. Extra sparande är " +
      "dessutom garanterat, högre avkastning kräver mer risk. Justera beloppen och " +
      "avkastningen för din egen situation.",
    assumptions: { startCapital: 50_000, monthlySavings: 4_000, horizonYears: 25 },
    strategies: [
      { ...s("Spara mer"), priceGrowth: 0.06, monthlySavingsOverride: 5_000 },
      { ...s("Mer risk"), priceGrowth: 0.07 },
    ],
    highlightedFields: ["priceGrowth", "monthlySavingsOverride"],
    lockDeposits: false,
  },
```

- [ ] **Step 2: Fältredigerare för `savingsStartYear`**

`savingsStartYear` ingår i `highlightedFields` och behöver en redigerare i `strategy-column.tsx` — det görs samlat i Task 7 Step 3. För att mallen ska vara komplett redan nu: lägg till casen och ALL_FIELDS-posten enligt Task 7 Step 3 (endast `savingsStartYear`-delarna) i denna task.

I `renderField`-switchen (efter `monthlySavingsOverride`):

```tsx
      case "savingsStartYear":
        return (
          <NumberField key={key} label="Börjar spara efter år" value={strategy.savingsStartYear ?? 0} onChange={(v) => set("savingsStartYear", Math.max(0, Math.round(v)))} min={0} max={40} />
        );
```

I `ALL_FIELDS` (efter `"spreadRate"`): `"savingsStartYear",`

- [ ] **Step 3: Verifiera**

Run: `bun run check-types` → PASS. Dev-servern: båda mallarna i dropdown + startsida; `tidigt` visar 0 kr fram till år 10 för "Väntar 10 år" i tabellen; `risk` visar korsande kurvor sent i grafen.

- [ ] **Step 4: Commit**

```bash
git add apps/web-simple/src
git commit -m "feat(web-simple): templates tidigt (time in market) and risk (save more vs higher return)"
```

---

### Task 5: Belåning i jämförelsemotorn

**Files:**
- Modify: `packages/engine/src/comparison.ts`
- Test: `packages/engine/test/comparison.test.ts`

**Interfaces:**
- Consumes: `interestDeduction`, `netTax` från `./tax` (redan använda i kapitalmotorn — ny import här).
- Produces: `StrategyInput.leverageOfEquity?: number` (lån/eget kapital, kapitalmotorns konvention) och `StrategyInput.loanRate?: number`. Årlig återbelåning; ränteavdrag nettas mot schablonskatt. Med defaultvärden (0) är beteendet bit-för-bit oförändrat.

- [ ] **Step 1: Skriv failande tester**

```ts
describe("belåning", () => {
  test("utan skatt/avgifter: value = start × (1 + (1+L)·g − L·i)^n", () => {
    const a = assumptions({ startCapital: 100_000, monthlySavings: 0, horizonYears: 10 });
    const r = simulateStrategy(
      a,
      frictionFree({ leverageOfEquity: 0.2, loanRate: 0.04 }),
    );
    const expected = 100_000 * Math.pow(1 + 1.2 * 0.07 - 0.2 * 0.04, 10);
    expect(r.rows.at(-1)!.value).toBeCloseTo(expected, 4);
  });

  test("ISK: schablon beräknas på exponerat belopp och nettas mot ränteavdraget", () => {
    const a = assumptions({ startCapital: 1_000_000, monthlySavings: 0, horizonYears: 1 });
    const s: StrategyInput = {
      ...defaultStrategyInput("belånad isk"),
      fundFeeRate: 0,
      priceGrowth: 0,
      leverageOfEquity: 0.2,
      loanRate: 0.04,
    };
    const r = simulateStrategy(a, s);
    const loan = 200_000;
    const interest = 0.04 * loan;
    const p = defaultTaxParams2026;
    const grossSchablon =
      Math.max(0, 1_200_000 - p.iskFreeAmount) * (Math.max(p.slr + 0.01, 0.0125) * 0.3);
    const expectedTax = Math.max(0, grossSchablon - 0.3 * interest);
    expect(r.final.paidTax).toBeCloseTo(expectedTax, 2);
  });

  test("leverageOfEquity 0 ändrar ingenting", () => {
    const a = assumptions({ monthlySavings: 2_000 });
    const base = simulateStrategy(a, frictionFree());
    const zero = simulateStrategy(a, frictionFree({ leverageOfEquity: 0, loanRate: 0.04 }));
    expect(zero.final.value).toBe(base.final.value);
    expect(zero.final.paidTax).toBe(base.final.paidTax);
  });
});
```

- [ ] **Step 2: Kör — ska faila**

Run: `cd packages/engine && bun test test/comparison.test.ts`
Expected: FAIL (TS-fel: okända fält).

- [ ] **Step 3: Implementera**

Importrad överst i `comparison.ts`:

```ts
import { interestDeduction, iskTax, iskTaxRate, netTax } from "./tax";
```

Fält i `StrategyInput` (efter `savingsStartYear`):

```ts
  /** Belåningsgrad = lån / eget kapital (kapitalmotorns konvention). Återbelånas årligen. */
  leverageOfEquity?: number;
  /** Ränta på lånet. Ränteavdrag (30/21 %) nettas mot schablonskatten. */
  loanRate?: number;
```

I `simulateStrategy`, före årsloopen:

```ts
  const lev = s.leverageOfEquity ?? 0;
  const loanRate = s.loanRate ?? 0;
```

I årsloopen, ändra steg 2 och 3 (steg 1 från Task 3 orörd):

```ts
    // 2. Avkastning och avgift på exponerat belopp (eget kapital + lån)
    const capStart = value;
    const loan = lev * Math.max(0, capStart);
    const exposed = capStart + loan;
    const mid = exposed + netDeposits / 2;
    const fee = s.fundFeeRate * mid;
    const appreciation = s.priceGrowth * mid;
    const dividends = s.dividendYield * mid;
    const interest = loanRate * loan;
    paidFees += fee;

    let newValue = capStart + netDeposits + appreciation - fee - interest;
    basis += netDeposits;

    // 3. Schablonskatt på exponerat ingående kapital, nettad mot ränteavdrag.
    const grossSchablon =
      s.accountType === "isk"
        ? iskTax(exposed, p)
        : s.accountType === "kf"
          ? Math.max(0, exposed) * iskTaxRate(p)
          : 0;
    const schablon = netTax(grossSchablon, interestDeduction(interest, p)).net;
    newValue -= schablon;
    paidTax += schablon;
```

(Med `lev = 0` blir `loan = 0`, `interest = 0`, `interestDeduction(0) = 0` och `netTax(g, 0).net = g` — exakt dagens beteende. Steg 4–5 orörda; `schablon`-variabeln som källskatteavräkningen använder är nu nettobeloppet, vilket är konservativt och acceptabelt.)

- [ ] **Step 4: Kör alla motortester**

Run: `cd packages/engine && bun test`
Expected: PASS — nya testerna gröna, inga regressioner (särskilt `comparison.test.ts` och `simulate.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): leverage (leverageOfEquity/loanRate) in comparison engine"
```

---

### Task 6: Kontotyp `"none"` (skattefri)

**Files:**
- Modify: `packages/engine/src/comparison.ts`
- Test: `packages/engine/test/comparison.test.ts`

**Interfaces:**
- Produces: `ComparisonAccountType` utökad med `"none"` — ingen schablon, ingen utdelningsskatt (utländsk källskatt dras dock), ingen latent skatt. Används av `amortera`-mallen.

- [ ] **Step 1: Skriv failande test**

```ts
describe('kontotyp "none" (skattefri)', () => {
  test("ingen skatt någonstans: value följer (1+g)^n och paidTax är 0", () => {
    const a = assumptions({ startCapital: 100_000, monthlySavings: 0, horizonYears: 10 });
    const r = simulateStrategy(a, {
      ...defaultStrategyInput("amortering"),
      accountType: "none",
      priceGrowth: 0.0245,
      fundFeeRate: 0,
    });
    expect(r.final.paidTax).toBe(0);
    expect(r.rows.at(-1)!.value).toBeCloseTo(100_000 * Math.pow(1.0245, 10), 4);
    for (const row of r.rows) {
      expect(row.latentTax).toBe(0);
      expect(row.valueAfterRealization).toBe(row.value);
    }
  });
});
```

- [ ] **Step 2: Kör — ska faila**

Run: `cd packages/engine && bun test test/comparison.test.ts`
Expected: FAIL (TS-fel: `"none"` inte i unionstypen).

- [ ] **Step 3: Implementera**

```ts
export type ComparisonAccountType = "isk" | "af" | "kf" | "none";
```

Schablon-ternaryn (Task 5 Step 3) ger redan 0 för `"none"`. Utdelningsskatten måste dock särbehandlas — idag faller `"none"` in i ISK-grenen. Ändra `divTax`:

```ts
    const divTax =
      s.accountType === "af"
        ? Math.max(withheld, gainsRate * dividends)
        : s.accountType === "kf"
          ? 0
          : s.accountType === "none"
            ? withheld
            : Math.max(0, withheld - schablon);
```

`latentTax`/`basis` i `mkRow` och AF-realisering vid ombalansering är redan gate:ade på `=== "af"` — inga ändringar.

- [ ] **Step 4: Kör alla motortester**

Run: `cd packages/engine && bun test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): tax-free account type none for amortization comparisons"
```

---

### Task 7: Mallarna `belaning` och `amortera` + fältredigerare

**Files:**
- Modify: `apps/web-simple/src/lib/templates.ts` (två mallar, FÖRE `egen`)
- Modify: `apps/web-simple/src/components/jamfor/strategy-column.tsx`

**Interfaces:**
- Consumes: `leverageOfEquity`/`loanRate` (Task 5), `"none"` (Task 6), `savingsStartYear`-redigeraren (Task 4).
- Produces: mall-id `belaning` och `amortera`; redigerare för de nya fälten; `ACCOUNT_LABELS` täcker `"none"`.

- [ ] **Step 1: Lägg till mallarna före `egen`**

```ts
  {
    id: "belaning",
    title: "Belånat eller obelånat?",
    question: "Samma portfölj på ISK — med och utan 20 % belåning.",
    explainer:
      "Belåningen ökar exponeringen: avkastningen räknas på eget kapital plus lån, medan " +
      "räntan bara kostar på lånet. Så länge avkastningen överstiger räntan växer den belånade " +
      "portföljen snabbare — och ränteavdraget mildrar dessutom schablonskatten. Men jämförelsen " +
      "är deterministisk: den visar inte risken. I en krasch faller den belånade portföljen " +
      "mer än marknaden, och vid hög belåning kan banken tvångssälja. Utforska kraschscenarier " +
      "i Kapitalmotorns stresstest och Monte Carlo.",
    assumptions: { startCapital: 500_000, monthlySavings: 3_000, horizonYears: 20 },
    strategies: [
      { ...s("Obelånat") },
      { ...s("Belånat 20 %"), leverageOfEquity: 0.2, loanRate: 0.04 },
    ],
    highlightedFields: ["leverageOfEquity", "loanRate"],
    lockDeposits: true,
  },
  {
    id: "amortera",
    title: "Amortera eller investera?",
    question: "Extra tusenlappar in i marknaden — eller ner i bolånet?",
    explainer:
      "Amortering är en garanterad, skattefri avkastning lika med din bolåneränta efter " +
      "ränteavdrag (3,5 % × 0,7 ≈ 2,45 %). Investering på ISK förväntas ge mer — men är " +
      "osäker och schablonbeskattas. Jämförelsen är deterministisk och fångar inte risken: " +
      "amorteringens avkastning är säker, marknadens är det inte. Justera \"kurstillväxten\" " +
      "på amorteringsstrategin till din egen boränta × 0,7.",
    assumptions: { startCapital: 0, monthlySavings: 3_000, horizonYears: 20 },
    strategies: [
      { ...s("Investera (ISK)") },
      { ...s("Amortera"), accountType: "none", priceGrowth: 0.0245, fundFeeRate: 0 },
    ],
    highlightedFields: ["priceGrowth", "accountType"],
    lockDeposits: true,
  },
```

- [ ] **Step 2: `ACCOUNT_LABELS` i `strategy-column.tsx`**

```ts
const ACCOUNT_LABELS: Record<ComparisonAccountType, string> = {
  isk: "ISK",
  af: "AF (depå)",
  kf: "KF",
  none: "Skattefritt",
};
```

- [ ] **Step 3: Redigerare för belåningsfälten**

I `renderField`-switchen (efter `savingsStartYear`-caset från Task 4):

```tsx
      case "leverageOfEquity":
        return (
          <PctField key={key} label="Belåning (% av eget kapital)" value={strategy.leverageOfEquity ?? 0} onChange={(v) => set("leverageOfEquity", v)} max={100} step={5} />
        );
      case "loanRate":
        return (
          <PctField key={key} label="Låneränta (%/år)" value={strategy.loanRate ?? 0} onChange={(v) => set("loanRate", v)} max={15} step={0.1} />
        );
```

I `ALL_FIELDS` efter `"savingsStartYear"`: `"leverageOfEquity", "loanRate",`

- [ ] **Step 4: Verifiera**

Run: `bun run check-types` → PASS. Dev-servern: `belaning` visar belånad kurva över obelånad; `amortera` visar ISK över amortering på 20 år; "Skattefritt"-knappen syns i sparformsväljaren; alla åtta mallar i dropdownen med `egen` sist.

- [ ] **Step 5: Commit**

```bash
git add apps/web-simple/src
git commit -m "feat(web-simple): templates belaning and amortera with leverage/tax-free editors"
```

---

### Task 8: Slutverifiering

**Files:** inga nya ändringar (endast fixar om något faller ut).

- [ ] **Step 1: Hela testsviten och typer**

Run: `cd /Users/anton/Documents/repos/sparstrategi && bun test && bun run check-types`
Expected: alla tester PASS (inklusive dokumentreproduktionstestet), inga typfel.

- [ ] **Step 2: Manuell checklista i dev-servern** (`cd apps/web-simple && bun run dev`)

- Toppnav på alla vyer; Kapitalmotor först; aktiv markering korrekt.
- Dropdown: 8 mallar, klick byter mall direkt utan omväg via start.
- Deep links: `#/jamfor/tidigt`, `#/jamfor/belaning` öppnar rätt mall; okänt id → egen.
- Dela-knappen: kopierad `?j=`-länk öppnar samma tillstånd i nytt fönster (mallen nollställs INTE).
- Legacy: en gammal `?s=`-länk utan hash öppnar Kapitalmotorn.
- Bakåtknappen vandrar genom mallbyten.

- [ ] **Step 3: Committa eventuella fixar**

```bash
git add -A && git commit -m "fix(web-simple): polish from final verification"
```

(Hoppa över committen om inget ändrats.)
