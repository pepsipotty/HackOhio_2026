import { defineConfig } from 'vitest/config'

export default defineConfig({
  build: {
    manifest: true,
    rollupOptions: {
      input: { index: 'index.html', catalogue: 'catalogue.html', exercise: 'exercise.html' },
    },
  },
  test: { environment: 'node' },
})
