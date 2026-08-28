import { describe, expect, it } from "vitest";
import { withRepo } from "../fixtures.js";
import { detectTurbo } from "../index.js";

describe("detectTurbo", () => {
  it("reads every task and its dependencies from the tasks graph", async () => {
    await expect(
      withRepo(
        {
          "turbo.json": {
            "$schema": "https://turbo.build/schema.json",
            "tasks": {
              build: {},
              lint: { dependsOn: ["^lint"] },
              test: { dependsOn: ["lint"] },
            },
          },
        },
        (root) => detectTurbo(root),
      ),
    ).resolves.toEqual({
      source: "turbo.json",
      tasks: {
        build: { dependsOn: [] },
        lint: { dependsOn: ["^lint"] },
        test: { dependsOn: ["lint"] },
      },
    });
  });

  it("flags tasks whose dependency chain reaches build", async () => {
    await expect(
      withRepo(
        {
          "turbo.json": {
            "tasks": {
              build: { dependsOn: ["^build"] },
              compile: { dependsOn: ["^build"] },
              test: { dependsOn: ["compile"] },
              docs: {},
            },
          },
        },
        (root) => detectTurbo(root),
      ),
    ).resolves.toEqual({
      source: "turbo.json",
      tasks: {
        build: { dependsOn: ["^build"], requiresBuild: true },
        compile: { dependsOn: ["^build"], requiresBuild: true },
        test: { dependsOn: ["compile"], requiresBuild: true },
        docs: { dependsOn: [] },
      },
    });
  });

  it("reports task environment declarations", async () => {
    await expect(
      withRepo(
        {
          "turbo.json": {
            "tasks": {
              test: {
                env: ["API_TOKEN", "DATABASE_URL"],
                passThroughEnv: ["AWS_PROFILE"],
              },
            },
          },
        },
        (root) => detectTurbo(root),
      ),
    ).resolves.toEqual({
      source: "turbo.json",
      tasks: {
        test: {
          dependsOn: [],
          env: ["API_TOKEN", "DATABASE_URL"],
          passThroughEnv: ["AWS_PROFILE"],
        },
      },
    });
  });

  it("reads the legacy pipeline graph", async () => {
    await expect(
      withRepo(
        {
          "turbo.json": {
            pipeline: {
              build: {},
              test: { dependsOn: ["^build"] },
            },
          },
        },
        (root) => detectTurbo(root),
      ),
    ).resolves.toEqual({
      source: "turbo.json",
      tasks: {
        build: { dependsOn: [] },
        test: { dependsOn: ["^build"], requiresBuild: true },
      },
    });
  });

  it("reports a malformed turbo.json with its parse error", async () => {
    await expect(
      withRepo({ "turbo.json": "{\n" }, (root) => detectTurbo(root)),
    ).resolves.toEqual({
      source: "turbo.json",
      error: expect.any(String),
    });
  });
});
