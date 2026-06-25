import { defineConfig } from 'vite'
import { tanstackRouterPlugin } from '@tanstack/router-plugin'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    tanstackRouterPlugin(),
    react(),
    tsconfigPaths()
  ],
})
