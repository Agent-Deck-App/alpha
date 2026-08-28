import { readdir, readFile } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { join } from "node:path";

export type SkillsDirectoryName = ".claude/skills";

export interface SkillReport {
  path: string;
  name: string;
  description: string;
}

export interface MalformedSkillReport {
  path: string;
}

export interface SkillsReport extends Record<string, unknown> {
  source: SkillsDirectoryName;
  skills: SkillReport[];
  malformed: MalformedSkillReport[];
}

export type ClaudeSkillsDirectoryName = SkillsDirectoryName;
export type ClaudeSkillReport = SkillReport;
export type ClaudeSkillsReport = SkillsReport;

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
  if (trimmed.length === 0 || trimmed === "null" || trimmed === "~") {
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
      return undefined;
    }
  }

  return trimmed;
}

function parseBlockScalar(
  lines: string[],
  start: number,
  keyIndent: number,
  indicator: string,
): { value: string; next: number } | undefined {
  const content: string[] = [];
  let contentIndent: number | undefined;
  let index = start;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim().length === 0) {
      content.push("");
      index += 1;
      continue;
    }

    const indentation = line.length - line.trimStart().length;
    if (indentation <= keyIndent) {
      break;
    }

    contentIndent ??= indentation;
    if (indentation < contentIndent) {
      return undefined;
    }
    content.push(line.slice(contentIndent));
    index += 1;
  }

  const style = indicator[0];
  const chomping = indicator[1];
  let value: string;
  if (style === ">") {
    value = content.reduce((result, line, contentIndex) => {
      if (contentIndex === 0) {
        return line;
      }
      return result.endsWith("\n") || line === "" ? `${result}\n${line}` : `${result} ${line}`;
    }, "");
  } else {
    value = content.join("\n");
  }

  if (chomping !== "-") {
    value += "\n";
  }
  if (chomping === "+") {
    value += "\n";
  }

  return { value, next: index };
}

function parseFrontmatter(contents: string): { name: string; description: string } | undefined {
  const lines = contents.split(/\r?\n/);
  if (lines[0] !== "---") {
    return undefined;
  }

  const closing = lines.indexOf("---", 1);
  if (closing === -1) {
    return undefined;
  }

  let name: string | undefined;
  let description: string | undefined;
  for (let index = 1; index < closing; index += 1) {
    const line = lines[index] ?? "";
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const indentation = line.length - line.trimStart().length;
    const rawValue = stripYamlComment(line.slice(separator + 1)).trim();
    let value = parseYamlScalar(rawValue);
    const blockIndicator = /^(?:[|>])(?:[-+])?$/.test(rawValue) ? rawValue : undefined;
    if (blockIndicator !== undefined) {
      const block = parseBlockScalar(lines.slice(0, closing), index + 1, indentation, blockIndicator);
      if (block === undefined) {
        return undefined;
      }
      value = block.value;
      index = block.next - 1;
    }

    if (key === "name") {
      name = value;
    } else if (key === "description") {
      description = value;
    }
  }

  if (name === undefined || name.trim().length === 0 || description === undefined || description.trim().length === 0) {
    return undefined;
  }

  return { name, description };
}

export async function detectSkills(root: string): Promise<SkillsReport | null> {
  let entries: Dirent[];
  try {
    entries = await readdir(join(root, ".claude/skills"), { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }

  const skills: SkillReport[] = [];
  const malformed: MalformedSkillReport[] = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory()) {
      continue;
    }

    const path = `.claude/skills/${entry.name}/SKILL.md`;
    let contents: string;
    try {
      contents = await readFile(join(root, path), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }

      throw error;
    }

    const frontmatter = parseFrontmatter(contents);
    if (frontmatter === undefined) {
      malformed.push({ path });
    } else {
      skills.push({ path, ...frontmatter });
    }
  }

  return { source: ".claude/skills", skills, malformed };
}

export const detectClaudeSkills = detectSkills;
