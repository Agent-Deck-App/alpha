import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type DevContainerFileName = ".devcontainer/devcontainer.json" | ".devcontainer.json";

export interface DevContainerReport extends Record<string, unknown> {
  image?: string;
  features?: Record<string, unknown>;
  postCreateCommand?: unknown;
  remoteUser?: string;
  kind: "declaration";
  source: DevContainerFileName;
  error?: string;
}

function stripJsonComments(contents: string): string {
  let result = "";
  let quote = false;
  let escaped = false;

  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index];
    const next = contents[index + 1];

    if (quote) {
      result += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        quote = false;
      }
      continue;
    }

    if (character === '"') {
      quote = true;
      result += character;
    } else if (character === "/" && next === "/") {
      result += " ";
      index += 1;
      while (
        index + 1 < contents.length &&
        contents[index + 1] !== "\n" &&
        contents[index + 1] !== "\r"
      ) {
        index += 1;
      }
    } else if (character === "/" && next === "*") {
      result += " ";
      index += 1;
      while (
        index + 1 < contents.length &&
        !(contents[index] === "*" && contents[index + 1] === "/")
      ) {
        if (contents[index] === "\n" || contents[index] === "\r") {
          result += contents[index];
        }
        index += 1;
      }
      if (index + 1 < contents.length) {
        index += 1;
      } else {
        throw new SyntaxError("Unterminated JSONC block comment");
      }
    } else {
      result += character;
    }
  }

  return result;
}

function stripTrailingCommas(contents: string): string {
  let result = "";
  let quote = false;
  let escaped = false;

  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index];

    if (quote) {
      result += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        quote = false;
      }
      continue;
    }

    if (character === '"') {
      quote = true;
      result += character;
      continue;
    }

    if (character === ",") {
      let next = index + 1;
      while (/\s/.test(contents[next] ?? "")) {
        next += 1;
      }
      if (contents[next] === "}" || contents[next] === "]") {
        continue;
      }
    }

    result += character;
  }

  return result;
}

function parseJsonc(contents: string): unknown {
  return JSON.parse(stripTrailingCommas(stripJsonComments(contents)));
}

const devContainerFiles = [".devcontainer/devcontainer.json", ".devcontainer.json"] as const;

export async function detectDevContainer(root: string): Promise<DevContainerReport | null> {
  let source: DevContainerFileName | undefined;
  let contents: string | undefined;

  for (const filename of devContainerFiles) {
    try {
      contents = await readFile(join(root, filename), "utf8");
      source = filename;
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  if (source === undefined || contents === undefined) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = parseJsonc(contents);
  } catch (error) {
    return {
      kind: "declaration",
      source,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { kind: "declaration", source };
  }

  const config = parsed as Record<string, unknown>;
  const image = config.image;
  const features = config.features;
  const postCreateCommand = config.postCreateCommand;
  const remoteUser = config.remoteUser;

  return {
    ...(typeof image === "string" ? { image } : {}),
    ...(typeof features === "object" && features !== null && !Array.isArray(features)
      ? { features: features as Record<string, unknown> }
      : {}),
    ...(postCreateCommand === undefined ? {} : { postCreateCommand }),
    ...(typeof remoteUser === "string" ? { remoteUser } : {}),
    kind: "declaration",
    source,
  };
}
