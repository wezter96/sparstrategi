import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Relative base so the build works unmodified under any GitHub Pages project
// path (https://<user>.github.io/<repo>/) without hardcoding the repo name.
export default defineConfig({
  base: "./",
  server: {
    port: 5174,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [tailwindcss(), react()],
});
