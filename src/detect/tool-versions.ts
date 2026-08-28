import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type ToolVersionsFileName = ".tool-versions";

export interface ToolVersionsReport extends Record<string, unknown> {
  tools: Record<string, string>;
  source: ToolVersionsFileName;
}

export async function detectToolVersions(root: string): Promise<ToolVersionsReport | null> {
  let contents: string;

  try {
    contents = await readFile(join(root, ".tool-versions"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }

  const tools: Record<string, string> = {};
  for (const line of contents.split(/\r?\n/)) {
    const content = line.split("#", 1)[0]?.trim() ?? "";
    if (content === "") {
      continue;
    }

    const fields = content.split(/\s+/);
    const [tool, version] = fields;

    if (tool !== undefined && version !== undefined) {
      tools[tool] = version;
    }
  }

  return { tools, source: ".tool-versions" };
}
