import { describe, expect, it } from "vitest";
import { withRepo } from "../fixtures.js";
import { detectPythonPackageManager } from "../index.js";

describe("detectPythonPackageManager", () => {
  it("maps uv.lock to uv's frozen sync command", async () => {
    await expect(
      withRepo({ "uv.lock": "version = 1\n" }, (root) => detectPythonPackageManager(root)),
    ).resolves.toEqual({
      packageManager: "uv",
      installCommand: "uv sync --frozen",
      lockfiles: ["uv.lock"],
    });
  });

  it("maps poetry.lock to Poetry's install command", async () => {
    await expect(
      withRepo({ "poetry.lock": "[[package]]\n" }, (root) => detectPythonPackageManager(root)),
    ).resolves.toEqual({
      packageManager: "poetry",
      installCommand: "poetry install",
      lockfiles: ["poetry.lock"],
    });
  });

  it("maps Pipfile.lock to Pipenv's synchronized install command", async () => {
    await expect(
      withRepo({ "Pipfile.lock": "{}\n" }, (root) => detectPythonPackageManager(root)),
    ).resolves.toEqual({
      packageManager: "pipenv",
      installCommand: "pipenv sync",
      lockfiles: ["Pipfile.lock"],
    });
  });

  it("maps requirements.txt to pip's requirements install command", async () => {
    await expect(
      withRepo({ "requirements.txt": "requests==2.32.0\n" }, (root) =>
        detectPythonPackageManager(root),
      ),
    ).resolves.toEqual({
      packageManager: "pip",
      installCommand: "pip install -r requirements.txt",
      lockfiles: [],
      requirements: true,
    });
  });

  it("identifies a setuptools build backend without a lockfile", async () => {
    await expect(
      withRepo(
        {
          "pyproject.toml":
            "[build-system]\nrequires = [\"setuptools>=61\"]\nbuild-backend = \"setuptools.build_meta\"\n",
        },
        (root) => detectPythonPackageManager(root),
      ),
    ).resolves.toEqual({
      packageManager: "pip",
      installCommand: "pip install .",
      lockfiles: [],
      pyproject: true,
      buildBackend: "setuptools.build_meta",
    });
  });

  it("uses a Poetry tool section when no lockfile is present", async () => {
    await expect(
      withRepo({ "pyproject.toml": "[tool.poetry]\nname = \"example\"\n" }, (root) =>
        detectPythonPackageManager(root),
      ),
    ).resolves.toEqual({
      packageManager: "poetry",
      installCommand: "poetry install",
      lockfiles: [],
      pyproject: true,
      tools: ["poetry"],
    });
  });

  it("keeps hash characters inside the build backend value", async () => {
    await expect(
      withRepo(
        {
          "pyproject.toml":
            "[build-system]\nbuild-backend = \"custom#backend\" # trailing comment\n",
        },
        (root) => detectPythonPackageManager(root),
      ),
    ).resolves.toEqual({
      packageManager: "pip",
      installCommand: "pip install .",
      lockfiles: [],
      pyproject: true,
      buildBackend: "custom#backend",
    });
  });

  it("lets a lockfile decide when pyproject.toml names another tool", async () => {
    await expect(
      withRepo(
        {
          "uv.lock": "version = 1\n",
          "pyproject.toml": "[tool.poetry]\nname = \"example\"\n",
        },
        (root) => detectPythonPackageManager(root),
      ),
    ).resolves.toEqual({
      packageManager: "uv",
      installCommand: "uv sync --frozen",
      lockfiles: ["uv.lock"],
      pyproject: true,
      tools: ["poetry"],
    });
  });

  it("reports multiple Python lockfiles as ambiguous", async () => {
    await expect(
      withRepo(
        {
          "uv.lock": "version = 1\n",
          "poetry.lock": "[[package]]\n",
        },
        (root) => detectPythonPackageManager(root),
      ),
    ).resolves.toEqual({
      lockfiles: ["uv.lock", "poetry.lock"],
      ambiguous: true,
    });
  });

  it("uses a matching pyproject tool to resolve multiple lockfiles", async () => {
    await expect(
      withRepo(
        {
          "uv.lock": "version = 1\n",
          "poetry.lock": "[[package]]\n",
          "pyproject.toml": "[tool.poetry]\nname = \"example\"\n",
        },
        (root) => detectPythonPackageManager(root),
      ),
    ).resolves.toEqual({
      packageManager: "poetry",
      installCommand: "poetry install",
      lockfiles: ["uv.lock", "poetry.lock"],
      pyproject: true,
      tools: ["poetry"],
    });
  });

  it("uses a nested uv tool section when no lockfile is present", async () => {
    await expect(
      withRepo(
        { "pyproject.toml": "[tool.uv.sources]\nexample = { git = \"url\" }\n" },
        (root) => detectPythonPackageManager(root),
      ),
    ).resolves.toEqual({
      packageManager: "uv",
      installCommand: "uv sync",
      lockfiles: [],
      pyproject: true,
      tools: ["uv"],
    });
  });

  it("does not let conflicting pyproject tools resolve multiple lockfiles", async () => {
    await expect(
      withRepo(
        {
          "uv.lock": "version = 1\n",
          "poetry.lock": "[[package]]\n",
          "pyproject.toml": "[tool.uv]\n[tool.poetry]\n",
        },
        (root) => detectPythonPackageManager(root),
      ),
    ).resolves.toEqual({
      lockfiles: ["uv.lock", "poetry.lock"],
      pyproject: true,
      tools: ["uv", "poetry"],
      ambiguous: true,
    });
  });

  it("reports conflicting pyproject tools as ambiguous without a lockfile", async () => {
    await expect(
      withRepo({ "pyproject.toml": "[tool.uv]\n[tool.poetry]\n" }, (root) =>
        detectPythonPackageManager(root),
      ),
    ).resolves.toEqual({
      lockfiles: [],
      pyproject: true,
      tools: ["uv", "poetry"],
      ambiguous: true,
    });
  });
});
