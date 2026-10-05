import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Vite >= 5.4.12 blocks requests whose Host header isn't localhost/an IP.
    // Sandbox/preview URLs (e.g. 5173-<id>.e2b.app) are proxied to this dev
    // server, so without this the preview would answer 403 "Blocked request".
    allowedHosts: ['.e2b.app'],
    proxy: {
      // Proxy all /api and /ws requests to the FastAPI backend during local dev
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'charts-vendor': ['lightweight-charts', 'chart.js', 'react-chartjs-2'],
          'react-vendor': ['react', 'react-dom', 'zustand', 'axios'],
          'ui-icons': ['lucide-react', 'react-hot-toast'],
        },
      },
    },
  },
})
