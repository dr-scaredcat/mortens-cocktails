// Build: 2026-06-26 nat
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  publicDir: "public",
  plugins: [
    tanstackStart({
      server: { entry: "server", preset: "cloudflare-workers" },
    }),
    react(),
    tailwindcss(),
    tsConfigPaths(),
  ],
});
