import { Toaster } from "@sparstrategi/ui/components/sonner";

import { ThemeProvider } from "@/components/theme-provider";
import { TopNav } from "@/components/top-nav";
import { useRoute } from "@/lib/router";
import { JamforView } from "@/views/jamfor";
import { KapitalmotorView } from "@/views/kapitalmotor";
import { StartView } from "@/views/start";
import { UttagView } from "@/views/uttag";

export default function App() {
  const route = useRoute();
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      disableTransitionOnChange
      storageKey="vite-ui-theme"
    >
      <TopNav route={route} />
      {route.view === "kapitalmotor" ? (
        <KapitalmotorView />
      ) : route.view === "jamfor" ? (
        <JamforView />
      ) : route.view === "uttag" ? (
        <UttagView />
      ) : (
        <StartView />
      )}
      <Toaster richColors />
    </ThemeProvider>
  );
}
