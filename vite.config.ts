// Build: 2026-06-26 nat
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite as tanstackStart } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tanstackStart({
      server: { entry: "server", preset: "cloudflare-workers" },
    }),
    react(),
    tailwindcss(),
    tsConfigPaths(),
  ],
});
