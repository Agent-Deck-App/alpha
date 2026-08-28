import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type MiseFileName = ".mise.toml" | "mise.toml" | ".config/mise/config.toml";

export interface MiseReport extends Record<string, unknown> {
  tools: Record<string, string>;
  source: MiseFileName;
}

export class MiseTomlSyntaxError extends Error {
  constructor(public readonly line: number) {
    super(`Invalid TOML syntax on line ${line}`);
    this.name = "MiseTomlSyntaxError";
  }
}

const miseFiles = [".mise.toml", "mise.toml", ".config/mise/config.toml"] as const;

function stripComment(line: string): string {
  let quote: '"' | "'" | undefined;
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (quote === '"' && escaped) {
      escaped = false;
      continue;
    }

    if (quote === '"' && character === "\\") {
      escaped = true;
      continue;
    }

    if (quote !== undefined) {
      if (character === quote) {
        quote = undefined;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "#") {
      return line.slice(0, index);
    }
  }

  return line;
}

type Assignment = {
  key: string;
  value: string;
};

type ParsedTool = {
  tool: string;
  version: string;
};

const stringEscapes: Record<string, string> = {
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
  '"': '"',
  "\\": "\\",
};

function parseStringValue(value: string): string | null {
  const quote = value[0];
  if ((quote !== '"' && quote !== "'") || value.length < 2 || value.at(-1) !== quote) {
    return null;
  }

  let result = "";
  for (let index = 1; index < value.length - 1; index += 1) {
    const character = value[index];

    if (quote === "'") {
      if (character === "'") {
        return null;
      }

      result += character;
      continue;
    }

    if (character !== "\\") {
      if (character === '"') {
        return null;
      }

      result += character;
      continue;
    }

    const escaped = value[index + 1];
    if (escaped === undefined) {
      return null;
    }

    const escapes: Record<string, string> = {
      b: "\\b",
      f: "\\f",
      n: "\\n",
      r: "\\r",
      t: "\\t",
      '"': '"',
      "\\": "\\",
    };
    const replacement = escapes[escaped];
    if (replacement !== undefined) {
      result += replacement;
      index += 1;
      continue;
    }

    if (escaped === "u" || escaped === "U") {
      const length = escaped === "u" ? 4 : 8;
      const hexadecimal = value.slice(index + 2, index + 2 + length);
      if (!new RegExp(`^[0-9A-Fa-f]{${length}}$`).test(hexadecimal)) {
        return null;
      }

      result += String.fromCodePoint(Number.parseInt(hexadecimal, 16));
      index += length + 1;
      continue;
    }

    return null;
  }

  return result;
}

function parseKey(value: string): string | null {
  const key = value.trim();
  if (/^[A-Za-z0-9_-]+$/.test(key)) {
    return key;
  }

  return parseStringValue(key);
}

function findAssignment(content: string): Assignment | null {
  let quote: '"' | "'" | undefined;
  let escaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (quote === '"' && escaped) {
      escaped = false;
      continue;
    }

    if (quote === '"' && character === "\\") {
      escaped = true;
      continue;
    }

    if (quote !== undefined) {
      if (character === quote) {
        quote = undefined;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "=") {
      return {
        key: content.slice(0, index).trim(),
        value: content.slice(index + 1).trim(),
      };
    }
  }

  return null;
}

