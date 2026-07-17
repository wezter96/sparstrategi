import { Toaster } from "@sparstrategi/ui/components/sonner";

import { ThemeProvider } from "@/components/theme-provider";
import { useRoute } from "@/lib/router";
import { JamforView } from "@/views/jamfor";
import { KapitalmotorView } from "@/views/kapitalmotor";
import { StartView } from "@/views/start";

export default function App() {
  const route = useRoute();
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      disableTransitionOnChange
      storageKey="vite-ui-theme"
    >
      {route.view === "kapitalmotor" ? (
        <KapitalmotorView />
      ) : route.view === "jamfor" ? (
        <JamforView />
      ) : (
        <StartView />
      )}
      <Toaster richColors />
    </ThemeProvider>
  );
}
