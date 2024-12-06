import { defineConfig, defineWorkspace, mergeConfig } from 'vitest/config';

const configShared = defineConfig({
  test: {
    clearMocks: true,
    globals: true,
  },
});

export default defineWorkspace([
  // unit test
  mergeConfig(configShared, {
    test: {
      name: 'unit',
      environment: 'node',
      include: ['**/*.spec.{ts,js}'],
      exclude: ['node_modules/**', 'dist/**', '**/*.d.ts', '**/*.integration.spec.ts'],
    },
  }),

  // integration test
  // mergeConfig(configShared, {
  //   test: {
  //     name: 'integration',
  //     environment: 'node',
  //     include: ['dist', '**/*.integration.spec.ts'],
  //     exclude: ['node_modules/**', 'dist/**', '**/*.d.ts'],
  //   },
  // }),
]);
