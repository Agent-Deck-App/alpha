import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type GoModFileName = "go.mod";

export interface GoModDirectiveReport {
  version: string;
  kind: "language-floor";
}

export interface GoToolchainDirectiveReport {
  version: string;
  kind: "toolchain-pin";
}

export interface GoModReport extends Record<string, unknown> {
  go?: GoModDirectiveReport;
  toolchain?: GoToolchainDirectiveReport;
  source: GoModFileName;
}

export async function detectGoMod(root: string): Promise<GoModReport | null> {
  let contents: string;

  try {
    contents = await readFile(join(root, "go.mod"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }

  let go: GoModDirectiveReport | undefined;
  let toolchain: GoToolchainDirectiveReport | undefined;
  let inRequireBlock = false;

  for (const line of contents.split(/\r?\n/)) {
    const content = line.split("//", 1)[0]?.trim() ?? "";

    if (inRequireBlock) {
      if (content === ")") {
        inRequireBlock = false;
      }
      continue;
    }

    if (/^require\s*\($/.test(content)) {
      inRequireBlock = true;
      continue;
    }

    const goMatch = /^go\s+(\S+)$/.exec(content);
    if (goMatch !== null) {
      go = { version: goMatch[1]!, kind: "language-floor" };
      continue;
    }

    const toolchainMatch = /^toolchain\s+(\S+)$/.exec(content);
    if (toolchainMatch !== null) {
      toolchain = { version: toolchainMatch[1]!, kind: "toolchain-pin" };
    }
  }

  return {
    ...(go === undefined ? {} : { go }),
    ...(toolchain === undefined ? {} : { toolchain }),
    source: "go.mod",
  };
}
