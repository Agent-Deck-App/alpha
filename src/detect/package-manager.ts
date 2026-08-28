import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type PackageManagerName = "pnpm" | "npm" | "yarn" | "bun";
export type PackageManagerLockfileName =
  | "pnpm-lock.yaml"
  | "package-lock.json"
  | "yarn.lock"
  | "bun.lockb";

export interface PackageManagerLockfileReport extends Record<string, unknown> {
  packageManager?: PackageManagerName;
  installCommand?: string;
  lockfiles: PackageManagerLockfileName[];
  ambiguous?: boolean;
  packageJson?: boolean;
}

const lockfileNames = [
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "bun.lockb",
] as const;

const lockfileManagers: Record<
  PackageManagerLockfileName,
  { packageManager: PackageManagerName; installCommand: string }
> = {
  "pnpm-lock.yaml": {
    packageManager: "pnpm",
    installCommand: "pnpm install --frozen-lockfile",
  },
  "package-lock.json": {
    packageManager: "npm",
    installCommand: "npm ci",
  },
  "yarn.lock": {
    packageManager: "yarn",
    installCommand: "yarn install --immutable",
  },
  "bun.lockb": {
    packageManager: "bun",
    installCommand: "bun install --frozen-lockfile",
  },
};

function isPackageManagerName(value: string): value is PackageManagerName {
  return value === "pnpm" || value === "npm" || value === "yarn" || value === "bun";
}

async function readDeclaredPackageManager(root: string): Promise<PackageManagerName | undefined> {
  let contents: string;

  try {
    contents = await readFile(join(root, "package.json"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    return undefined;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return undefined;
  }

  const value = (parsed as Record<string, unknown>).packageManager;
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.replace(/\+sha\d+\.[A-Za-z0-9]+$/, "");
  const separator = normalized.lastIndexOf("@");
  if (separator <= 0 || separator === normalized.length - 1) {
    return undefined;
  }

  const name = normalized.slice(0, separator);
  return isPackageManagerName(name) ? name : undefined;
}

export async function detectPackageManager(
  root: string,
): Promise<PackageManagerLockfileReport | null> {
  const lockfiles: PackageManagerLockfileName[] = [];

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
    if (filename !== undefined) {
      return { ...lockfileManagers[filename], lockfiles };
    }
  }

  if (lockfiles.length > 1) {
    const declared = await readDeclaredPackageManager(root);
    const selected = lockfiles.find(
      (filename) => lockfileManagers[filename].packageManager === declared,
    );

    if (selected !== undefined) {
      return { ...lockfileManagers[selected], lockfiles };
    }

    return { lockfiles, ambiguous: true };
  }

  try {
    await readFile(join(root, "package.json"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }

  return { lockfiles: [], packageJson: true };
}
