import { describe, expect, it } from "vitest";
import { withRepo } from "../fixtures.js";
import { detectPythonRubyVersions } from "../index.js";

describe("detectPythonRubyVersions", () => {
  it("returns null when neither version file exists", async () => {
    await expect(withRepo({}, (root) => detectPythonRubyVersions(root))).resolves.toBeNull();
  });

  it("reads all Python versions in order and ignores blank lines and comments", async () => {
    await expect(
      withRepo(
        { ".python-version": "  \n# preferred interpreters\n  3.12  \n3.11\n" },
        (root) => detectPythonRubyVersions(root),
      ),
    ).resolves.toEqual({
      python: ["3.12", "3.11"],
      files: {
        ".python-version": {
          status: "readable",
          values: ["3.12", "3.11"],
        },
      },
    });
  });

  it("reads a Ruby version and ignores blank lines and comments", async () => {
    await expect(
      withRepo(
        { ".ruby-version": "  \n# project Ruby\n  3.3.4  \n" },
        (root) => detectPythonRubyVersions(root),
      ),
    ).resolves.toEqual({
      ruby: "3.3.4",
      files: {
        ".ruby-version": { status: "readable", value: "3.3.4" },
      },
    });
  });
});
