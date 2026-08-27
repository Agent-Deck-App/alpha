import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseVersionFile } from "./version-file.js";

export type PythonRubyVersionFileName = ".python-version" | ".ruby-version";

export interface PythonRubyVersionFileReport {
  status: "readable" | "unreadable";
  value?: string;
  values?: string[];
}

export interface PythonRubyVersionReport extends Record<string, unknown> {
  python?: string[];
  ruby?: string;
  files: Partial<Record<PythonRubyVersionFileName, PythonRubyVersionFileReport>>;
}

export async function detectPythonRubyVersions(
  root: string,
): Promise<PythonRubyVersionReport | null> {
  const files: Partial<Record<PythonRubyVersionFileName, PythonRubyVersionFileReport>> = {};
  let python: string[] | undefined;
  let ruby: string | undefined;
  let seen = false;

  for (const filename of [".python-version", ".ruby-version"] as const) {
    let contents: string;

    try {
      contents = await readFile(join(root, filename), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }

      seen = true;
      files[filename] = { status: "unreadable" };
      continue;
    }

    seen = true;
    const values = parseVersionFile(contents);

    if (filename === ".python-version") {
      if (values.length === 0) {
        files[filename] = { status: "unreadable" };
      } else {
        python = values;
        files[filename] = { status: "readable", values };
      }
      continue;
    }

    if (values.length !== 1) {
      files[filename] = { status: "unreadable" };
    } else {
      const [value] = values;
      ruby = value;
      files[filename] = { status: "readable", value };
    }
  }

  if (!seen) {
    return null;
  }

  return {
    ...(python === undefined ? {} : { python }),
    ...(ruby === undefined ? {} : { ruby }),
    files,
  };
}
