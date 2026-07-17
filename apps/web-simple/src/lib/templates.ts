import { defaultStrategyInput, type StrategyInput } from "@sparstrategi/engine";

export interface ComparisonTemplate {
  id: string;
  title: string;
  /** En menings fråga på mallkortet. */
  question: string;
  /** "Varför blir det så här?" — visas under grafen. */
  explainer: string;
  assumptions: { startCapital: number; monthlySavings: number; horizonYears: number };
  strategies: StrategyInput[];
  /** Fält som visas expanderade/markerade i strategikolumnerna. */
  highlightedFields: ReadonlyArray<keyof StrategyInput>;
  /** false endast för DCA-mallen: tillåt per-strategi-insättningar. */
  lockDeposits: boolean;
}

const s = defaultStrategyInput;

export const templates: ComparisonTemplate[] = [
  {
    id: "avgift",
    title: "Vad kostar fondavgiften?",
    question: "Indexfond 0,2 % mot aktiv fond 1,5 % — samma bruttoavkastning.",
    explainer:
      "Avgiften dras varje år ur avkastningen, så den drabbar även all tidigare tillväxt. " +
      "Skillnaden växer därför exponentiellt med tiden: 1,3 procentenheter låter lite, men på " +
      "30 år äter den ofta upp en fjärdedel av slutvärdet. Titta på raden \"Betalt i avgifter\" — " +
      "och notera att den underskattar den verkliga förlusten, eftersom varje betald avgiftskrona " +
      "också hade fortsatt växa.",
    assumptions: { startCapital: 100_000, monthlySavings: 3_000, horizonYears: 30 },
    strategies: [
      { ...s("Indexfond"), fundFeeRate: 0.002 },
      { ...s("Aktiv fond"), fundFeeRate: 0.015 },
    ],
    highlightedFields: ["fundFeeRate"],
    lockDeposits: true,
  },
  {
    id: "konto",
    title: "ISK, AF eller KF?",
    question: "Samma portfölj i tre sparformer — schablonskatt mot reavinstskatt.",
    explainer:
      "ISK och KF schablonbeskattas varje år oavsett resultat (skattesatsen styrs av " +
      "statslåneräntan), medan AF beskattas med 30 % först när du säljer med vinst — och på " +
      "utdelningar direkt. Vid hög avkastning vinner ISK, vid låg avkastning kan AF vinna. ISK " +
      "har dessutom ett skattefritt golv på 300 000 kr (2026) som KF saknar. Dra i förväntad " +
      "avkastning och se brytpunkten flytta sig.",
    assumptions: { startCapital: 200_000, monthlySavings: 3_000, horizonYears: 20 },
    strategies: [
      { ...s("ISK"), priceGrowth: 0.05, dividendYield: 0.02 },
      { ...s("AF (depå)"), accountType: "af", priceGrowth: 0.05, dividendYield: 0.02 },
      { ...s("KF"), accountType: "kf", priceGrowth: 0.05, dividendYield: 0.02 },
    ],
    highlightedFields: ["accountType", "priceGrowth", "dividendYield"],
    lockDeposits: true,
  },
  {
    id: "utdelning",
    title: "Tillväxtaktier eller utdelningsaktier?",
    question: "Samma totalavkastning, olika fördelning mellan kurs och utdelning.",
    explainer:
      "På ISK är strategierna nästan exakt likvärdiga när utdelningen återinvesteras — " +
      "schablonskatten bryr sig inte om hur avkastningen kommer. Skillnaden uppstår på en " +
      "vanlig depå (AF), där utdelningar beskattas med 30 % varje år medan kursvinster får " +
      "växa obeskattade tills du säljer. Byt kontotyp till AF på båda och se gapet öppna sig. " +
      "Utländsk källskatt kan dessutom läcka på ISK om schablonskatten är för låg för full " +
      "avräkning — testa 15 % källskatt.",
    assumptions: { startCapital: 100_000, monthlySavings: 2_000, horizonYears: 25 },
    strategies: [
      { ...s("Tillväxt"), priceGrowth: 0.07, dividendYield: 0 },
      { ...s("Utdelning"), priceGrowth: 0.03, dividendYield: 0.04 },
    ],
    highlightedFields: [
      "priceGrowth",
      "dividendYield",
      "reinvestDividends",
      "foreignWithholdingRate",
      "accountType",
    ],
    lockDeposits: true,
  },
  {
    id: "courtage",
    title: "Ombalansering & courtage",
    question: "Månadsspara i en fond, eller i åtta aktier med årlig ombalansering?",
    explainer:
      "Åtta aktieköp i månaden betalar minimicourtage åtta gånger — på små belopp kan det bli " +
      "flera procent av insättningen. Lägg till spread och årlig ombalansering (sälj + köp) " +
      "så växer friktionen. På en depå (AF) tillkommer den dolda stora kostnaden: varje " +
      "ombalansering realiserar vinst och tidigarelägger 30 % skatt. En fond ombalanserar " +
      "internt utan att du betalar courtage eller utlöser skatt.",
    assumptions: { startCapital: 20_000, monthlySavings: 2_000, horizonYears: 20 },
    strategies: [
      { ...s("En indexfond"), fundFeeRate: 0.002 },
      {
        ...s("8 aktier"),
        fundFeeRate: 0,
        holdingsCount: 8,
        courtageFlat: 5,
        courtageRate: 0.0025,
        rebalancesPerYear: 1,
        turnoverShare: 0.2,
        spreadRate: 0.001,
      },
    ],
    highlightedFields: [
      "holdingsCount",
      "courtageFlat",
      "courtageRate",
      "rebalancesPerYear",
      "turnoverShare",
      "spreadRate",
      "accountType",
    ],
    lockDeposits: true,
  },
  {
    id: "dca",
    title: "Engångsköp eller månadssparande?",
    question: "Sätta in allt direkt, eller sprida ut det över tiden?",
    explainer:
      "Rent matematiskt vinner engångsköpet så länge förväntad avkastning är positiv — " +
      "pengarna är investerade längre. Månadssparandets värde är beteendemässigt och " +
      "riskmässigt: du undviker att pricka en topp med hela beloppet. Jämförelsen här är " +
      "deterministisk (samma avkastning varje år) och visar därför bara tidskostnaden, inte " +
      "riskspridningen.",
    assumptions: { startCapital: 0, monthlySavings: 5_000, horizonYears: 10 },
    strategies: [
      {
        ...s("Engångsköp"),
        startCapitalOverride: 600_000,
        monthlySavingsOverride: 0,
      },
      { ...s("Månadssparande") },
    ],
    highlightedFields: ["startCapitalOverride", "monthlySavingsOverride"],
    lockDeposits: false,
  },
  {
    id: "egen",
    title: "Egen jämförelse",
    question: "Börja från ett blankt läge och ställ in allt själv.",
    explainer:
      "Två identiska strategier att utgå ifrån — ändra det du vill jämföra. Alla parametrar " +
      "är öppna: avkastningens fördelning, avgifter, sparform, courtage och ombalansering.",
    assumptions: { startCapital: 100_000, monthlySavings: 2_000, horizonYears: 20 },
    strategies: [s("Strategi A"), s("Strategi B")],
    highlightedFields: [],
    lockDeposits: true,
  },
];

export const templateById = (id: string): ComparisonTemplate =>
  templates.find((t) => t.id === id) ?? templates.at(-1)!;
