import { describe, expect, it } from "vitest";
import { withRepo } from "./fixtures.js";
import { formatSummary, runCli } from "./cli.js";
import { probe } from "./index.js";

function captureOutput(): { output: { write: (chunk: string) => boolean }; text: () => string } {
  let contents = "";
  return {
    output: {
      write(chunk: string): boolean {
        contents += chunk;
        return true;
      },
    },
    text: () => contents,
  };
}

describe("formatSummary", () => {
  it("shows the useful parts of a repository report", async () => {
    await expect(
      withRepo(
        {
          ".nvmrc": "22\n",
          ".tool-versions": "node 20\n",
          "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
          "package.json": {
            name: "example",
            scripts: { test: "vitest run" },
            workspaces: ["packages/*"],
          },
          "packages/core/package.json": { name: "@example/core" },
          "AGENTS.md": "Keep tests focused.\n",
        },
        async (root) => formatSummary(await probe(root)),
      ),
    ).resolves.toBe(
      [
        "Toolchain:",
        "  node: 20 (.tool-versions)",
        "Install command: pnpm install --frozen-lockfile",
        "Test command: pnpm test",
        "Workspace packages:",
        "  - @example/core (packages/core)",
        "Instruction files:",
        "  - AGENTS.md",
        "Conflicts:",
        "  - toolchain.node: .tool-versions=20, .nvmrc=22 (winner: .tool-versions)",
      ].join("\n"),
    );
  });

  it("shows Rust and Ruby provisioning commands", async () => {
    await expect(
      withRepo(
        {
          "Cargo.toml": "[workspace]\n",
          Gemfile: "source \"https://rubygems.org\"\n",
        },
        async (root) => formatSummary(await probe(root)),
      ),
    ).resolves.toContain(
      ["Install command: cargo build", "Install command (ruby): bundle install", "Test command: cargo test"].join(
        "\n",
      ),
    );
  });
});

describe("runCli", () => {
  it("prints the raw report as JSON when requested", async () => {
    const stdout = captureOutput();

    const result = await withRepo(
      { ".nvmrc": "22\n" },
      async (root) => {
        const report = await probe(root);
        const code = await runCli(["--json", root], stdout.output, stdout.output);
        return { code, report };
      },
    );

    expect(result.code).toBe(0);
    expect(stdout.text()).toBe(`${JSON.stringify(result.report, null, 2)}\n`);
  });

  it("returns exit code 1 when the repository has no signals", async () => {
    const stdout = captureOutput();

    const code = await withRepo({}, (root) => runCli([root], stdout.output, stdout.output));

    expect(code).toBe(1);
  });

  it("uses the working directory when no path is supplied", async () => {
    const stdout = captureOutput();
    const originalDirectory = process.cwd();

    const result = await withRepo({ ".nvmrc": "22\n" }, async (root) => {
      process.chdir(root);
      try {
        return await runCli(["--json"], stdout.output, stdout.output);
      } finally {
        process.chdir(originalDirectory);
      }
    });

    expect(result).toBe(0);
    expect(JSON.parse(stdout.text())).toMatchObject({
      toolchain: { node: { node: "22" } },
    });
  });
});
