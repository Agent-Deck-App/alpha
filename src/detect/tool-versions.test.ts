import { describe, expect, it } from "vitest";
import { withRepo } from "../fixtures.js";
import { detectToolVersions } from "../index.js";

describe("detectToolVersions", () => {
  it("returns null when .tool-versions is absent", async () => {
    await expect(withRepo({}, (root) => detectToolVersions(root))).resolves.toBeNull();
  });

  it("reports an empty file as present", async () => {
    await expect(
      withRepo({ ".tool-versions": "\n# no tools declared\n" }, (root) =>
        detectToolVersions(root),
      ),
    ).resolves.toEqual({
      tools: {},
      source: ".tool-versions",
    });
  });

  it("reads the active version for each tool", async () => {
    await expect(
      withRepo(
        { ".tool-versions": "nodejs 22.14.0\npnpm 10.32.1\n" },
        (root) => detectToolVersions(root),
      ),
    ).resolves.toEqual({
      tools: {
        nodejs: "22.14.0",
        pnpm: "10.32.1",
      },
      source: ".tool-versions",
    });
  });

  it("ignores blank lines and comments", async () => {
    await expect(
      withRepo(
        {
          ".tool-versions": "\n# tools used by the project\nnodejs 22.14.0 # active Node\n",
        },
        (root) => detectToolVersions(root),
      ),
    ).resolves.toEqual({
      tools: {
        nodejs: "22.14.0",
      },
      source: ".tool-versions",
    });
  });

  it("uses the first version when a tool lists fallbacks", async () => {
    await expect(
      withRepo({ ".tool-versions": "nodejs 22.14.0 20.18.3\n" }, (root) =>
        detectToolVersions(root),
      ),
    ).resolves.toEqual({
      tools: {
        nodejs: "22.14.0",
      },
      source: ".tool-versions",
    });
  });

  it("keeps tools it does not recognise", async () => {
    await expect(
      withRepo({ ".tool-versions": "zig 0.13.0\n" }, (root) => detectToolVersions(root)),
    ).resolves.toEqual({
      tools: {
        zig: "0.13.0",
      },
      source: ".tool-versions",
    });
  });
});
