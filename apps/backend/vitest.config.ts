import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts'],
    // The zip-bomb tests build 50 MB files first; on a busy machine that alone
    // can pass the 5 s default and fail them for time, not for a wrong result.
    testTimeout: 30_000,
  },
})