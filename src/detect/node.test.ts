import { describe, expect, it } from "vitest";
import { withRepo } from "../fixtures.js";
import { detectNodeVersion } from "../index.js";

describe("detectNodeVersion", () => {
  it("returns null when neither version file exists", async () => {
    await expect(withRepo({}, (root) => detectNodeVersion(root))).resolves.toBeNull();
  });

  it("reads a .nvmrc and records its source", async () => {
    await expect(
      withRepo({ ".nvmrc": "22\n" }, (root) => detectNodeVersion(root)),
    ).resolves.toEqual({
      node: "22",
      source: ".nvmrc",
      files: {
        ".nvmrc": { status: "readable", value: "22" },
      },
    });
  });

  it("reads .node-version when .nvmrc is absent", async () => {
    await expect(
      withRepo({ ".node-version": "v22.14.0\n" }, (root) => detectNodeVersion(root)),
    ).resolves.toEqual({
      node: "v22.14.0",
      source: ".node-version",
      files: {
        ".node-version": { status: "readable", value: "v22.14.0" },
      },
    });
  });

  it("ignores comment lines and surrounding whitespace", async () => {
    await expect(
      withRepo(
        { ".nvmrc": "  \n# use the LTS release\n  lts/iron  \n" },
        (root) => detectNodeVersion(root),
      ),
    ).resolves.toEqual({
      node: "lts/iron",
      source: ".nvmrc",
      files: {
        ".nvmrc": { status: "readable", value: "lts/iron" },
      },
    });
  });

  it("reports an empty file as seen but unreadable", async () => {
    await expect(
      withRepo({ ".nvmrc": "  \n# no version here\n" }, (root) => detectNodeVersion(root)),
    ).resolves.toEqual({
      files: {
        ".nvmrc": { status: "unreadable" },
      },
    });
  });

  it("reports an unparseable file as seen but unreadable", async () => {
    await expect(
      withRepo({ ".node-version": "not-a-node-version\n" }, (root) =>
        detectNodeVersion(root),
      ),
    ).resolves.toEqual({
      files: {
        ".node-version": { status: "unreadable" },
      },
    });
  });

  it("prefers .nvmrc and reports both files when both are present", async () => {
    await expect(
      withRepo(
        { ".nvmrc": "22\n", ".node-version": "lts/iron\n" },
        (root) => detectNodeVersion(root),
      ),
    ).resolves.toEqual({
      node: "22",
      source: ".nvmrc",
      files: {
        ".nvmrc": { status: "readable", value: "22" },
        ".node-version": { status: "readable", value: "lts/iron" },
      },
    });
  });
});
