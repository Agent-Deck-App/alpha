import { detectContext } from "./detect/context.js";
import { detectDevContainer } from "./detect/devcontainer.js";
import { detectGitHubActions } from "./detect/github-actions.js";
import { detectGoMod } from "./detect/go-mod.js";
import { detectMakefile } from "./detect/makefile.js";
import { detectMise } from "./detect/mise.js";
import { detectNodeVersion } from "./detect/node.js";
import { detectPackageJson } from "./detect/package-json.js";
import { detectPackageManager } from "./detect/package-manager.js";
import { detectPackageScripts } from "./detect/package-scripts.js";
import { detectPythonPackageManager } from "./detect/python-package-manager.js";
import { detectPythonRubyVersions } from "./detect/python-ruby.js";
import { detectRules } from "./detect/rules.js";
import { detectSkills } from "./detect/skills.js";
import { detectToolVersions } from "./detect/tool-versions.js";
import { detectTurbo } from "./detect/turbo.js";
import { detectWorkspace } from "./detect/workspace.js";
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

export interface DetectorFailure {
  status: "failed";
  error: string;
}

export interface ProbeConflictSource {
  source: string;
  value: unknown;
}

export interface ProbeConflict {
  field: string;
  sources: ProbeConflictSource[];
  winner: string | null;
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

type ProbeSectionName = "toolchain" | "packageManager" | "commands" | "workspace" | "instructions";

interface DetectorEntry {
  section: ProbeSectionName;
  name: string;
  detect: Detector<Record<string, unknown>>;
}

const detectorEntries: readonly DetectorEntry[] = [
  { section: "toolchain", name: "node", detect: detectNodeVersion },
  { section: "toolchain", name: "toolVersions", detect: detectToolVersions },
  { section: "toolchain", name: "mise", detect: detectMise },
  { section: "toolchain", name: "pythonRuby", detect: detectPythonRubyVersions },
  { section: "toolchain", name: "goMod", detect: detectGoMod },
  { section: "packageManager", name: "packageJson", detect: detectPackageJson },
  { section: "packageManager", name: "javascript", detect: detectPackageManager },
  { section: "packageManager", name: "python", detect: detectPythonPackageManager },
  { section: "commands", name: "packageScripts", detect: detectPackageScripts },
  { section: "commands", name: "makefile", detect: detectMakefile },
  { section: "commands", name: "githubActions", detect: detectGitHubActions },
  { section: "workspace", name: "workspace", detect: detectWorkspace },
  { section: "workspace", name: "turbo", detect: detectTurbo },
  { section: "instructions", name: "devContainer", detect: detectDevContainer },
  { section: "instructions", name: "skills", detect: detectSkills },
  { section: "instructions", name: "rules", detect: detectRules },
  { section: "instructions", name: "context", detect: detectContext },
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringField(report: Record<string, unknown> | undefined, field: string): string | undefined {
  const value = report?.[field];
  return typeof value === "string" ? value : undefined;
}

function versionField(
  report: Record<string, unknown> | undefined,
  field: string,
): string | string[] | undefined {
  const value = report?.[field];
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string")) {
    return value.length === 1 ? value[0] : (value as string[]);
  }
  return undefined;
}

interface Candidate extends ProbeConflictSource {}

function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function addResolution(
  section: Record<string, unknown>,
  field: string,
  candidates: Candidate[],
): void {
  const winner = candidates[0];
  if (winner === undefined) {
    return;
  }

  const resolved = asRecord(section.resolved) ?? {};
  resolved[field] = winner.value;
  section.resolved = resolved;

  if (candidates.every((candidate) => sameValue(candidate.value, winner.value))) {
    return;
  }

  const conflicts = Array.isArray(section.conflicts)
    ? (section.conflicts as ProbeConflict[])
    : [];
  conflicts.push({ field, sources: candidates, winner: winner.source });
  section.conflicts = conflicts;
}

const javascriptLockfileManagers: Record<string, string> = {
  "pnpm-lock.yaml": "pnpm",
  "package-lock.json": "npm",
  "yarn.lock": "yarn",
  "bun.lockb": "bun",
};

function addToolchainResolution(
  sections: Partial<Record<ProbeSectionName, Record<string, unknown>>>,
): void {
  const section = sections.toolchain;
  if (section === undefined) {
    return;
  }

  const mise = asRecord(section.mise);
  const miseTools = asRecord(mise?.tools);
  const toolVersions = asRecord(section.toolVersions);
  const toolVersionTools = asRecord(toolVersions?.tools);
  const node = asRecord(section.node);
  const packageJson = asRecord(sections.packageManager?.packageJson);
  const engines = asRecord(packageJson?.engines);

  const nodeCandidates: Candidate[] = [];
  const miseNode = stringField(miseTools, "node");
  if (miseNode !== undefined) {
    nodeCandidates.push({ source: stringField(mise, "source") ?? ".mise.toml", value: miseNode });
  }
  const toolVersionsNode = stringField(toolVersionTools, "node");
  if (toolVersionsNode !== undefined) {
    nodeCandidates.push({
      source: stringField(toolVersions, "source") ?? ".tool-versions",
      value: toolVersionsNode,
    });
  }
  const nodeValue = stringField(node, "node");
  if (nodeValue !== undefined) {
    nodeCandidates.push({
      source: stringField(node, "source") ?? ".nvmrc",
      value: nodeValue,
    });
  }
  const engineNode = stringField(engines, "node");
  if (engineNode !== undefined) {
    nodeCandidates.push({ source: "package.json#engines.node", value: engineNode });
  }

  addResolution(section, "node", nodeCandidates);

  const pythonRuby = asRecord(section.pythonRuby);
  const pythonCandidates: Candidate[] = [];
  const misePython = stringField(miseTools, "python");
  if (misePython !== undefined) {
    pythonCandidates.push({ source: stringField(mise, "source") ?? ".mise.toml", value: misePython });
  }
  const toolVersionsPython = stringField(toolVersionTools, "python");
  if (toolVersionsPython !== undefined) {
    pythonCandidates.push({
      source: stringField(toolVersions, "source") ?? ".tool-versions",
      value: toolVersionsPython,
    });
  }
  const pythonValue = versionField(pythonRuby, "python");
  if (pythonValue !== undefined) {
    pythonCandidates.push({ source: ".python-version", value: pythonValue });
  }
  addResolution(section, "python", pythonCandidates);

  const rubyCandidates: Candidate[] = [];
  const miseRuby = stringField(miseTools, "ruby");
  if (miseRuby !== undefined) {
    rubyCandidates.push({ source: stringField(mise, "source") ?? ".mise.toml", value: miseRuby });
  }
  const toolVersionsRuby = stringField(toolVersionTools, "ruby");
  if (toolVersionsRuby !== undefined) {
    rubyCandidates.push({
      source: stringField(toolVersions, "source") ?? ".tool-versions",
      value: toolVersionsRuby,
    });
  }
  const rubyValue = stringField(pythonRuby, "ruby");
  if (rubyValue !== undefined) {
    rubyCandidates.push({ source: ".ruby-version", value: rubyValue });
  }
  addResolution(section, "ruby", rubyCandidates);
}

const commandFields = ["test", "test:unit", "typecheck", "lint", "build", "check", "install"] as const;

function addCommandResolution(
  sections: Partial<Record<ProbeSectionName, Record<string, unknown>>>,
): void {
  const section = sections.commands;
  if (section === undefined) {
    return;
  }

  const packageScripts = asRecord(section.packageScripts);
  const makefile = asRecord(section.makefile);
  const githubActions = asRecord(section.githubActions);
  const workflowSource =
    stringField(githubActions, "testWorkflow") ??
    stringField(githubActions, "source") ??
    ".github/workflows";

  for (const field of commandFields) {
    const candidates: Candidate[] = [];
    const packageScript = stringField(packageScripts, field);
    if (packageScript !== undefined) {
      candidates.push({ source: `package.json#scripts.${field}`, value: packageScript });
    }

    const makeTarget = stringField(makefile, field);
    if (makeTarget !== undefined) {
      candidates.push({ source: `Makefile:${field}`, value: makeTarget });
    }

    if (field === "test") {
      const workflowTest = stringField(githubActions, "test");
      if (workflowTest !== undefined) {
        candidates.push({ source: workflowSource, value: workflowTest });
      }
    }

    addResolution(section, field, candidates);
  }
}

function addPackageManagerResolution(
  sections: Partial<Record<ProbeSectionName, Record<string, unknown>>>,
): void {
  const section = sections.packageManager;
  if (section === undefined) {
    return;
  }

  const javascript = asRecord(section.javascript);
  const packageJson = asRecord(section.packageJson);
  const declared = asRecord(packageJson?.packageManager);
  const candidates: Candidate[] = [];
  const lockfiles = Array.isArray(javascript?.lockfiles)
    ? javascript.lockfiles.filter((filename): filename is string => typeof filename === "string")
    : [];
  const selectedManager = stringField(javascript, "packageManager");

  if (selectedManager !== undefined) {
    const lockfile = lockfiles.find((filename) => javascriptLockfileManagers[filename] === selectedManager);
    if (lockfile !== undefined) {
      candidates.push({ source: lockfile, value: selectedManager });
    }
  }

  const declaredManager = stringField(declared, "name");
  if (declaredManager !== undefined) {
    candidates.push({ source: "package.json#packageManager", value: declaredManager });
  }

  addResolution(section, "javascript", candidates);
  const winner = candidates[0];
  if (winner !== undefined) {
    const resolved = asRecord(section.resolved) ?? {};
    resolved.javascript = {
      packageManager: winner.value,
      ...(stringField(javascript, "installCommand") === undefined
        ? {}
        : { installCommand: stringField(javascript, "installCommand") }),
    };
    section.resolved = resolved;
  }
}

export async function probe(root: string): Promise<ProbeReport> {
  const results = await Promise.allSettled(detectorEntries.map(({ detect }) => detect(root)));
  const sections: Partial<Record<ProbeSectionName, Record<string, unknown>>> = {};

  for (const [index, result] of results.entries()) {
    const entry = detectorEntries[index];
    if (entry === undefined) {
      continue;
    }

    if (result.status === "fulfilled" && result.value === null) {
      continue;
    }

    const section = sections[entry.section] ?? (sections[entry.section] = {});
    if (result.status === "rejected") {
      const failure: DetectorFailure = { status: "failed", error: errorMessage(result.reason) };
      section[entry.name] = failure;
    } else {
      section[entry.name] = result.value;
    }
  }

  addToolchainResolution(sections);
  addPackageManagerResolution(sections);
  addCommandResolution(sections);
  return sections as ProbeReport;
}
