import { readdir, readFile } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { join } from "node:path";

export interface CursorRuleReport extends Record<string, unknown> {
  path: string;
  description: string;
  globs: string | null;
}

export interface CopilotInstructionReport extends Record<string, unknown> {
  path: string;
  description: string;
  applyTo: string | null;
}

export type RuleReport = CursorRuleReport | CopilotInstructionReport;

export interface MalformedRuleReport {
  path: string;
}

export interface RulesReport extends Record<string, unknown> {
  rules: RuleReport[];
  malformed: MalformedRuleReport[];
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

function parseScalar(value: string): string | undefined {
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

function readFrontmatter(contents: string): Record<string, string | undefined> | undefined {
  const lines = contents.split(/\r?\n/);
  if (lines[0] !== "---") {
    return undefined;
  }

  const closing = lines.indexOf("---", 1);
  if (closing === -1) {
    return undefined;
  }

  const fields: Record<string, string | undefined> = {};
  for (let index = 1; index < closing; index += 1) {
    const line = lines[index] ?? "";
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const rawValue = stripYamlComment(line.slice(separator + 1)).trim();
    let value = parseScalar(rawValue);
    const blockIndicator = /^(?:[|>])(?:[-+])?$/.test(rawValue) ? rawValue : undefined;
    if (blockIndicator !== undefined) {
      const block = parseBlockScalar(lines.slice(0, closing), index + 1, line.length - line.trimStart().length, blockIndicator);
      if (block === undefined) {
        return undefined;
      }
      value = block.value;
      index = block.next - 1;
    }

    fields[key] = value;
  }

  return fields;
}

function readRule(
  path: string,
  contents: string,
  globField: "globs" | "applyTo",
): RuleReport | undefined {
  const frontmatter = readFrontmatter(contents);
  if (frontmatter === undefined) {
    return undefined;
  }

  const description = frontmatter.description;
  if (description === undefined || description.trim().length === 0) {
    return undefined;
  }

  return globField === "globs"
    ? { path, description, globs: frontmatter.globs ?? null }
    : { path, description, applyTo: frontmatter.applyTo ?? null };
}

async function readDirectory(root: string, directory: string): Promise<Dirent[] | undefined> {
  try {
    return await readdir(join(root, directory), { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

interface ReadRulesResult {
  present: boolean;
  rules: RuleReport[];
  malformed: MalformedRuleReport[];
}

async function readRules(
  root: string,
  directory: string,
  suffix: string,
  globField: "globs" | "applyTo",
): Promise<ReadRulesResult> {
  const entries = await readDirectory(root, directory);
  if (entries === undefined) {
    return { present: false, rules: [], malformed: [] };
  }

  const rules: RuleReport[] = [];
  const malformed: MalformedRuleReport[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isFile() || !entry.name.endsWith(suffix)) {
      continue;
    }

    const path = `${directory}/${entry.name}`;
    const rule = readRule(path, await readFile(join(root, path), "utf8"), globField);
    if (rule === undefined) {
      malformed.push({ path });
    } else {
      rules.push(rule);
    }
  }

  return { present: true, rules, malformed };
}

export async function detectRules(root: string): Promise<RulesReport | null> {
  const cursorRules = await readRules(root, ".cursor/rules", ".mdc", "globs");
  const copilotRules = await readRules(root, ".github/instructions", ".instructions.md", "applyTo");

  if (!cursorRules.present && !copilotRules.present) {
    return null;
  }

  return {
    rules: [...cursorRules.rules, ...copilotRules.rules],
    malformed: [...cursorRules.malformed, ...copilotRules.malformed],
  };
}
