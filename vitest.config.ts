import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'

const env = loadEnv('', process.cwd(), '')

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      SUPABASE_URL: env.SUPABASE_URL ?? '',
      SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY ?? '',
      SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      GOOGLE_SERVICE_ACCOUNT_JSON: env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '',
      GEMINI_API_KEY: env.GEMINI_API_KEY ?? '',
    },
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
})
