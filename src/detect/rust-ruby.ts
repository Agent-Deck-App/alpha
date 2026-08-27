import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type CargoFileName = "Cargo.toml";
export type RubyProjectFileName = "Gemfile" | "Gemfile.lock";

export interface CargoProjectReport extends Record<string, unknown> {
  installCommand: "cargo build";
  testCommand: "cargo test";
  source: CargoFileName;
  workspace?: true;
}

export interface RubyProjectReport extends Record<string, unknown> {
  installCommand: "bundle install";
  files: RubyProjectFileName[];
}

export interface RustRubyReport extends Record<string, unknown> {
  cargo?: CargoProjectReport;
  ruby?: RubyProjectReport;
}

// These aliases keep the public names descriptive for callers that prefer the
// language/ecosystem terminology used by the detector name.
export type RustProjectReport = CargoProjectReport;
export type RustRubyProjectReport = RustRubyReport;

function hasWorkspaceTable(contents: string): boolean {
  for (const line of contents.split(/\r?\n/)) {
    const header = /^\s*\[\s*workspace\s*\]\s*(?:#.*)?$/.exec(line);
    if (header !== null) {
      return true;
    }
  }

  return false;
}

async function fileExists(root: string, filename: string): Promise<boolean> {
  try {
    await readFile(join(root, filename));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

export async function detectRustRubyProjects(root: string): Promise<RustRubyReport | null> {
  let cargoContents: string | undefined;
  try {
    cargoContents = await readFile(join(root, "Cargo.toml"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const rubyFiles: RubyProjectFileName[] = [];
  for (const filename of ["Gemfile", "Gemfile.lock"] as const) {
    if (await fileExists(root, filename)) {
      rubyFiles.push(filename);
    }
  }

  if (cargoContents === undefined && rubyFiles.length === 0) {
    return null;
  }

  const cargo =
    cargoContents === undefined
      ? undefined
      : {
          installCommand: "cargo build" as const,
          testCommand: "cargo test" as const,
          source: "Cargo.toml" as const,
          ...(hasWorkspaceTable(cargoContents) ? { workspace: true as const } : {}),
        };
  const ruby =
    rubyFiles.length === 0
      ? undefined
      : {
          installCommand: "bundle install" as const,
          files: rubyFiles,
        };

  return {
    ...(cargo === undefined ? {} : { cargo }),
    ...(ruby === undefined ? {} : { ruby }),
  };
}
