import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type PythonPackageManagerName = "uv" | "poetry" | "pipenv" | "pip";
export type PythonPackageManagerLockfileName = "uv.lock" | "poetry.lock" | "Pipfile.lock";

export interface PythonPackageManagerReport extends Record<string, unknown> {
  packageManager?: PythonPackageManagerName;
  installCommand?: string;
  lockfiles: PythonPackageManagerLockfileName[];
  requirements?: boolean;
  pyproject?: boolean;
  buildBackend?: string;
  tools?: string[];
  ambiguous?: boolean;
}

const lockfileManagers: Record<
  PythonPackageManagerLockfileName,
  { packageManager: PythonPackageManagerName; installCommand: string }
> = {
  "uv.lock": {
    packageManager: "uv",
    installCommand: "uv sync --frozen",
  },
  "poetry.lock": {
    packageManager: "poetry",
    installCommand: "poetry install",
  },
  "Pipfile.lock": {
    packageManager: "pipenv",
    installCommand: "pipenv sync",
  },
};

const lockfileNames = ["uv.lock", "poetry.lock", "Pipfile.lock"] as const;

const toolManagers: Record<
  string,
  { packageManager: PythonPackageManagerName; installCommand: string }
> = {
  uv: { packageManager: "uv", installCommand: "uv sync" },
  poetry: { packageManager: "poetry", installCommand: "poetry install" },
};

interface PyprojectDetails {
  buildBackend?: string;
  tools: string[];
}

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

function parsePyproject(contents: string): PyprojectDetails {
  let section = "";
  let buildBackend: string | undefined;
  const tools: string[] = [];

  for (const line of contents.split(/\r?\n/)) {
    const content = stripComment(line).trim();
    if (content === "") {
      continue;
    }

    const header = /^\[([^\]]+)\]$/.exec(content);
    if (header !== null) {
      section = header[1]?.trim() ?? "";
      if (section.startsWith("tool.")) {
        const tool = section.slice("tool.".length).split(".")[0];
        if (tool !== undefined && tool !== "" && toolManagers[tool] !== undefined) {
          if (!tools.includes(tool)) {
            tools.push(tool);
          }
        }
      }
      continue;
    }

    if (section !== "build-system" || buildBackend !== undefined) {
      continue;
    }

    const assignment = /^build-backend\s*=\s*[\"']([^\"']+)[\"']$/.exec(content);
    if (assignment !== null) {
      buildBackend = assignment[1];
    }
  }

  return { ...(buildBackend === undefined ? {} : { buildBackend }), tools };
}

async function readPyproject(root: string): Promise<PyprojectDetails | undefined> {
  let contents: string;

  try {
    contents = await readFile(join(root, "pyproject.toml"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }

  return parsePyproject(contents);
}

function pyprojectReport(details: PyprojectDetails | undefined): Record<string, unknown> {
  if (details === undefined) {
    return {};
  }

  return {
    pyproject: true,
    ...(details.buildBackend === undefined ? {} : { buildBackend: details.buildBackend }),
    ...(details.tools.length === 0 ? {} : { tools: details.tools }),
  };
}

export async function detectPythonPackageManager(
  root: string,
): Promise<PythonPackageManagerReport | null> {
  const lockfiles: PythonPackageManagerLockfileName[] = [];

  for (const filename of lockfileNames) {
    try {
      await readFile(join(root, filename));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }

      throw error;
    }

    lockfiles.push(filename);
  }

  const details = await readPyproject(root);
  const evidence = pyprojectReport(details);

  if (lockfiles.length > 1) {
    const matching = lockfiles.filter((candidate) =>
      details?.tools.includes(lockfileManagers[candidate].packageManager),
    );

    if (matching.length === 1) {
      const selected = matching[0];
      if (selected !== undefined) {
        return { ...lockfileManagers[selected], lockfiles, ...evidence };
      }
    }

    return { lockfiles, ...evidence, ambiguous: true };
  }

  const filename = lockfiles[0];
  if (filename !== undefined) {
    return { ...lockfileManagers[filename], lockfiles, ...evidence };
  }

  try {
    await readFile(join(root, "requirements.txt"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    if (details === undefined) {
      return null;
    }

    if (details.tools.length > 1) {
      return { lockfiles: [], ...evidence, ambiguous: true };
    }

    const tool = details.tools[0];
    const manager = tool === undefined ? undefined : toolManagers[tool];
    return {
      ...(manager ?? { packageManager: "pip", installCommand: "pip install ." }),
      lockfiles: [],
      ...evidence,
    };
  }

  return {
    packageManager: "pip",
    installCommand: "pip install -r requirements.txt",
    lockfiles: [],
    requirements: true,
    ...evidence,
  };
}
