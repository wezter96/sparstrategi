import { Toaster } from "@sparstrategi/ui/components/sonner";

import { ThemeProvider } from "@/components/theme-provider";
import { useView } from "@/lib/router";
import { KapitalmotorView } from "@/views/kapitalmotor";

export default function App() {
  const view = useView();
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      disableTransitionOnChange
      storageKey="vite-ui-theme"
    >
      {view === "kapitalmotor" ? (
        <KapitalmotorView />
      ) : (
        // Task 6 ersätter med <StartView />, Task 8 lägger till "jamfor"-grenen.
        <KapitalmotorView />
      )}
      <Toaster richColors />
    </ThemeProvider>
  );
}
