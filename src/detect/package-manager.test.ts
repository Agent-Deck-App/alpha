import { describe, expect, it } from "vitest";
import { withRepo } from "../fixtures.js";
import { detectPackageManager } from "../index.js";

describe("detectPackageManager", () => {
  it("returns null when no lockfile or package.json is present", async () => {
    await expect(withRepo({}, (root) => detectPackageManager(root))).resolves.toBeNull();
  });

  it("maps a pnpm lockfile to its frozen install command", async () => {
    await expect(
      withRepo({ "pnpm-lock.yaml": "lockfileVersion: '9.0'\n" }, (root) =>
        detectPackageManager(root),
      ),
    ).resolves.toEqual({
      packageManager: "pnpm",
      installCommand: "pnpm install --frozen-lockfile",
      lockfiles: ["pnpm-lock.yaml"],
    });
  });

  it("maps package-lock.json to npm ci", async () => {
    await expect(
      withRepo({ "package-lock.json": "{}\n" }, (root) => detectPackageManager(root)),
    ).resolves.toEqual({
      packageManager: "npm",
      installCommand: "npm ci",
      lockfiles: ["package-lock.json"],
    });
  });

  it("maps yarn.lock to Yarn's immutable install command", async () => {
    await expect(
      withRepo({ "yarn.lock": "# yarn lockfile v1\n" }, (root) => detectPackageManager(root)),
    ).resolves.toEqual({
      packageManager: "yarn",
      installCommand: "yarn install --immutable",
      lockfiles: ["yarn.lock"],
    });
  });

  it("maps bun.lockb to Bun's frozen install command", async () => {
    await expect(
      withRepo({ "bun.lockb": "" }, (root) => detectPackageManager(root)),
    ).resolves.toEqual({
      packageManager: "bun",
      installCommand: "bun install --frozen-lockfile",
      lockfiles: ["bun.lockb"],
    });
  });

  it("reports package.json when no lockfile is present", async () => {
    await expect(
      withRepo({ "package.json": {} }, (root) => detectPackageManager(root)),
    ).resolves.toEqual({
      lockfiles: [],
      packageJson: true,
    });
  });

  it("reports every lockfile instead of choosing between them", async () => {
    await expect(
      withRepo(
        {
          "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
          "package-lock.json": "{}\n",
        },
        (root) => detectPackageManager(root),
      ),
    ).resolves.toEqual({
      lockfiles: ["pnpm-lock.yaml", "package-lock.json"],
      ambiguous: true,
    });
  });

  it("uses packageManager to resolve multiple lockfiles", async () => {
    await expect(
      withRepo(
        {
          "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
          "package-lock.json": "{}\n",
          "package.json": { packageManager: "pnpm@10.32.1" },
        },
        (root) => detectPackageManager(root),
      ),
    ).resolves.toEqual({
      packageManager: "pnpm",
      installCommand: "pnpm install --frozen-lockfile",
      lockfiles: ["pnpm-lock.yaml", "package-lock.json"],
    });
  });

  it("does not use an incomplete packageManager declaration to resolve a tie", async () => {
    await expect(
      withRepo(
        {
          "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
          "package-lock.json": "{}\n",
          "package.json": { packageManager: "pnpm" },
        },
        (root) => detectPackageManager(root),
      ),
    ).resolves.toEqual({
      lockfiles: ["pnpm-lock.yaml", "package-lock.json"],
      ambiguous: true,
    });
  });
});
