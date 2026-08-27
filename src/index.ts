import type { WorkspaceReport as WorkspaceLayoutReport } from "./detect/workspace.js";

export type ToolchainReport = Record<string, unknown>;
export type PackageManagerReport = Record<string, unknown>;
export type CommandsReport = Record<string, unknown>;
export type WorkspaceReport = WorkspaceLayoutReport;
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
export { detectGoMod } from "./detect/go-mod.js";
export type {
  GoModDirectiveReport,
  GoModFileName,
  GoModReport,
  GoToolchainDirectiveReport,
} from "./detect/go-mod.js";
export { detectPackageJson } from "./detect/package-json.js";
export type {
  PackageJsonEnginesReport,
  PackageJsonFileName,
  PackageJsonReport,
  PackageManagerVersionReport,
} from "./detect/package-json.js";
export { detectPackageManager } from "./detect/package-manager.js";
export type {
  PackageManagerLockfileName,
  PackageManagerLockfileReport,
  PackageManagerName,
} from "./detect/package-manager.js";
export { detectMakefile } from "./detect/makefile.js";
export type { MakefileFileName, MakefileReport, MakeTargetName } from "./detect/makefile.js";
export { detectPackageScripts } from "./detect/package-scripts.js";
export type {
  PackageScriptName,
  PackageScriptsFileName,
  PackageScriptsReport,
} from "./detect/package-scripts.js";
export { detectPythonPackageManager } from "./detect/python-package-manager.js";
export type {
  PythonPackageManagerLockfileName,
  PythonPackageManagerName,
  PythonPackageManagerReport,
} from "./detect/python-package-manager.js";
export { detectDevContainer } from "./detect/devcontainer.js";
export type { DevContainerFileName, DevContainerReport } from "./detect/devcontainer.js";
export { detectGitHubActions, GitHubActionsYamlSyntaxError } from "./detect/github-actions.js";
export type {
  GitHubActionsDirectoryName,
  GitHubActionsReport,
  GitHubActionsRunStepReport,
  GitHubActionsStepReport,
  GitHubActionsUnavailableRequirement,
  GitHubActionsWorkflowFileName,
  GitHubActionsWorkflowReport,
} from "./detect/github-actions.js";
export { detectTurbo } from "./detect/turbo.js";
export type { TurboFileName, TurboReport, TurboTaskReport } from "./detect/turbo.js";
export { detectWorkspace } from "./detect/workspace.js";
export type {
  WorkspaceFileName,
  WorkspaceKind,
  WorkspacePackageReport,
} from "./detect/workspace.js";
export { detectClaudeSkills, detectSkills } from "./detect/skills.js";
export type {
  ClaudeSkillReport,
  ClaudeSkillsDirectoryName,
  ClaudeSkillsReport,
  MalformedSkillReport,
  SkillReport,
  SkillsDirectoryName,
  SkillsReport,
} from "./detect/skills.js";
export { detectRules } from "./detect/rules.js";
export type {
  CopilotInstructionReport,
  CursorRuleReport,
  MalformedRuleReport,
  RuleReport,
  RulesReport,
} from "./detect/rules.js";
export { detectContext } from "./detect/context.js";
export type { ContextFileName, ContextFileReport, ContextReport } from "./detect/context.js";

export async function probe(_root: string): Promise<ProbeReport> {
  return {};
}
