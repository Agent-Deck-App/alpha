export type ToolchainReport = Record<string, unknown>;
export type PackageManagerReport = Record<string, unknown>;
export type CommandsReport = Record<string, unknown>;
export type WorkspaceReport = Record<string, unknown>;
export type InstructionsReport = Record<string, unknown>;

export interface ProbeReport {
  toolchain?: ToolchainReport;
  packageManager?: PackageManagerReport;
  commands?: CommandsReport;
  workspace?: WorkspaceReport;
  instructions?: InstructionsReport;
}

export type Detector<Section> = (root: string) => Promise<Section | null>;

export type ToolchainDetector = Detector<ToolchainReport>;
export type PackageManagerDetector = Detector<PackageManagerReport>;
export type CommandsDetector = Detector<CommandsReport>;
export type WorkspaceDetector = Detector<WorkspaceReport>;
export type InstructionsDetector = Detector<InstructionsReport>;

export { detectNodeVersion } from "./detect/node.js";
export type {
  NodeVersionFileName,
  NodeVersionFileReport,
  NodeVersionReport,
} from "./detect/node.js";
export { detectToolVersions } from "./detect/tool-versions.js";
export type {
  ToolVersionsFileName,
  ToolVersionsReport,
} from "./detect/tool-versions.js";
export { detectMise, MiseTomlSyntaxError } from "./detect/mise.js";
export type { MiseFileName, MiseReport } from "./detect/mise.js";
export { detectPythonRubyVersions } from "./detect/python-ruby.js";
export type {
  PythonRubyVersionFileName,
  PythonRubyVersionFileReport,
  PythonRubyVersionReport,
} from "./detect/python-ruby.js";

export async function probe(_root: string): Promise<ProbeReport> {
  return {};
}
