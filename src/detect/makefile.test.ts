import { describe, expect, it } from "vitest";
import { withRepo } from "../fixtures.js";
import { detectMakefile } from "../index.js";

describe("detectMakefile", () => {
  it("returns null when Makefile is absent", async () => {
    await expect(withRepo({}, (root) => detectMakefile(root))).resolves.toBeNull();
  });

  it("reports a present empty Makefile with no targets", async () => {
    await expect(
      withRepo({ Makefile: "" }, (root) => detectMakefile(root)),
    ).resolves.toEqual({ source: "Makefile", targets: [] });
  });

  it("extracts targets and recognises the standard make commands", async () => {
    await expect(
      withRepo(
        {
          Makefile: "test:\ncheck:\nbuild:\ninstall:\nrelease:\n",
        },
        (root) => detectMakefile(root),
      ),
    ).resolves.toEqual({
      source: "Makefile",
      targets: ["test", "check", "build", "install", "release"],
      test: "make test",
      check: "make check",
      build: "make build",
      install: "make install",
    });
  });

  it("does not treat the .PHONY declaration as a target", async () => {
    await expect(
      withRepo(
        { Makefile: ".PHONY: test\ntest:\n" },
        (root) => detectMakefile(root),
      ),
    ).resolves.toEqual({
      source: "Makefile",
      targets: ["test"],
      test: "make test",
    });
  });

  it("does not treat variable assignments as targets", async () => {
    await expect(
      withRepo(
        {
          Makefile: "CC = cc\nCFLAGS := -Wall\nMODE ?= debug\nSOURCES += source.c\noverride CPPFLAGS := -DDEBUG\nexport LDFLAGS = -static\n.DEFAULT_GOAL := test\ntest:\n",
        },
        (root) => detectMakefile(root),
      ),
    ).resolves.toEqual({
      source: "Makefile",
      targets: ["test"],
      test: "make test",
    });
  });

  it("does not treat pattern rules as targets", async () => {
    await expect(
      withRepo(
        { Makefile: "%.o: %.c\n%.test:\ntest:\n" },
        (root) => detectMakefile(root),
      ),
    ).resolves.toEqual({
      source: "Makefile",
      targets: ["test"],
      test: "make test",
    });
  });

  it("does not parse a tab-indented recipe body as a target", async () => {
    await expect(
      withRepo(
        { Makefile: "test:\n\tbuild: not-a-target\n" },
        (root) => detectMakefile(root),
      ),
    ).resolves.toEqual({
      source: "Makefile",
      targets: ["test"],
      test: "make test",
    });
  });

  it("ignores comments while extracting targets", async () => {
    await expect(
      withRepo(
        { Makefile: "# fake: target\ntest: # run the tests\n" },
        (root) => detectMakefile(root),
      ),
    ).resolves.toEqual({
      source: "Makefile",
      targets: ["test"],
      test: "make test",
    });
  });
});
