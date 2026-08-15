import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy all /api and /ws requests to the FastAPI backend during local dev
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
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
