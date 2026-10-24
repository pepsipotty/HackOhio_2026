import { defineConfig } from 'vitest/config'

export default defineConfig({
  build: {
    manifest: true,
    chunkSizeWarningLimit: 700, // the viewer is lazy-loaded and budget-checked
    rollupOptions: {
      input: { index: 'index.html', catalogue: 'catalogue.html', exercise: 'exercise.html' },
    },
  },
  test: { environment: 'node' },
})
