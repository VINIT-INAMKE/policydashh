import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      // Phase 21: enable app/**/__tests__ discovery for (public) route components
      'app/**/*.test.ts',
      'app/**/*.test.tsx',
    ],
    // Populate process.env with placeholders for every env var checked by
    // src/lib/env.ts + any module-load `requireEnv()` call. Keeps tests
    // that don't mock `@/src/db` from throwing during dynamic imports.
    // See tests/setup.ts.
    setupFiles: ['./tests/setup.ts'],
    passWithNoTests: true,
  },
})
