import { describe, expect, it } from "vitest";
import { withRepo } from "../fixtures.js";
import { detectPackageJson } from "../index.js";

describe("detectPackageJson", () => {
  it("returns null when package.json is absent", async () => {
    await expect(withRepo({}, (root) => detectPackageJson(root))).resolves.toBeNull();
  });

  it("reads the package manager name and version", async () => {
    await expect(
      withRepo({ "package.json": { packageManager: "pnpm@10.32.1" } }, (root) =>
        detectPackageJson(root),
      ),
    ).resolves.toEqual({
      packageManager: { name: "pnpm", version: "10.32.1" },
      source: "package.json",
    });
  });

  it("strips the corepack integrity suffix from the package manager version", async () => {
    await expect(
      withRepo(
        { "package.json": { packageManager: "pnpm@10.32.1+sha256.0123456789abcdef" } },
        (root) => detectPackageJson(root),
      ),
    ).resolves.toEqual({
      packageManager: { name: "pnpm", version: "10.32.1" },
      source: "package.json",
    });
  });

  it("returns the Node engine range without parsing it", async () => {
    await expect(
      withRepo(
        { "package.json": { engines: { node: ">=20.11.0 <21" } } },
        (root) => detectPackageJson(root),
      ),
    ).resolves.toEqual({
      engines: { node: ">=20.11.0 <21" },
      source: "package.json",
    });
  });

  it("reports a malformed package.json with its parse error", async () => {
    await expect(
      withRepo({ "package.json": "{\n" }, (root) => detectPackageJson(root)),
    ).resolves.toMatchObject({
      source: "package.json",
      error: expect.stringContaining("property"),
    });
  });
});
