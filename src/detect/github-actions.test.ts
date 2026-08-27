import { describe, expect, it } from "vitest";
import { withRepo } from "../fixtures.js";
import { detectGitHubActions, GitHubActionsYamlSyntaxError } from "../index.js";

describe("detectGitHubActions", () => {
  it("returns null when the workflows directory is absent", async () => {
    await expect(withRepo({}, (root) => detectGitHubActions(root))).resolves.toBeNull();
  });

  it("extracts run steps from every workflow in job order", async () => {
    await expect(
      withRepo(
        {
          ".github/workflows/ci.yml": `name: CI
on:
  push:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: Run tests
        run: pnpm test
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm lint
`,
          ".github/workflows/release.yaml": `name: Release
on: push
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Publish
        run: pnpm publish
`,
          ".github/workflows/ignored.txt": "not a workflow",
        },
        (root) => detectGitHubActions(root),
      ),
    ).resolves.toEqual({
      source: ".github/workflows",
      workflows: [
        {
          file: ".github/workflows/ci.yml",
          name: "CI",
          triggers: ["push"],
          steps: [
            { job: "test", name: "Install dependencies", run: "pnpm install --frozen-lockfile" },
            { job: "test", name: "Run tests", run: "pnpm test" },
            { job: "lint", run: "pnpm lint" },
          ],
        },
        {
          file: ".github/workflows/release.yaml",
          name: "Release",
          triggers: ["push"],
          steps: [{ job: "publish", name: "Publish", run: "pnpm publish" }],
        },
      ],
      test: "pnpm test",
      testWorkflow: ".github/workflows/ci.yml",
    });
  });

  it("preserves multi-line run blocks", async () => {
    await expect(
      withRepo(
        {
          ".github/workflows/ci.yml": `on: pull_request
jobs:
  test:
    steps:
      - name: Test suite
        run: |
          pnpm install --frozen-lockfile
          pnpm test
`,
        },
        (root) => detectGitHubActions(root),
      ),
    ).resolves.toEqual({
      source: ".github/workflows",
      workflows: [
        {
          file: ".github/workflows/ci.yml",
          triggers: ["pull_request"],
          steps: [
            {
              job: "test",
              name: "Test suite",
              run: "pnpm install --frozen-lockfile\npnpm test\n",
            },
          ],
        },
      ],
      test: "pnpm install --frozen-lockfile\npnpm test\n",
      testWorkflow: ".github/workflows/ci.yml",
    });
  });

  it("selects a push or pull-request workflow containing a test invocation", async () => {
    await expect(
      withRepo(
        {
          ".github/workflows/release.yml": `on: push
jobs:
  release:
    steps:
      - run: pnpm publish
`,
          ".github/workflows/check.yaml": `name: Checks
on: pull_request
jobs:
  test:
    steps:
      - name: Run tests
        run: pnpm test
`,
          ".github/workflows/nightly.yml": `on: schedule
jobs:
  nightly:
    steps:
      - run: pnpm test
`,
        },
        (root) => detectGitHubActions(root),
      ),
    ).resolves.toMatchObject({
      source: ".github/workflows",
      test: "pnpm test",
      testWorkflow: ".github/workflows/check.yaml",
    });
  });

  it("marks run steps that require unavailable CI facilities", async () => {
    await expect(
      withRepo(
        {
          ".github/workflows/ci.yml": `on: push
jobs:
  test:
    services:
      postgres:
        image: postgres:16
    steps:
      - name: Start containers
        run: docker compose up -d
      - name: Run tests
        env:
          TOKEN: \${{ secrets.TOKEN }}
        run: pnpm test
`,
        },
        (root) => detectGitHubActions(root),
      ),
    ).resolves.toMatchObject({
      workflows: [
        {
          steps: [
            {
              job: "test",
              name: "Start containers",
              run: "docker compose up -d",
              unavailable: ["services", "docker"],
            },
            {
              job: "test",
              name: "Run tests",
              run: "pnpm test",
              unavailable: ["services", "secrets"],
            },
          ],
        },
      ],
    });
  });

  it("rejects YAML outside the supported subset", async () => {
    await expect(
      withRepo(
        {
          ".github/workflows/ci.yml": `on: push
jobs:
  test:
    steps:
      - run: >
          pnpm test
`,
        },
        (root) => detectGitHubActions(root),
      ),
    ).rejects.toBeInstanceOf(GitHubActionsYamlSyntaxError);
  });
});
