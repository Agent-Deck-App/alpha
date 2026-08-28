import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseVersionFile } from "./version-file.js";

export type NodeVersionFileName = ".nvmrc" | ".node-version";

export interface NodeVersionFileReport {
  status: "readable" | "unreadable";
  value?: string;
}

export interface NodeVersionReport extends Record<string, unknown> {
  node?: string;
  source?: NodeVersionFileName;
  files: Partial<Record<NodeVersionFileName, NodeVersionFileReport>>;
}

const nodeVersionPattern = /^(?:v?\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?|lts\/(?:\*|[A-Za-z0-9][A-Za-z0-9._-]*)|node|stable|system|iojs)$/;

function parseNodeVersion(contents: string): string | null {
  const values = parseVersionFile(contents);
  const value = values.length === 1 ? values[0] : undefined;

  return value !== undefined && nodeVersionPattern.test(value) ? value : null;
}

export async function detectNodeVersion(root: string): Promise<NodeVersionReport | null> {
  const files: Partial<Record<NodeVersionFileName, NodeVersionFileReport>> = {};
  let node: string | undefined;
  let source: NodeVersionFileName | undefined;
  let seen = false;

  for (const filename of [".nvmrc", ".node-version"] as const) {
    try {
      const value = parseNodeVersion(await readFile(join(root, filename), "utf8"));
      seen = true;

      if (value === null) {
        files[filename] = { status: "unreadable" };
        continue;
      }

      files[filename] = { status: "readable", value };
      if (source === undefined) {
        node = value;
        source = filename;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }

      seen = true;
      files[filename] = { status: "unreadable" };
    }
  }

  if (!seen) {
    return null;
  }

  return { ...(node === undefined ? {} : { node, source }), files };
}
