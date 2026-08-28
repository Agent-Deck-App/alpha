import { readdir, readFile } from "node:fs/promises";
import { join, sep } from "node:path";

export type WorkspaceFileName = "pnpm-workspace.yaml" | "package.json" | "nx.json";
export type WorkspaceKind = "monorepo" | "single-package";

export interface WorkspacePackageReport {
  path: string;
  name: string;
}

export interface WorkspaceReport extends Record<string, unknown> {
  kind?: WorkspaceKind;
  source: WorkspaceFileName;
  globs?: string[];
  packages?: WorkspacePackageReport[];
  error?: string;
}

function stripYamlComment(value: string): string {
  let quote: "'" | '"' | undefined;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote !== undefined) {
      if (character === quote) {
        if (quote === "'" && value[index + 1] === "'") {
          index += 1;
        } else {
          quote = undefined;
        }
      } else if (quote === '"' && character === "\\") {
        index += 1;
      }
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (character === "#" && (index === 0 || /\s/.test(value[index - 1] ?? ""))) {
      return value.slice(0, index).trimEnd();
    }
  }

  return value;
}

function parseYamlScalar(value: string): string | undefined {
  const trimmed = stripYamlComment(value).trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return typeof parsed === "string" ? parsed : undefined;
    } catch {
      return trimmed.slice(1, -1);
    }
  }

  return trimmed;
}

function splitInlineList(value: string): string[] {
  const contents = value.trim().slice(1, -1);
  const values: string[] = [];
  let start = 0;
  let quote: "'" | '"' | undefined;
  let depth = 0;

  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index];
    if (quote !== undefined) {
      if (character === quote) {
        if (quote === "'" && contents[index + 1] === "'") {
          index += 1;
        } else {
          quote = undefined;
        }
      } else if (quote === '"' && character === "\\") {
        index += 1;
      }
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (character === "[" || character === "{") {
      depth += 1;
    } else if (character === "]" || character === "}") {
      depth -= 1;
    } else if (character === "," && depth === 0) {
      const parsed = parseYamlScalar(contents.slice(start, index));
      if (parsed !== undefined) {
        values.push(parsed);
      }
      start = index + 1;
    }
  }

  const parsed = parseYamlScalar(contents.slice(start));
  if (parsed !== undefined) {
    values.push(parsed);
  }
  return values;
}

function parsePnpmWorkspace(contents: string): string[] {
  const trimmedContents = contents.trim();
  if (trimmedContents.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmedContents);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return readWorkspaceGlobs((parsed as Record<string, unknown>).packages) ?? [];
      }
    } catch {
      // Continue with the targeted YAML parser below.
    }
  }

  const lines = contents.split(/\r?\n/);
  const globs: string[] = [];
  let packagesIndent: number | undefined;
  let readingPackages = false;

  for (const line of lines) {
    const withoutComment = stripYamlComment(line);
    const trimmed = withoutComment.trim();
    if (trimmed.length === 0) {
      continue;
    }

    const indentation = withoutComment.length - withoutComment.trimStart().length;
    if (/^packages\s*:/.test(trimmed)) {
      const value = trimmed.slice(trimmed.indexOf(":") + 1).trim();
      packagesIndent = indentation;
      readingPackages = true;
      if (value.startsWith("[") && value.endsWith("]")) {
        globs.push(...splitInlineList(value));
        readingPackages = false;
      } else if (value.length > 0) {
        const parsed = parseYamlScalar(value);
        if (parsed !== undefined) {
          globs.push(parsed);
        }
        readingPackages = false;
      }
      continue;
    }

    if (!readingPackages) {
      continue;
    }

    if (indentation <= (packagesIndent ?? 0)) {
      readingPackages = false;
      continue;
    }

    if (trimmed.startsWith("-")) {
      const parsed = parseYamlScalar(trimmed.slice(1));
      if (parsed !== undefined) {
        globs.push(parsed);
      }
    }
  }

  return globs;
}

function globSegmentToRegExp(segment: string): string {
  let result = "";
  for (let index = 0; index < segment.length; index += 1) {
    const character = segment[index];
    if (character === "*") {
      result += "[^/]*";
    } else if (character === "?") {
      result += "[^/]";
    } else if (character === "{") {
      const end = segment.indexOf("}", index + 1);
      if (end !== -1) {
        const alternatives = segment
          .slice(index + 1, end)
          .split(",")
          .map((alternative) => globSegmentToRegExp(alternative));
        result += `(?:${alternatives.join("|")})`;
        index = end;
      } else {
        result += "\\{";
      }
    } else {
      result += /[\\^$+.|()[\]]/.test(character ?? "") ? `\\${character}` : character;
    }
  }
  return result;
}

function globToRegExp(glob: string): RegExp {
  const normalized = glob.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "");
  const segments = normalized.split("/").filter((segment) => segment.length > 0);
  let expression = "^";

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment === "**") {
      if (segments.length === 1) {
        expression += ".*";
      } else if (index === 0) {
        expression += "(?:[^/]+/)*";
      } else {
        expression += "(?:/[^/]+)*";
      }
      continue;
    }

    if (index > 0 && segments[index - 1] !== "**") {
      expression += "/";
    } else if (index > 0 && index - 1 !== 0) {
      expression += "/";
    }
    expression += globSegmentToRegExp(segment ?? "");
  }

  return new RegExp(`${expression}$`);
}

