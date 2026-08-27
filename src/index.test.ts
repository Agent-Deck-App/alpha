import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { probe } from "./index.js";

describe("probe", () => {
  it("returns an empty report for an empty directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "repo-probe-"));

    try {
      await expect(probe(root)).resolves.toEqual({});
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
