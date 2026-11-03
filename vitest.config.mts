import { defineConfig } from 'vitest/config';
import path from 'node:path';
import ts from 'typescript';

const { config } = ts.readConfigFile(path.resolve(import.meta.dirname, 'tsconfig.json'), ts.sys.readFile);
const alias = Object.fromEntries(Object.entries(config.compilerOptions.paths as Record<string, string[]>).map(([key, values]) => [key.replace(/\/\*$/, ''), path.resolve(import.meta.dirname, values[0].replace(/\/\*$/, ''))]));

export default defineConfig({
  resolve: { alias },
  test: {
    include: ['src/**/*.vitest.test.ts'],
    exclude: ['dist/**', 'node_modules/**']
  }
});
