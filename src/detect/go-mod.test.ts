import { describe, expect, it } from "vitest";
import { withRepo } from "../fixtures.js";
import { detectGoMod } from "../index.js";

describe("detectGoMod", () => {
  it("returns null when go.mod is absent", async () => {
    await expect(withRepo({}, (root) => detectGoMod(root))).resolves.toBeNull();
  });

  it("reports a go directive as a language-version floor", async () => {
    await expect(
      withRepo({ "go.mod": "module example.com/project\ngo 1.22\n" }, (root) =>
        detectGoMod(root),
      ),
    ).resolves.toEqual({
      go: { version: "1.22", kind: "language-floor" },
      source: "go.mod",
    });
  });

  it("reports a toolchain directive as a pinned toolchain", async () => {
    await expect(
      withRepo({ "go.mod": "module example.com/project\ntoolchain go1.22.5\n" }, (root) =>
        detectGoMod(root),
      ),
    ).resolves.toEqual({
      toolchain: { version: "go1.22.5", kind: "toolchain-pin" },
      source: "go.mod",
    });
  });

  it("reports the go floor and toolchain pin separately", async () => {
    await expect(
      withRepo(
        {
          "go.mod":
            "module example.com/project\ngo 1.22\ntoolchain go1.22.5\n",
        },
        (root) => detectGoMod(root),
      ),
    ).resolves.toEqual({
      go: { version: "1.22", kind: "language-floor" },
      toolchain: { version: "go1.22.5", kind: "toolchain-pin" },
      source: "go.mod",
    });
  });

  it("skips the module line and directives inside require blocks", async () => {
    await expect(
      withRepo(
        {
          "go.mod":
            "module go 9.99\ngo 1.22\ntoolchain go1.22.5\nrequire (\n\texample.com/dependency v1.0.0\n\tgo 9.99\n\ttoolchain go9.9.9\n)\n",
        },
        (root) => detectGoMod(root),
      ),
    ).resolves.toEqual({
      go: { version: "1.22", kind: "language-floor" },
      toolchain: { version: "go1.22.5", kind: "toolchain-pin" },
      source: "go.mod",
    });
  });

  it("allows whitespace and line comments on directives", async () => {
    await expect(
      withRepo(
        {
          "go.mod":
            "  go 1.22   // language floor\n  toolchain go1.22.5 // selected toolchain\n",
        },
        (root) => detectGoMod(root),
      ),
    ).resolves.toEqual({
      go: { version: "1.22", kind: "language-floor" },
      toolchain: { version: "go1.22.5", kind: "toolchain-pin" },
      source: "go.mod",
    });
  });
});
