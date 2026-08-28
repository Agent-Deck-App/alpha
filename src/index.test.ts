import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withRepo } from "./fixtures.js";
import { probe } from "./index.js";

describe("probe", () => {
  it("returns an empty report for an empty directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "repo-probe-"));

    try {
      await expect(probe(root)).resolves.toEqual({});
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("composes detector reports into their sections", async () => {
    await expect(
      withRepo(
        {
          ".nvmrc": "20\n",
          "package.json": { name: "example" },
        },
        (root) => probe(root),
      ),
    ).resolves.toMatchObject({
      toolchain: {
        node: {
          node: "20",
          source: ".nvmrc",
        },
      },
      packageManager: {
        packageJson: { source: "package.json" },
      },
      workspace: {
        workspace: { kind: "single-package" },
      },
    });
  });

  it("reports the winning toolchain source and every conflicting value", async () => {
    await expect(
      withRepo(
        {
          ".nvmrc": "20\n",
          ".tool-versions": "node 22\n",
          ".mise.toml": "[tools]\nnode = \"24\"\n",
          "package.json": { engines: { node: ">=18" } },
        },
        (root) => probe(root),
      ),
    ).resolves.toMatchObject({
      toolchain: {
        resolved: { node: "24" },
        conflicts: [
          {
            field: "node",
            sources: [
              { source: ".mise.toml", value: "24" },
              { source: ".tool-versions", value: "22" },
              { source: ".nvmrc", value: "20" },
              { source: "package.json#engines.node", value: ">=18" },
            ],
            winner: ".mise.toml",
          },
        ],
      },
    });
  });

  it("reports a failed detector without losing other sections", async () => {
    await expect(
      withRepo(
        {
          ".mise.toml": "[tools]\nnode = [\n",
          ".nvmrc": "20\n",
          "Makefile": "test:\n",
        },
        (root) => probe(root),
      ),
    ).resolves.toMatchObject({
      toolchain: {
        node: { node: "20" },
        mise: { status: "failed", error: expect.any(String) },
      },
      commands: {
        makefile: { test: "make test" },
      },
    });
  });

  it("prefers a lockfile over a packageManager declaration and reports the conflict", async () => {
    await expect(
      withRepo(
        {
          "package.json": { packageManager: "npm@10.0.0" },
          "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
        },
        (root) => probe(root),
      ),
    ).resolves.toMatchObject({
      packageManager: {
        resolved: {
          javascript: {
            packageManager: "pnpm",
            installCommand: "pnpm install --frozen-lockfile",
          },
        },
        conflicts: [
          {
            field: "javascript",
            sources: [
              { source: "pnpm-lock.yaml", value: "pnpm" },
              { source: "package.json#packageManager", value: "npm" },
            ],
            winner: "pnpm-lock.yaml",
          },
        ],
      },
    });
  });

  it("applies the version precedence to Python and Ruby declarations", async () => {
    await expect(
      withRepo(
        {
          ".python-version": "3.10\n",
          ".ruby-version": "3.2\n",
          ".tool-versions": "python 3.11\nruby 3.3\n",
          ".mise.toml": "[tools]\npython = \"3.12\"\nruby = \"3.4\"\n",
        },
        (root) => probe(root),
      ),
    ).resolves.toMatchObject({
      toolchain: {
        resolved: { python: "3.12", ruby: "3.4" },
        conflicts: [
          {
            field: "python",
            winner: ".mise.toml",
          },
          {
            field: "ruby",
            winner: ".mise.toml",
          },
        ],
      },
    });
  });

  it("prefers an explicit package script over an inferred workflow test command", async () => {
    await expect(
      withRepo(
        {
          "package.json": {
            packageManager: "pnpm@10.0.0",
            scripts: { test: "vitest run" },
          },
          ".github/workflows/ci.yml": `on: push
jobs:
  test:
    steps:
      - run: npm test
`,
        },
        (root) => probe(root),
      ),
    ).resolves.toMatchObject({
      commands: {
        resolved: { test: "pnpm test" },
        conflicts: [
          {
            field: "test",
            sources: [
              { source: "package.json#scripts.test", value: "pnpm test" },
              { source: ".github/workflows/ci.yml", value: "npm test" },
            ],
            winner: "package.json#scripts.test",
          },
        ],
      },
    });
  });
});
