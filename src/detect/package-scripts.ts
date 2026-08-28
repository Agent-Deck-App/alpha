import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PackageManagerName } from "./package-manager.js";

const lockfileManagers: Record<string, PackageManagerName> = {
  "pnpm-lock.yaml": "pnpm",
  "package-lock.json": "npm",
  "yarn.lock": "yarn",
  "bun.lockb": "bun",
};

const lockfileNames = Object.keys(lockfileManagers);

export type PackageScriptsFileName = "package.json";
export type PackageScriptName = "test" | "test:unit" | "typecheck" | "lint" | "build";

export interface PackageScriptsReport extends Record<string, unknown> {
  packageManager?: PackageManagerName;
  scripts?: Record<string, string>;
  test?: string;
  "test:unit"?: string;
  typecheck?: string;
  lint?: string;
  build?: string;
  source: PackageScriptsFileName;
  error?: string;
}

const scriptNames = ["test", "test:unit", "typecheck", "lint", "build"] as const;

function parsePackageManagerName(value: unknown): PackageManagerName | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.replace(/\+sha\d+\.[A-Za-z0-9]+$/, "");
  const separator = normalized.lastIndexOf("@");
  if (separator <= 0 || separator === normalized.length - 1) {
    return undefined;
  }

  const name = normalized.slice(0, separator);
  return name === "pnpm" || name === "npm" || name === "yarn" || name === "bun"
    ? name
    : undefined;
}

function readScripts(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const scripts: Record<string, string> = {};
  for (const [name, command] of Object.entries(value)) {
    if (typeof command === "string") {
      scripts[name] = command;
    }
  }

  return scripts;
}

function isPlaceholderTest(command: string): boolean {
  return /^echo\s+[\"']Error: no test specified[\"'](?:\s*&&\s*exit\s+1)?\s*$/.test(command);
}

function commandForScript(packageManager: PackageManagerName, name: PackageScriptName): string {
  if (packageManager === "npm" && name !== "test") {
    return `npm run ${name}`;
  }

  if (packageManager === "bun") {
    return `bun run ${name}`;
  }

  return `${packageManager} ${name}`;
}

async function detectPackageManager(
  root: string,
  declared: PackageManagerName | undefined,
): Promise<PackageManagerName | undefined> {
  const lockfiles: string[] = [];

  for (const filename of lockfileNames) {
    try {
      await readFile(join(root, filename));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }

      throw error;
    }

    lockfiles.push(filename);
  }

  if (lockfiles.length === 1) {
    const filename = lockfiles[0];
    return filename === undefined ? undefined : lockfileManagers[filename];
  }

  if (lockfiles.length > 1) {
    const matching = lockfiles.filter((filename) => lockfileManagers[filename] === declared);
    return matching.length === 1 ? declared : undefined;
  }

  return declared;
}

export async function detectPackageScripts(root: string): Promise<PackageScriptsReport | null> {
  let contents: string;

  try {
    contents = await readFile(join(root, "package.json"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    return {
      source: "package.json",
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { source: "package.json" };
  }

  const packageJson = parsed as Record<string, unknown>;
  const scripts = readScripts(packageJson.scripts);
  const declaredPackageManager = parsePackageManagerName(packageJson.packageManager);
  const packageManager = await detectPackageManager(root, declaredPackageManager);
  const commands: Partial<Record<PackageScriptName, string>> = {};

  if (packageManager !== undefined) {
    for (const name of scriptNames) {
      const command = scripts[name];
      if (command !== undefined && !(name === "test" && isPlaceholderTest(command))) {
        commands[name] = commandForScript(packageManager, name);
      }
    }
  }

  return {
    ...(packageManager === undefined ? {} : { packageManager }),
    scripts,
    ...commands,
    source: "package.json",
  };
}
