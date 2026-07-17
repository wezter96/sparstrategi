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
    // Utelämnat id lämnas medvetet undefined så att en `?j=`-payload utan
    // hash-id inte skrivs över av mall-synken.
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
