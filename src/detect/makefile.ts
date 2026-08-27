import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type MakefileFileName = "Makefile";
export type MakeTargetName = "test" | "check" | "build" | "install";

export interface MakefileReport extends Record<string, unknown> {
  targets: string[];
  test?: string;
  check?: string;
  build?: string;
  install?: string;
  source: MakefileFileName;
}

const targetNames = ["test", "check", "build", "install"] as const;

export async function detectMakefile(root: string): Promise<MakefileReport | null> {
  let contents: string;

  try {
    contents = await readFile(join(root, "Makefile"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }

  const targets: string[] = [];
  for (const line of contents.split(/\r?\n/)) {
    if (line.startsWith("\t")) {
      continue;
    }

    const content = line.split("#", 1)[0]?.trim() ?? "";
    if (
      /^(?:(?:override|private|export)\s+)*[^\s:=+?!]+\s*(?:::?=|\?=|\+=|!=|=)/.test(
        content,
      )
    ) {
      continue;
    }

    const colon = content.indexOf(":");
    if (colon === -1) {
      continue;
    }

    for (const target of content.slice(0, colon).trim().split(/\s+/)) {
      if (
        target !== "" &&
        target !== ".PHONY" &&
        !target.includes("%") &&
        !targets.includes(target)
      ) {
        targets.push(target);
      }
    }
  }

  const commands: Partial<Record<MakeTargetName, string>> = {};
  for (const name of targetNames) {
    if (targets.includes(name)) {
      commands[name] = `make ${name}`;
    }
  }

  return { source: "Makefile", targets, ...commands };
}
