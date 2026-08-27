import { describe, expect, it } from "vitest";
import { withRepo } from "../fixtures.js";
import { detectSkills } from "../index.js";

describe("detectSkills", () => {
  it("returns null when the skills directory is absent", async () => {
    await expect(withRepo({}, (root) => detectSkills(root))).resolves.toBeNull();
  });

  it("reports a skill without frontmatter as malformed by path", async () => {
    const report = await withRepo(
      { ".claude/skills/plain/SKILL.md": "# This skill has no metadata\n" },
      (root) => detectSkills(root),
    );

    expect(report).toMatchObject({
      source: ".claude/skills",
      skills: [],
      malformed: [{ path: ".claude/skills/plain/SKILL.md" }],
    });
  });

  it("ignores skill directories that do not contain SKILL.md", async () => {
    await expect(
      withRepo(
        {
          ".claude/skills/README.md": "not a skill",
          ".claude/skills/documentation/README.md": "not a skill",
          ".claude/skills/valid/SKILL.md": `---
name: valid
description: A valid skill.
---
`,
        },
        (root) => detectSkills(root),
      ),
    ).resolves.toMatchObject({
      skills: [
        {
          path: ".claude/skills/valid/SKILL.md",
          name: "valid",
          description: "A valid skill.",
        },
      ],
      malformed: [],
    });
  });

  it("reports a frontmatter entry without a description as malformed", async () => {
    await expect(
      withRepo(
        {
          ".claude/skills/missing-description/SKILL.md": `---
name: missing-description
description: # deliberately empty
---
`,
        },
        (root) => detectSkills(root),
      ),
    ).resolves.toMatchObject({
      skills: [],
      malformed: [{ path: ".claude/skills/missing-description/SKILL.md" }],
    });
  });

  it("reports a null description as malformed", async () => {
    await expect(
      withRepo(
        {
          ".claude/skills/null-description/SKILL.md": `---
name: null-description
description: null
---
`,
        },
        (root) => detectSkills(root),
      ),
    ).resolves.toMatchObject({
      skills: [],
      malformed: [{ path: ".claude/skills/null-description/SKILL.md" }],
    });
  });

  it("reports an empty block description as malformed", async () => {
    await expect(
      withRepo(
        {
          ".claude/skills/empty-block/SKILL.md": `---
name: empty-block
description: |
---
`,
        },
        (root) => detectSkills(root),
      ),
    ).resolves.toMatchObject({
      skills: [],
      malformed: [{ path: ".claude/skills/empty-block/SKILL.md" }],
    });
  });

  it("parses quoted frontmatter values as YAML scalars", async () => {
    await expect(
      withRepo(
        {
          ".claude/skills/quoted/SKILL.md": `---
name: "quoted-skill"
description: 'Use this skill: carefully.'
---
Body
`,
        },
        (root) => detectSkills(root),
      ),
    ).resolves.toMatchObject({
      skills: [
        {
          path: ".claude/skills/quoted/SKILL.md",
          name: "quoted-skill",
          description: "Use this skill: carefully.",
        },
      ],
    });
  });

  it("parses a multiline YAML description", async () => {
    await expect(
      withRepo(
        {
          ".claude/skills/multiline/SKILL.md": `---
name: multiline
description: >
  Use this skill when the task needs
  several related operations.
---
Body
`,
        },
        (root) => detectSkills(root),
      ),
    ).resolves.toMatchObject({
      skills: [
        {
          path: ".claude/skills/multiline/SKILL.md",
          name: "multiline",
          description: "Use this skill when the task needs several related operations.\n",
        },
      ],
    });
  });

  it("indexes each skill's frontmatter without returning its body", async () => {
    const report = await withRepo(
      {
        ".claude/skills/review/SKILL.md": `---
name: code-review
description: Review code changes carefully.
---

# Code review instructions

This body is not metadata.
`,
        ".claude/skills/deploy/SKILL.md": `---
name: deploy
description: Deploy the application.
---

Use the deployment checklist.
`,
      },
      (root) => detectSkills(root),
    );

    expect(report).toMatchObject({
      source: ".claude/skills",
      skills: [
        {
          path: ".claude/skills/deploy/SKILL.md",
          name: "deploy",
          description: "Deploy the application.",
        },
        {
          path: ".claude/skills/review/SKILL.md",
          name: "code-review",
          description: "Review code changes carefully.",
        },
      ],
    });
    expect(report?.skills).not.toContainEqual(expect.objectContaining({ body: expect.anything() }));
  });
});
