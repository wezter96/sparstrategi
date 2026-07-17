/**
 * Sparade scenarier i localStorage. Payloaden är samma btoa-kodade state som
 * dela-länkarna använder — att öppna ett sparat scenario är att navigera till
 * motsvarande dela-URL (querystring + hash) och ladda om, så parse-vägen är
 * exakt densamma som för delade länkar (inkl. bakåtkompatibilitet).
 */
export type SavedKind = "jamfor" | "kapitalmotor" | "uttag";

export interface SavedScenario {
  id: string;
  name: string;
  kind: SavedKind;
  /** btoa-payload (samma som dela-länkens queryparam). */
  payload: string;
  /** För jamfor: mall-id till hashen. */
  templateId?: string;
  savedAt: string;
}

const KEY = "sparstrategi.saved.v1";

const QUERY_PARAM: Record<SavedKind, string> = {
  jamfor: "j",
  kapitalmotor: "s",
  uttag: "u",
};

export const listSaved = (): SavedScenario[] => {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as SavedScenario[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const write = (items: SavedScenario[]): void => {
  localStorage.setItem(KEY, JSON.stringify(items));
};

export const saveScenario = (
  item: Omit<SavedScenario, "id" | "savedAt">,
): SavedScenario => {
  const saved: SavedScenario = {
    ...item,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
  };
  write([saved, ...listSaved()]);
  return saved;
};

export const deleteScenario = (id: string): void => {
  write(listSaved().filter((s) => s.id !== id));
};

/** URL som återställer scenariot — samma form som dela-länkarna. */
export const scenarioUrl = (s: SavedScenario): string => {
  const hash =
    s.kind === "jamfor" ? `#/jamfor/${s.templateId ?? "egen"}` : `#/${s.kind}`;
  return `${window.location.origin}${window.location.pathname}?${QUERY_PARAM[s.kind]}=${encodeURIComponent(s.payload)}${hash}`;
};

export const openScenario = (s: SavedScenario): void => {
  // Full sidladdning krävs: state-atomerna initieras från querystringen.
  window.location.assign(scenarioUrl(s));
};
