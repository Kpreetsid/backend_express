import { defineConfig } from 'vitest/config';

process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'silent';

/**
 * Repository-wide coverage ratchet.
 *
 * The focused configuration in vitest.config.ts keeps stronger per-file gates
 * on authentication, authorization, crypto, transaction and infrastructure
 * boundaries. This second configuration measures every executable TypeScript
 * source file so untested legacy domains cannot disappear from the reported
 * denominator. Raise these floors whenever repository coverage improves; the
 * enterprise target remains 60% initially and 80% after the legacy suites are
 * completed.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      thresholds: {
        statements: 60.8,
        branches: 50.5,
        functions: 62.6,
        lines: 61.4
      }
    }
  }
});
