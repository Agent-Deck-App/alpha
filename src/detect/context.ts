import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type ContextFileName =
  | "AGENTS.md"
  | "CLAUDE.md"
  | ".cursorrules"
  | ".windsurfrules"
  | ".github/copilot-instructions.md";

export interface ContextFileReport extends Record<string, unknown> {
  path: ContextFileName;
  bytes: number;
  content?: string;
  contentOmitted?: boolean;
}

export interface ContextReport extends Record<string, unknown> {
  files: ContextFileReport[];
}

const contextFiles = [
  "AGENTS.md",
  "CLAUDE.md",
  ".cursorrules",
  ".windsurfrules",
  ".github/copilot-instructions.md",
] as const satisfies readonly ContextFileName[];

const maxInlineBytes = 100 * 1024;

export async function detectContext(root: string): Promise<ContextReport | null> {
  const files: ContextFileReport[] = [];

  for (const filename of contextFiles) {
    let contents: Buffer;
    try {
      contents = await readFile(join(root, filename));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }

      throw error;
    }

    const bytes = contents.byteLength;
    files.push(
      bytes > maxInlineBytes
        ? { path: filename, bytes, contentOmitted: true }
        : { path: filename, bytes, content: contents.toString("utf8") },
    );
  }

  return files.length === 0 ? null : { files };
}
