import { describe, expect, it } from "vitest";
import { withRepo } from "../fixtures.js";
import { detectDevContainer } from "../index.js";

describe("detectDevContainer", () => {
  it("returns null when neither dev container file exists", async () => {
    await expect(withRepo({}, (root) => detectDevContainer(root))).resolves.toBeNull();
  });

  it("reads an image from the standard dev container path as a declaration", async () => {
    await expect(
      withRepo(
        {
          ".devcontainer/devcontainer.json":
            '{"image":"mcr.microsoft.com/devcontainers/typescript-node:22"}',
        },
        (root) => detectDevContainer(root),
      ),
    ).resolves.toEqual({
      image: "mcr.microsoft.com/devcontainers/typescript-node:22",
      kind: "declaration",
      source: ".devcontainer/devcontainer.json",
    });
  });

  it("reads features, the post-create command, and the remote user", async () => {
    await expect(
      withRepo(
        {
          ".devcontainer/devcontainer.json": JSON.stringify({
            image: "node:22",
            features: {
              "ghcr.io/devcontainers/features/node:1": { version: "22" },
            },
            postCreateCommand: "pnpm install",
            remoteUser: "node",
          }),
        },
        (root) => detectDevContainer(root),
      ),
    ).resolves.toEqual({
      image: "node:22",
      features: {
        "ghcr.io/devcontainers/features/node:1": { version: "22" },
      },
      postCreateCommand: "pnpm install",
      remoteUser: "node",
      kind: "declaration",
      source: ".devcontainer/devcontainer.json",
    });
  });

  it("accepts comments and trailing commas in JSONC", async () => {
    await expect(
      withRepo(
        {
          ".devcontainer/devcontainer.json": `{
            // The image URL contains // and must stay intact.
            "image": "https://registry.example/devcontainer:22",
            "features": {
              "ghcr.io/devcontainers/features/node:1": {},
            },
            "postCreateCommand": ["pnpm", "install"],
            "remoteUser": "vscode",
          }`,
        },
        (root) => detectDevContainer(root),
      ),
    ).resolves.toEqual({
      image: "https://registry.example/devcontainer:22",
      features: {
        "ghcr.io/devcontainers/features/node:1": {},
      },
      postCreateCommand: ["pnpm", "install"],
      remoteUser: "vscode",
      kind: "declaration",
      source: ".devcontainer/devcontainer.json",
    });
  });

  it("reads a root-level devcontainer.json when the nested file is absent", async () => {
    await expect(
      withRepo(
        { ".devcontainer.json": '{"image":"ghcr.io/example/devcontainer:1"}' },
        (root) => detectDevContainer(root),
      ),
    ).resolves.toEqual({
      image: "ghcr.io/example/devcontainer:1",
      kind: "declaration",
      source: ".devcontainer.json",
    });
  });

  it("reports a malformed declaration with its parse error", async () => {
    await expect(
      withRepo({ ".devcontainer/devcontainer.json": "{\n" }, (root) =>
        detectDevContainer(root),
      ),
    ).resolves.toMatchObject({
      kind: "declaration",
      source: ".devcontainer/devcontainer.json",
      error: expect.stringContaining("property"),
    });
  });

  it("prefers the nested declaration when both paths are present", async () => {
    await expect(
      withRepo(
        {
          ".devcontainer/devcontainer.json": '{"image":"nested:1"}',
          ".devcontainer.json": '{"image":"root:1"}',
        },
        (root) => detectDevContainer(root),
      ),
    ).resolves.toEqual({
      image: "nested:1",
      kind: "declaration",
      source: ".devcontainer/devcontainer.json",
    });
  });
});
