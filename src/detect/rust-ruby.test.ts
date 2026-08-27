import { describe, expect, it } from "vitest";
import { withRepo } from "../fixtures.js";
import { detectRustRubyProjects } from "../index.js";

describe("detectRustRubyProjects", () => {
  it("returns null when neither ecosystem has a project file", async () => {
    await expect(withRepo({}, (root) => detectRustRubyProjects(root))).resolves.toBeNull();
  });

  it("detects a Cargo project and its build and test commands", async () => {
    await expect(
      withRepo({ "Cargo.toml": "[package]\nname = \"example\"\n" }, (root) =>
        detectRustRubyProjects(root),
      ),
    ).resolves.toEqual({
      cargo: {
        installCommand: "cargo build",
        testCommand: "cargo test",
        source: "Cargo.toml",
      },
    });
  });

  it("notes a Cargo workspace", async () => {
    await expect(
      withRepo({ "Cargo.toml": "[workspace]\nmembers = [\"crates/*\"]\n" }, (root) =>
        detectRustRubyProjects(root),
      ),
    ).resolves.toMatchObject({
      cargo: {
        installCommand: "cargo build",
        testCommand: "cargo test",
        source: "Cargo.toml",
        workspace: true,
      },
    });
  });

  it("detects a Gemfile and uses Bundler to install it", async () => {
    await expect(
      withRepo({ Gemfile: "source \"https://rubygems.org\"\n" }, (root) =>
        detectRustRubyProjects(root),
      ),
    ).resolves.toEqual({
      ruby: {
        installCommand: "bundle install",
        files: ["Gemfile"],
      },
    });
  });

  it("detects a lockfile even when it is the only Ruby project file", async () => {
    await expect(
      withRepo({ "Gemfile.lock": "GEM\n  specs:\n" }, (root) => detectRustRubyProjects(root)),
    ).resolves.toEqual({
      ruby: {
        installCommand: "bundle install",
        files: ["Gemfile.lock"],
      },
    });
  });

  it("reports both ecosystems and all Ruby evidence", async () => {
    await expect(
      withRepo(
        {
          "Cargo.toml": "[workspace]\n",
          Gemfile: "source \"https://rubygems.org\"\n",
          "Gemfile.lock": "GEM\n",
        },
        (root) => detectRustRubyProjects(root),
      ),
    ).resolves.toEqual({
      cargo: {
        installCommand: "cargo build",
        testCommand: "cargo test",
        source: "Cargo.toml",
        workspace: true,
      },
      ruby: {
        installCommand: "bundle install",
        files: ["Gemfile", "Gemfile.lock"],
      },
    });
  });

  it("does not treat a nested workspace table as the workspace declaration", async () => {
    await expect(
      withRepo({ "Cargo.toml": "[workspace.package]\nedition = \"2021\"\n" }, (root) =>
        detectRustRubyProjects(root),
      ),
    ).resolves.toEqual({
      cargo: {
        installCommand: "cargo build",
        testCommand: "cargo test",
        source: "Cargo.toml",
      },
    });
  });
});
