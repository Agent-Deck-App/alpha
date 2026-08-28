import { describe, expect, it } from "vitest";
import { withRepo } from "../fixtures.js";
import { detectPackageScripts } from "../index.js";

describe("detectPackageScripts", () => {
  it("prefixes recognised scripts with the detected package manager", async () => {
    await expect(
      withRepo(
        {
          "package.json": {
            scripts: {
              test: "vitest run",
              "test:unit": "vitest run unit",
              typecheck: "tsc --noEmit",
              lint: "eslint .",
              build: "tsc",
              format: "prettier --check .",
            },
          },
          "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
        },
        (root) => detectPackageScripts(root),
      ),
    ).resolves.toEqual({
      source: "package.json",
      packageManager: "pnpm",
      scripts: {
        test: "vitest run",
        "test:unit": "vitest run unit",
        typecheck: "tsc --noEmit",
        lint: "eslint .",
        build: "tsc",
        format: "prettier --check .",
      },
      test: "pnpm test",
      "test:unit": "pnpm test:unit",
      typecheck: "pnpm typecheck",
      lint: "pnpm lint",
      build: "pnpm build",
    });
  });

  it("does not report npm's placeholder test as a test command", async () => {
    await expect(
      withRepo(
        {
          "package.json": {
            scripts: {
              test: 'echo "Error: no test specified" && exit 1',
              typecheck: "tsc --noEmit",
            },
          },
          "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
        },
        (root) => detectPackageScripts(root),
      ),
    ).resolves.toEqual({
      source: "package.json",
      packageManager: "pnpm",
      scripts: {
        test: 'echo "Error: no test specified" && exit 1',
        typecheck: "tsc --noEmit",
      },
      typecheck: "pnpm typecheck",
    });
  });

  it("uses the packageManager declaration when no lockfile is present", async () => {
    await expect(
      withRepo(
        {
          "package.json": {
            packageManager: "npm@10.0.0",
            scripts: { test: "vitest run", lint: "eslint ." },
          },
        },
        (root) => detectPackageScripts(root),
      ),
    ).resolves.toEqual({
      source: "package.json",
      packageManager: "npm",
      scripts: { test: "vitest run", lint: "eslint ." },
      test: "npm test",
      lint: "npm run lint",
    });
  });

  it("reports malformed package.json without treating it as an empty scripts block", async () => {
    const report = await withRepo({ "package.json": "{\n" }, (root) =>
      detectPackageScripts(root),
    );

    expect(report).toMatchObject({
      source: "package.json",
      error: expect.any(String),
    });
    expect(report).not.toHaveProperty("scripts");
  });
});
