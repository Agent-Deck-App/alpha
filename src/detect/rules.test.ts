import { describe, expect, it } from "vitest";
import { withRepo } from "../fixtures.js";
import { detectRules } from "../index.js";

describe("detectRules", () => {
  it("returns null when neither rule directory exists", async () => {
    await expect(withRepo({}, (root) => detectRules(root))).resolves.toBeNull();
  });

  it("reports a matching file without valid frontmatter as malformed", async () => {
    await expect(
      withRepo(
        { ".cursor/rules/broken.mdc": "# This is not a rule frontmatter document.\n" },
        (root) => detectRules(root),
      ),
    ).resolves.toMatchObject({
      rules: [],
      malformed: [{ path: ".cursor/rules/broken.mdc" }],
    });
  });

  it("indexes a Cursor rule's description, path, and glob", async () => {
    await expect(
      withRepo(
        {
          ".cursor/rules/typescript.mdc": `---
description: TypeScript conventions
globs: "**/*.ts"
---
Use strict TypeScript.
`,
        },
        (root) => detectRules(root),
      ),
    ).resolves.toMatchObject({
      rules: [
        {
          path: ".cursor/rules/typescript.mdc",
          description: "TypeScript conventions",
          globs: "**/*.ts",
        },
      ],
    });
  });

  it("indexes a Copilot instruction's description, path, and glob", async () => {
    await expect(
      withRepo(
        {
          ".github/instructions/testing.instructions.md": `---
description: Testing conventions
applyTo: "**/*.test.ts"
---
Run the focused tests first.
`,
        },
        (root) => detectRules(root),
      ),
    ).resolves.toMatchObject({
      rules: [
        {
          path: ".github/instructions/testing.instructions.md",
          description: "Testing conventions",
          applyTo: "**/*.test.ts",
        },
      ],
    });
  });

  it("returns null for a rule without a glob rather than treating it as malformed", async () => {
    await expect(
      withRepo(
        {
          ".cursor/rules/general.mdc": `---
description: General conventions
alwaysApply: true
---
Use the general conventions.
`,
        },
        (root) => detectRules(root),
      ),
    ).resolves.toMatchObject({
      rules: [
        {
          path: ".cursor/rules/general.mdc",
          description: "General conventions",
          globs: null,
        },
      ],
      malformed: [],
    });
  });

  it("indexes matching files from both directories and ignores other files", async () => {
    const report = await withRepo(
      {
        ".cursor/rules/z-last.mdc": `---
description: Last Cursor rule
globs: src/**/generated.ts
---
`,
        ".cursor/rules/a-first.mdc": `---
description: First Cursor rule
globs: src/**/*.ts
---
`,
        ".cursor/rules/README.md": "Not a rule.",
        ".github/instructions/review.instructions.md": `---
description: Review instructions
applyTo: "**/*"
---
`,
        ".github/instructions/notes.md": "Not an instruction.",
      },
      (root) => detectRules(root),
    );

    expect(report).toEqual({
      rules: [
        {
          path: ".cursor/rules/a-first.mdc",
          description: "First Cursor rule",
          globs: "src/**/*.ts",
        },
        {
          path: ".cursor/rules/z-last.mdc",
          description: "Last Cursor rule",
          globs: "src/**/generated.ts",
        },
        {
          path: ".github/instructions/review.instructions.md",
          description: "Review instructions",
          applyTo: "**/*",
        },
      ],
      malformed: [],
    });
  });

  it("parses quoted metadata and ignores comments without changing the glob", async () => {
    await expect(
      withRepo(
        {
          ".cursor/rules/quoted.mdc": `---
description: "Use # comments: carefully" # metadata comment
globs: '**/*.ts #literal' # metadata comment
---
`,
        },
        (root) => detectRules(root),
      ),
    ).resolves.toMatchObject({
      rules: [
        {
          description: "Use # comments: carefully",
          globs: "**/*.ts #literal",
        },
      ],
    });
  });

  it("reads a multiline rule description from frontmatter", async () => {
    await expect(
      withRepo(
        {
          ".cursor/rules/multiline.mdc": `---
description: >
  Apply these conventions when
  editing TypeScript files.
globs: **/*.ts
---
`,
        },
        (root) => detectRules(root),
      ),
    ).resolves.toMatchObject({
      rules: [
        {
          description: "Apply these conventions when editing TypeScript files.\n",
          globs: "**/*.ts",
        },
      ],
    });
  });
});
