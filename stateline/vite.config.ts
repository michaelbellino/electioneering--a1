/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@engine': fileURLToPath(new URL('./src/engine', import.meta.url)),
      '@data': fileURLToPath(new URL('./src/data', import.meta.url)),
      '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // UI/component tests opt into jsdom via a per-file pragma:
    //   // @vitest-environment jsdom
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/engine/**', 'src/data/**'],
    },
  },
})
