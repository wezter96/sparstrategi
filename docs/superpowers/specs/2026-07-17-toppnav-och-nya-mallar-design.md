# Toppnav och fyra nya jämförelsemallar

Datum: 2026-07-17 · Status: godkänd design · App: `apps/web-simple` + `packages/engine`

## Mål

1. Toppnavigation på alla vyer så man byter route/mall utan att gå via startsidan, med Kapitalmotorn som första post.
2. Fyra nya mallar: "Börja tidigt eller vänta?", "Spara mer eller ta mer risk?", "Belånat vs obelånat", "Amortera eller investera?".

## Etapp 1 — Toppnav + router

**Router** (`src/lib/router.ts`): hash-format utökas till `#/jamfor/:mallId`.

- `parseHash` returnerar `{ view: View; templateId?: string }`. `#/jamfor` utan id ⇒ `templateId: "egen"`. Okänt id ⇒ `templateById`-fallback ("egen").
- `navigate(view, templateId?)`. Legacy `?s=` → kapitalmotor och `?j=`-delningslänkar oförändrade. `?j=` fortsätter bära hela tillståndet; hashens mallId styr bara vilken mall som laddas vid ren navigation.
- Mallbyte via nav laddar mallens förifyllda tillstånd (`loadTemplate`), ersätter dagens pending-mekanism vid navigering; `consumePendingTemplate` tas bort när hash-id:t tagit över.

**Toppnav** (`src/components/top-nav.tsx`, renderas i `App.tsx` ovanför vyerna):

- Vänster: "Sparstrategi" → `#/` (start).
- Poster i ordning: **Kapitalmotor** (tabb, först), **Jämförelser ▾** (shadcn `DropdownMenu` från `@sparstrategi/ui`) med alla mallar i `templates`-ordning.
- Aktiv markering: kapitalmotor-tabben vid `view === "kapitalmotor"`; dropdown-triggern + aktuell mallrad vid `view === "jamfor"`.
- "← Alla verktyg"-länkarna i `jamfor.tsx` och `kapitalmotor.tsx` tas bort. Startsidans kort behålls.
- Mobil: navet radbryts inte — loggan + två poster ryms; dropdownen hanterar mallistan.

## Etapp 2 — Enkla mallar (motortillägg: `savingsStartYear`)

**Motor** (`packages/engine/src/comparison.ts`): nytt valfritt fält `savingsStartYear?: number` på `StrategyInput` (default 0 = spara från år 1). År ≤ `savingsStartYear` sätts månadsinsättningen till 0 — gäller både riktiga insättningar och `frictionlessValue`-spåret, så friktionsjämförelsen förblir äpplen-mot-äpplen.

**Mallar** (`src/lib/templates.ts`, före "egen"):

- `tidigt` — "Börja tidigt eller vänta?": A sparar 3 000 kr/mån från år 1; B identisk men `savingsStartYear: 10`. 30 års horisont, startkapital 0. Explainer om tid i marknaden.
- `risk` — "Spara mer eller ta mer risk?": A 5 000 kr/mån @ 6 %; B 4 000 kr/mån @ 7 %. `lockDeposits: false`, 25 år. Explainer: mer sparande dominerar tidigt, högre avkastning sent — brytpunkten syns i grafen.

## Etapp 3 — Motorarbete + avancerade mallar

**Belåning** (`comparison.ts`): nya valfria fält `leverageOfEquity?: number` (lån/eget kapital, som kapitalmotorns konvention) och `loanRate?: number`.

- Mekanik per år, infogas i den låsta ordningen: exponering = kapital + lån; avkastning/avgift beräknas på exponerat belopp; ränta = lån × `loanRate` dras; ränteavdrag (via `interestDeduction`/`netTax` i `tax.ts`) nettas mot schablonskatten. Återbelåning årligen till mål-nivån, som kapitalmotorn.
- Deterministisk, ingen margin call. Mallens explainer varnar för risken och länkar till Kapitalmotorns stresstest/Monte Carlo.
- Mall `belaning` — "Belånat vs obelånat": samma portfölj, A obelånad, B `leverageOfEquity: 0.2`, `loanRate: 0.04`.

**Skattefri kontotyp** (`comparison.ts`): `ComparisonAccountType` utökas med `"none"` — ingen schablon, ingen utdelningsskatt, ingen latent skatt. Används för amortering.

- Mall `amortera` — "Amortera eller investera?": A "Investera" (ISK @ 7 %); B "Amortera" med `accountType: "none"`, `priceGrowth` = boränta × 0,7 (efter ränteavdrag, t.ex. 3,5 % × 0,7 = 2,45 %), inga avgifter. Explainer: amortering är en garanterad skattefri avkastning lika med nettoräntan; jämförelsen är deterministisk och fångar inte riskskillnaden.

**UI**: `strategy-column.tsx` får redigerare för de nya fälten när de ingår i mallens `highlightedFields`; inga nya komponenter.

## Testning

- Motortillägg: nya bun-tester i `packages/engine/test/comparison.test.ts` — `savingsStartYear` (0 insättningar före start, friktionsspåret följer), belåning (känd handräkning 2–3 år), `"none"`-konto (skatt = 0, latent = 0). Befintliga tester och dokumentreproduktionstestet röres ej.
- Router: enhetstest av `parseHash`-varianter om testfil finns; annars verifieras deep-links manuellt.
- UI: verifieras i dev-servern (nav-byten, aktiv markering, delningslänkar, legacy `?s=`).

## Avgränsningar

- Ingen margin call/stress i jämförelsemotorn — det bor kvar i kapitalmotorn/stress.ts.
- Startsidan behålls som den är (samma kort), navet är ett tillägg.
- Inga ändringar i `apps/web` (den fulla appen) — allt gäller `web-simple`.
