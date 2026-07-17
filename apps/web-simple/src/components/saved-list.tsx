import { Trash2Icon } from "lucide-react";
import { useState } from "react";

import {
  deleteScenario,
  listSaved,
  openScenario,
  type SavedScenario,
} from "@/lib/saved";

const KIND_LABELS: Record<SavedScenario["kind"], string> = {
  jamfor: "Jämförelse",
  kapitalmotor: "Kapitalmotor",
  uttag: "Uttag",
};

export function SavedList() {
  const [items, setItems] = useState<SavedScenario[]>(listSaved);
  if (items.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
        Sparade scenarier
      </h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-2 rounded-xl border bg-card p-3"
          >
            <button
              type="button"
              onClick={() => openScenario(s)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="truncate text-sm font-semibold">{s.name}</div>
              <div className="text-xs text-muted-foreground">
                {KIND_LABELS[s.kind]} · {new Date(s.savedAt).toLocaleDateString("sv-SE")}
              </div>
            </button>
            <button
              type="button"
              aria-label={`Ta bort ${s.name}`}
              onClick={() => {
                deleteScenario(s.id);
                setItems(listSaved());
              }}
            >
              <Trash2Icon className="size-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Sparas endast lokalt i din webbläsare (localStorage) — inget skickas till någon server.
      </p>
    </section>
  );
}
