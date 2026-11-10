import { defineConfig } from 'vite'

// base './' hace que dist/ funcione desde cualquier carpeta (itch.io sirve el ZIP en una subruta).
export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5173 },
  build: { target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 1200, sourcemap: false },
})
