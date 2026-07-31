import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative, so one build works everywhere it might be served from: a domain
  // root, a GitHub Pages subpath like /PISO/, and file:// inside the APK.
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
  build: { outDir: 'dist' },
})
