import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// This config lives in eval/, but the suites import from ../src/app/core/*, so
// we pin the Vite project root to the repo root. That makes both the test glob
// (eval/**) and the ../src imports resolve no matter what directory vitest is
// invoked from, and lets it find node_modules at the repo root.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
  root: repoRoot,
  test: {
    include: ['eval/**/*.eval.ts'],
    environment: 'node',
    // The suites read the drift report from stdout; keep vitest from swallowing it.
    disableConsoleIntercept: true,
    reporters: ['default'],
  },
});
