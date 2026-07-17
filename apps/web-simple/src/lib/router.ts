import { useEffect, useState } from "react";

export type View = "start" | "jamfor" | "kapitalmotor";

export const parseHash = (hash: string): View => {
  if (hash.startsWith("#/kapitalmotor")) return "kapitalmotor";
  if (hash.startsWith("#/jamfor")) return "jamfor";
  return "start";
};

/** Gamla dela-länkar (`?s=` utan hash) ska fortsätta öppna Kapitalmotorn. */
const initialView = (): View => {
  const byHash = parseHash(window.location.hash);
  if (window.location.hash === "" && new URLSearchParams(window.location.search).has("s")) {
    return "kapitalmotor";
  }
  return byHash;
};

export const navigate = (view: View): void => {
  window.location.hash = view === "start" ? "#/" : `#/${view}`;
};

export function useView(): View {
  const [view, setView] = useState<View>(initialView);
  useEffect(() => {
    const onChange = () => setView(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return view;
}
