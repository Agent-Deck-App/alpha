import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type PackageJsonFileName = "package.json";

export interface PackageManagerVersionReport {
  name: string;
  version: string;
}

export interface PackageJsonEnginesReport {
  node?: string;
}

export interface PackageJsonReport extends Record<string, unknown> {
  packageManager?: PackageManagerVersionReport;
  engines?: PackageJsonEnginesReport;
  error?: string;
  source: PackageJsonFileName;
}

function readNodeEngine(value: unknown): PackageJsonEnginesReport | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const node = (value as Record<string, unknown>).node;
  return typeof node === "string" ? { node } : undefined;
}

function parsePackageManager(value: unknown): PackageManagerVersionReport | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.replace(/\+sha\d+\.[A-Za-z0-9]+$/, "");
  const separator = normalized.lastIndexOf("@");
  if (separator <= 0 || separator === normalized.length - 1) {
    return undefined;
  }

  return {
    name: normalized.slice(0, separator),
    version: normalized.slice(separator + 1),
  };
}

export async function detectPackageJson(root: string): Promise<PackageJsonReport | null> {
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
      error: error instanceof Error ? error.message : String(error),
      source: "package.json",
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { source: "package.json" };
  }

  const packageJson = parsed as Record<string, unknown>;
  const packageManager = parsePackageManager(packageJson.packageManager);
  const engines = readNodeEngine(packageJson.engines);

  return {
    ...(packageManager === undefined ? {} : { packageManager }),
    ...(engines === undefined ? {} : { engines }),
    source: "package.json",
  };
}
