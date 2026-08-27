import { describe, expect, it } from "vitest";
import { withRepo } from "../fixtures.js";
import { detectContext } from "../index.js";

describe("detectContext", () => {
  it("returns null when no standing context files are present", async () => {
    await expect(withRepo({}, (root) => detectContext(root))).resolves.toBeNull();
  });

  it("collects a standing context file with its byte size and content", async () => {
    await expect(
      withRepo({ "AGENTS.md": "Keep tests focused.\n" }, (root) => detectContext(root)),
    ).resolves.toEqual({
      files: [{ path: "AGENTS.md", bytes: 20, content: "Keep tests focused.\n" }],
    });
  });

  it("collects all supported context files in the listed order", async () => {
    await expect(
      withRepo(
        {
          "AGENTS.md": "agents\n",
          "CLAUDE.md": "claude\n",
          ".cursorrules": "cursor\n",
          ".windsurfrules": "windsurf\n",
          ".github/copilot-instructions.md": "copilot\n",
          "README.md": "not standing context\n",
        },
        (root) => detectContext(root),
      ),
    ).resolves.toEqual({
      files: [
        { path: "AGENTS.md", bytes: 7, content: "agents\n" },
        { path: "CLAUDE.md", bytes: 7, content: "claude\n" },
        { path: ".cursorrules", bytes: 7, content: "cursor\n" },
        { path: ".windsurfrules", bytes: 9, content: "windsurf\n" },
        { path: ".github/copilot-instructions.md", bytes: 8, content: "copilot\n" },
      ],
    });
  });

  it("omits content for a context file above the inline size limit", async () => {
    const content = "x".repeat(100 * 1024 + 1);

    await expect(
      withRepo({ "CLAUDE.md": content }, (root) => detectContext(root)),
    ).resolves.toEqual({
      files: [{ path: "CLAUDE.md", bytes: 100 * 1024 + 1, contentOmitted: true }],
    });
  });
});
