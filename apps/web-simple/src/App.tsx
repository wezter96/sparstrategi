import { Toaster } from "@sparstrategi/ui/components/sonner";

import { ThemeProvider } from "@/components/theme-provider";
import { useView } from "@/lib/router";
import { KapitalmotorView } from "@/views/kapitalmotor";
import { StartView } from "@/views/start";

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
      ) : view === "start" ? (
        <StartView />
      ) : (
        // Task 8: <JamforView />
        <StartView />
      )}
      <Toaster richColors />
    </ThemeProvider>
  );
}
