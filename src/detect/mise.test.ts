import { describe, expect, it } from "vitest";
import { withRepo } from "../fixtures.js";
import { detectMise } from "../index.js";

describe("detectMise", () => {
  it("returns null when no mise config exists", async () => {
    await expect(withRepo({}, (root) => detectMise(root))).resolves.toBeNull();
  });

  it("reads tools from .mise.toml", async () => {
    await expect(
      withRepo({ ".mise.toml": "[tools]\nnode = \"22\"\n" }, (root) =>
        detectMise(root),
      ),
    ).resolves.toEqual({
      tools: {
        node: "22",
      },
      source: ".mise.toml",
    });
  });

  it("reads mise.toml when .mise.toml is absent", async () => {
    await expect(
      withRepo({ "mise.toml": "[tools]\nnode = \"22\"\n" }, (root) => detectMise(root)),
    ).resolves.toEqual({
      tools: {
        node: "22",
      },
      source: "mise.toml",
    });
  });

  it("uses the first version in a tool fallback array", async () => {
    await expect(
      withRepo({ ".mise.toml": "[tools]\npython = [\"3.12\", \"3.11\"]\n" }, (root) =>
        detectMise(root),
      ),
    ).resolves.toEqual({
      tools: {
        python: "3.12",
      },
      source: ".mise.toml",
    });
  });

  it("uses the version from a tool inline table", async () => {
    await expect(
      withRepo({ ".mise.toml": "[tools]\nnode = { version = \"22\" }\n" }, (root) =>
        detectMise(root),
      ),
    ).resolves.toEqual({
      tools: {
        node: "22",
      },
      source: ".mise.toml",
    });
  });

  it("takes the version from an inline table with other options", async () => {
    await expect(
      withRepo(
        { ".mise.toml": "[tools]\nnode = { runtime = \"node\", version = \"22\" }\n" },
        (root) => detectMise(root),
      ),
    ).resolves.toEqual({
      tools: {
        node: "22",
      },
      source: ".mise.toml",
    });
  });

  it("keeps hash characters inside quoted versions", async () => {
    await expect(
      withRepo({ ".mise.toml": "[tools]\nnode = \"22#lts\"\n" }, (root) => detectMise(root)),
    ).resolves.toEqual({
      tools: {
        node: "22#lts",
      },
      source: ".mise.toml",
    });
  });

  it("allows a trailing comma in a fallback array", async () => {
    await expect(
      withRepo({ ".mise.toml": "[tools]\npython = [\"3.12\", \"3.11\",]\n" }, (root) =>
        detectMise(root),
      ),
    ).resolves.toEqual({
      tools: {
        python: "3.12",
      },
      source: ".mise.toml",
    });
  });

  it("reads a multiline fallback array", async () => {
    await expect(
      withRepo(
        {
          ".mise.toml": "[tools]\npython = [\n  \"3.12\",\n  \"3.11\",\n]\n",
        },
        (root) => detectMise(root),
      ),
    ).resolves.toEqual({
      tools: {
        python: "3.12",
      },
      source: ".mise.toml",
    });
  });

  it("ignores assignments in other tables", async () => {
    await expect(
      withRepo(
        {
          ".mise.toml":
            "[env]\nnode = { version = \"not-a-tool\" }\n[tools]\nnode = \"22\"\n[settings]\npython = 3.11\n",
        },
        (root) => detectMise(root),
      ),
    ).resolves.toEqual({
      tools: {
        node: "22",
      },
      source: ".mise.toml",
    });
  });

  it("reports a tools syntax error with its line number", async () => {
    await expect(
      withRepo({ ".mise.toml": "[tools]\nnode =\n" }, (root) => detectMise(root)),
    ).rejects.toThrow(/line 2/i);
  });

  it("reports a malformed tools table header with its line number", async () => {
    await expect(
      withRepo({ ".mise.toml": "[tools\nnode = \"22\"\n" }, (root) => detectMise(root)),
    ).rejects.toThrow(/line 1/i);
  });

  it("reads the user config path when the root files are absent", async () => {
    await expect(
      withRepo(
        { ".config/mise/config.toml": "[tools]\nnode = \"22\"\n" },
        (root) => detectMise(root),
      ),
    ).resolves.toEqual({
      tools: {
        node: "22",
      },
      source: ".config/mise/config.toml",
    });
  });
});
