import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  // Tauri expects a fixed port and must see Rust errors in the terminal
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  // simple-icons (~5 MB) is its own lazy chunk, loaded only when the icon picker opens;
  // a desktop app reads it from disk, so its size doesn't matter here
  build: { chunkSizeWarningLimit: 6000 },
})
