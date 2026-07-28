/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    // Le bind mount Windows -> conteneur ne relaie pas toujours les evenements
    // inotify : sans le polling, Vite peut continuer a servir une version
    // en cache d'un fichier pourtant modifie sur le disque.
    watch: { usePolling: true },
    proxy: {
      // En dev, le serveur Vite proxifie /api vers nginx (meme reseau docker) —
      // le navigateur ne voit qu'une seule origine (localhost:5173), comme en
      // prod ou nginx sert le frontend ET l'API sur le meme host:port. Evite
      // d'avoir a configurer CORS cote Laravel.
      '/api': {
        target: 'http://nginx',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/vite-env.d.ts', 'src/**/*.test.{ts,tsx}', 'src/setupTests.ts'],
      thresholds: {
        lines: 75,
        statements: 75,
        functions: 75,
        branches: 60,
      },
    },
  },
})
