import { describe, expect, it } from "vitest";
import { withRepo } from "../fixtures.js";
import { detectWorkspace } from "../index.js";

describe("detectWorkspace", () => {
  it("returns null when there is no workspace or package manifest", async () => {
    await expect(withRepo({}, (root) => detectWorkspace(root))).resolves.toBeNull();
  });

  it("resolves pnpm workspace globs to named package directories", async () => {
    await expect(
      withRepo(
        {
          "pnpm-workspace.yaml": `packages:
  - "packages/*"
`,
          "packages/alpha/package.json": { name: "@example/alpha" },
          "packages/beta/package.json": { name: "@example/beta" },
          "packages/not-a-package/README.md": "not a package",
        },
        (root) => detectWorkspace(root),
      ),
    ).resolves.toEqual({
      kind: "monorepo",
      source: "pnpm-workspace.yaml",
      globs: ["packages/*"],
      packages: [
        { path: "packages/alpha", name: "@example/alpha" },
        { path: "packages/beta", name: "@example/beta" },
      ],
    });
  });

  it("accepts a JSON-compatible inline pnpm workspace document", async () => {
    await expect(
      withRepo(
        {
          "pnpm-workspace.yaml": '{"packages":["modules/*"]}',
          "modules/cli/package.json": { name: "cli" },
        },
        (root) => detectWorkspace(root),
      ),
    ).resolves.toEqual({
      kind: "monorepo",
      source: "pnpm-workspace.yaml",
      globs: ["modules/*"],
      packages: [{ path: "modules/cli", name: "cli" }],
    });
  });

  it("applies recursive and negated workspace globs", async () => {
    await expect(
      withRepo(
        {
          "pnpm-workspace.yaml": `packages:
  - "packages/**"
  - "!packages/**/fixtures"
`,
          "packages/one/package.json": { name: "one" },
          "packages/nested/two/package.json": { name: "two" },
          "packages/nested/fixtures/package.json": { name: "fixtures" },
        },
        (root) => detectWorkspace(root),
      ),
    ).resolves.toEqual({
      kind: "monorepo",
      source: "pnpm-workspace.yaml",
      globs: ["packages/**", "!packages/**/fixtures"],
      packages: [
        { path: "packages/nested/two", name: "two" },
        { path: "packages/one", name: "one" },
      ],
    });
  });

  it("resolves an array of package.json workspaces", async () => {
    await expect(
      withRepo(
        {
          "package.json": { name: "root", workspaces: ["apps/*"] },
          "apps/web/package.json": { name: "web" },
          "apps/docs/package.json": { name: "docs" },
        },
        (root) => detectWorkspace(root),
      ),
    ).resolves.toEqual({
      kind: "monorepo",
      source: "package.json",
      globs: ["apps/*"],
      packages: [
        { path: "apps/docs", name: "docs" },
        { path: "apps/web", name: "web" },
      ],
    });
  });

  it("resolves the packages array in an object-form package.json workspace", async () => {
    await expect(
      withRepo(
        {
          "package.json": {
            name: "root",
            workspaces: { packages: ["packages/*"], nohoist: ["**/fixtures"] },
          },
          "packages/core/package.json": { name: "core" },
        },
        (root) => detectWorkspace(root),
      ),
    ).resolves.toEqual({
      kind: "monorepo",
      source: "package.json",
      globs: ["packages/*"],
      packages: [{ path: "packages/core", name: "core" }],
    });
  });

  it("reports a repository with only its root package as a single package", async () => {
    await expect(
      withRepo({ "package.json": { name: "standalone" } }, (root) => detectWorkspace(root)),
    ).resolves.toEqual({
      kind: "single-package",
      source: "package.json",
      packages: [{ path: ".", name: "standalone" }],
    });
  });

  it("keeps an explicitly empty workspace distinct from a single package", async () => {
    await expect(
      withRepo(
        {
          "package.json": { name: "workspace-root" },
          "pnpm-workspace.yaml": "packages: []\n",
        },
        (root) => detectWorkspace(root),
      ),
    ).resolves.toEqual({
      kind: "monorepo",
      source: "pnpm-workspace.yaml",
      globs: [],
      packages: [],
    });
  });

  it("recognises an Nx workspace and indexes its package manifests", async () => {
    await expect(
      withRepo(
        {
          "nx.json": {},
          "apps/web/package.json": { name: "web" },
          "libs/shared/package.json": { name: "shared" },
        },
        (root) => detectWorkspace(root),
      ),
    ).resolves.toEqual({
      kind: "monorepo",
      source: "nx.json",
      packages: [
        { path: "apps/web", name: "web" },
        { path: "libs/shared", name: "shared" },
      ],
    });
  });

  it("does not treat an Nx root package as a standalone package", async () => {
    await expect(
      withRepo(
        {
          "package.json": { name: "workspace-root", private: true },
          "nx.json": {},
          "apps/web/package.json": { name: "web" },
        },
        (root) => detectWorkspace(root),
      ),
    ).resolves.toMatchObject({
      kind: "monorepo",
      source: "nx.json",
      packages: [{ path: "apps/web", name: "web" }],
    });
  });

  it("uses Nx workspaceLayout directories when they are configured", async () => {
    await expect(
      withRepo(
        {
          "nx.json": { workspaceLayout: { appsDir: "projects", libsDir: "packages" } },
          "projects/site/package.json": { name: "site" },
          "packages/core/package.json": { name: "core" },
        },
        (root) => detectWorkspace(root),
      ),
    ).resolves.toEqual({
      kind: "monorepo",
      source: "nx.json",
      packages: [
        { path: "packages/core", name: "core" },
        { path: "projects/site", name: "site" },
      ],
    });
  });

  it("finds Nx packages outside the default app and library directories", async () => {
    await expect(
      withRepo(
        {
          "nx.json": {},
          "packages/tool/package.json": { name: "tool" },
        },
        (root) => detectWorkspace(root),
      ),
    ).resolves.toEqual({
      kind: "monorepo",
      source: "nx.json",
      packages: [{ path: "packages/tool", name: "tool" }],
    });
  });

  it("reports a malformed package manifest instead of treating it as absent", async () => {
    await expect(
      withRepo({ "package.json": "{\n" }, (root) => detectWorkspace(root)),
    ).resolves.toMatchObject({
      source: "package.json",
      error: expect.any(String),
    });
  });
});
