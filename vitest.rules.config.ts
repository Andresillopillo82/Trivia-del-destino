import { defineConfig } from 'vitest/config'

/** Prueba de integración de firestore.rules contra el proyecto real (npm run test:rules). */
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.int.test.ts'],
    environment: 'node',
    testTimeout: 15_000,
    fileParallelism: false,
  },
})
