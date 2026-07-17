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