function containerDepth(value: string): number | null {
  let quote: '"' | "'" | undefined;
  let escaped = false;
  let depth = 0;

  for (const character of value) {
    if (quote === '"' && escaped) {
      escaped = false;
      continue;
    }

    if (quote === '"' && character === "\\") {
      escaped = true;
      continue;
    }

    if (quote !== undefined) {
      if (character === quote) {
        quote = undefined;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "[" || character === "{") {
      depth += 1;
    } else if (character === "]" || character === "}") {
      if (depth === 0) {
        return null;
      }
      depth -= 1;
    }
  }

  return quote === undefined && !escaped ? depth : null;
}

function splitTopLevel(value: string): string[] | null {
  let quote: '"' | "'" | undefined;
  let escaped = false;
  let depth = 0;
  let start = 0;
  const parts: string[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (quote === '"' && escaped) {
      escaped = false;
      continue;
    }

    if (quote === '"' && character === "\\") {
      escaped = true;
      continue;
    }

    if (quote !== undefined) {
      if (character === quote) {
        quote = undefined;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "[" || character === "{") {
      depth += 1;
    } else if (character === "]" || character === "}") {
      if (depth === 0) {
        return null;
      }
      depth -= 1;
    } else if (character === "," && depth === 0) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }

  if (quote !== undefined || escaped || depth !== 0) {
    return null;
  }

  parts.push(value.slice(start));
  return parts;
}

function parseArrayValue(value: string): string | undefined | null {
  if (!value.startsWith("[") || !value.endsWith("]")) {
    return null;
  }

  const parts = splitTopLevel(value.slice(1, -1));
  if (parts === null) {
    return null;
  }

  let first: string | undefined;
  for (const [index, part] of parts.entries()) {
    const item = part.trim();
    if (item === "") {
      if (index !== parts.length - 1) {
        return null;
      }
      continue;
    }

    const version = parseStringValue(item);
    if (version === null) {
      return null;
    }

    first ??= version;
  }

  return first;
}

function parseVersionValue(value: string): string | undefined | null {
  if (value.startsWith('"') || value.startsWith("'")) {
    return parseStringValue(value);
  }

  if (value.startsWith("[")) {
    return parseArrayValue(value);
  }

  if (value.startsWith("{")) {
    if (!value.endsWith("}")) {
      return null;
    }

    const parts = splitTopLevel(value.slice(1, -1));
    if (parts === null) {
      return null;
    }

    let version: string | undefined;
    for (const [index, part] of parts.entries()) {
      const item = part.trim();
      if (item === "") {
        if (index !== parts.length - 1) {
          return null;
        }
        continue;
      }

      const assignment = findAssignment(item);
      if (assignment === null || assignment.value === "") {
        return null;
      }

      const key = parseKey(assignment.key);
      if (key === null) {
        return null;
      }

      if (key === "version") {
        const candidate = parseVersionValue(assignment.value);
        if (candidate === null) {
          return null;
        }
        version = candidate;
        continue;
      }

      if (containerDepth(assignment.value) === null) {
        return null;
      }
    }

    return version;
  }

  return null;
}

function parseToolAssignment(content: string): ParsedTool | undefined | null {
  const assignment = findAssignment(content);
  if (assignment === null || assignment.value === "") {
    return null;
  }

  const tool = parseKey(assignment.key);
  if (tool === null) {
    return null;
  }

  const version = parseVersionValue(assignment.value);
  if (version === null || version === undefined) {
    return version;
  }

  return { tool, version };
}

function addTool(content: string, line: number, tools: Record<string, string>): void {
  const parsed = parseToolAssignment(content);
  if (parsed === null) {
    throw new MiseTomlSyntaxError(line);
  }

  if (parsed !== undefined) {
    tools[parsed.tool] = parsed.version;
  }
}

export async function detectMise(root: string): Promise<MiseReport | null> {
  for (const filename of miseFiles) {
    let contents: string;

    try {
      contents = await readFile(join(root, filename), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }

      throw error;
    }

    const tools: Record<string, string> = {};
    let inTools = false;
    let pending: { content: string; line: number } | undefined;

    for (const [index, line] of contents.split(/\r?\n/).entries()) {
      let content = stripComment(line).trim();
      const lineNumber = index + 1;

      if (pending !== undefined) {
        if (content === "") {
          continue;
        }

        if (content.startsWith("[")) {
          throw new MiseTomlSyntaxError(lineNumber);
        }

        pending.content += ` ${content}`;
        const assignment = findAssignment(pending.content);
        const depth = assignment === null ? null : containerDepth(assignment.value);
        if (depth === null) {
          throw new MiseTomlSyntaxError(pending.line);
        }

        if (depth > 0) {
          continue;
        }

        content = pending.content;
        const pendingLine = pending.line;
        pending = undefined;
        addTool(content, pendingLine, tools);
        continue;
      }

      if (content === "") {
        continue;
      }

      if (content.startsWith("[")) {
        if (!content.endsWith("]")) {
          throw new MiseTomlSyntaxError(lineNumber);
        }

        inTools = !content.startsWith("[[") && content.slice(1, -1).trim() === "tools";
        continue;
      }

      if (!inTools) {
        continue;
      }

      const assignment = findAssignment(content);
      const depth = assignment === null ? null : containerDepth(assignment.value);
      if (depth === null) {
        throw new MiseTomlSyntaxError(lineNumber);
      }

      if (depth > 0) {
        pending = { content, line: lineNumber };
        continue;
      }

      addTool(content, lineNumber, tools);
    }

    if (pending !== undefined) {
      throw new MiseTomlSyntaxError(pending.line);
    }

    return { tools, source: filename };
  }

  return null;
}
