import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withRepo } from "./fixtures.js";

describe("withRepo", () => {
  it("materializes files and cleans up after the callback", async () => {
    let root = "";

    await expect(
      withRepo({ "package.json": "{}" }, async (directory) => {
        root = directory;
        return readFile(join(directory, "package.json"), "utf8");
      }),
    ).resolves.toBe("{}");

    await expect(access(root)).rejects.toThrow();
  });

  it("writes object values as formatted JSON", async () => {
    const packageJson = { name: "fixture", private: true };

    await expect(
      withRepo({ "package.json": packageJson }, async (root) =>
        readFile(join(root, "package.json"), "utf8"),
      ),
    ).resolves.toBe(JSON.stringify(packageJson, null, 2));
  });

  it("creates parent directories for nested paths", async () => {
    await expect(
      withRepo({ ".github/workflows/ci.yml": "name: CI\n" }, async (root) =>
        readFile(join(root, ".github/workflows/ci.yml"), "utf8"),
      ),
    ).resolves.toBe("name: CI\n");
  });

  it("cleans up when the callback throws", async () => {
    let root = "";
    const failure = new Error("fixture callback failed");

    await expect(
      withRepo({ "package.json": "{}" }, async (directory) => {
        root = directory;
        throw failure;
      }),
    ).rejects.toBe(failure);

    await expect(access(root)).rejects.toThrow();
  });
});
