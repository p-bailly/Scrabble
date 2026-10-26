/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Chemins relatifs : l'app fonctionne aussi bien à la racine d'un domaine
// que dans un sous-dossier (ex. GitHub Pages : /Scrabble/).
export default defineConfig({
  base: './',
  plugins: [react()],
  // Date de construction, affichée dans les réglages pour savoir quelle version tourne.
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
  worker: { format: 'es' },
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 30000,
  },
})