async function collectDirectories(root: string): Promise<string[]> {
  const directories = ["."];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(join(root, directory), { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name === "node_modules" || entry.name === ".git") {
        continue;
      }

      const child = directory === "." ? entry.name : join(directory, entry.name);
      directories.push(child.split(sep).join("/"));
      await visit(child);
    }
  }

  await visit(".");
  return directories;
}

async function readPackageName(directory: string): Promise<string | undefined> {
  let contents: string;
  try {
    contents = await readFile(join(directory, "package.json"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }

  try {
    const parsed: unknown = JSON.parse(contents);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return undefined;
    }

    const name = (parsed as Record<string, unknown>).name;
    return typeof name === "string" && name.length > 0 ? name : undefined;
  } catch {
    return undefined;
  }
}

async function resolvePackages(root: string, globs: string[]): Promise<WorkspacePackageReport[]> {
  const directories = await collectDirectories(root);
  const selected = new Set<string>();

  for (const configuredGlob of globs) {
    const trimmed = configuredGlob.trim();
    if (trimmed.length === 0) {
      continue;
    }

    const negated = trimmed.startsWith("!");
    const pattern = negated ? trimmed.slice(1) : trimmed;
    const matcher = globToRegExp(pattern);
    for (const directory of directories) {
      if (directory === "." || !matcher.test(directory)) {
        continue;
      }

      if (negated) {
        selected.delete(directory);
      } else {
        selected.add(directory);
      }
    }
  }

  const packages: WorkspacePackageReport[] = [];
  for (const directory of selected) {
    const name = await readPackageName(join(root, directory));
    if (name !== undefined) {
      packages.push({ path: directory, name });
    }
  }

  packages.sort((left, right) => left.path.localeCompare(right.path));
  return packages;
}

async function resolveNxPackages(root: string, globs: string[]): Promise<WorkspacePackageReport[]> {
  const packages = await resolvePackages(root, globs);
  return packages.length === 0 ? resolvePackages(root, ["**"]) : packages;
}

async function readOptional(root: string, filename: string): Promise<string | undefined> {
  try {
    return await readFile(join(root, filename), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function readWorkspaceGlobs(value: unknown): string[] | undefined {
  let candidate = value;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    candidate = (value as Record<string, unknown>).packages;
  }

  return Array.isArray(candidate) && candidate.every((item): item is string => typeof item === "string")
    ? candidate
    : undefined;
}

function parseJsonObject(contents: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(contents);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function parseJsonError(contents: string): string | undefined {
  try {
    JSON.parse(contents);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function readNxWorkspaceGlobs(contents: string): string[] {
  const nx = parseJsonObject(contents);
  const layout = nx?.workspaceLayout;
  if (typeof layout !== "object" || layout === null || Array.isArray(layout)) {
    return ["apps/*", "libs/*"];
  }

  const globs: string[] = [];
  for (const key of ["appsDir", "libsDir"]) {
    const directory = (layout as Record<string, unknown>)[key];
    if (typeof directory === "string" && directory.trim().length > 0) {
      globs.push(`${directory.replaceAll("\\", "/").replace(/\/$/, "")}/*`);
    }
  }

  return globs.length === 0 ? ["apps/*", "libs/*"] : globs;
}

export async function detectWorkspace(root: string): Promise<WorkspaceReport | null> {
  const pnpmWorkspace = await readOptional(root, "pnpm-workspace.yaml");
  if (pnpmWorkspace !== undefined) {
    const globs = parsePnpmWorkspace(pnpmWorkspace);
    return {
      kind: "monorepo",
      source: "pnpm-workspace.yaml",
      globs,
      packages: await resolvePackages(root, globs),
    };
  }

  const packageJsonContents = await readOptional(root, "package.json");
  const packageJson =
    packageJsonContents === undefined ? undefined : parseJsonObject(packageJsonContents);
  if (packageJsonContents !== undefined && packageJson === undefined) {
    const error = parseJsonError(packageJsonContents);
    if (error !== undefined) {
      return { source: "package.json", error };
    }
  }
  if (packageJson !== undefined) {
    const globs = readWorkspaceGlobs(packageJson.workspaces);
    if (globs !== undefined) {
      return {
        kind: "monorepo",
        source: "package.json",
        globs,
        packages: await resolvePackages(root, globs),
      };
    }
  }

  const nx = await readOptional(root, "nx.json");
  if (nx !== undefined) {
    const error = parseJsonError(nx);
    if (error !== undefined) {
      return { source: "nx.json", error };
    }

    return {
      kind: "monorepo",
      source: "nx.json",
      packages: await resolveNxPackages(root, readNxWorkspaceGlobs(nx)),
    };
  }

  const name = packageJson?.name;
  if (typeof name === "string" && name.length > 0) {
    return {
      kind: "single-package",
      source: "package.json",
      packages: [{ path: ".", name }],
    };
  }

  return null;
}
