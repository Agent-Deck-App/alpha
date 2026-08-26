import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The repository starts with no tests and gains them one work item at a
    // time. Without this, `pnpm test` fails on a clean checkout — which reads
    // as a broken harness rather than as an empty one.
    passWithNoTests: true,
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
  },
});
