#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { probe } from "./index.js";
import type { ProbeConflict, ProbeReport } from "./index.js";

interface ReportRecord {
  [key: string]: unknown;
}

function asRecord(value: unknown): ReportRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as ReportRecord)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function displayValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => displayValue(item)).join(", ");
  }
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  return JSON.stringify(value);
}

function sourceForField(section: ReportRecord | undefined, field: string): string | undefined {
  const conflicts = section?.conflicts;
  if (Array.isArray(conflicts)) {
    const conflict = conflicts.find(
      (candidate): candidate is ProbeConflict =>
        asRecord(candidate) !== undefined && candidate.field === field,
    );
    if (conflict?.winner !== null && conflict?.winner !== undefined) {
      return conflict.winner;
    }
  }

  if (field === "node") {
    const mise = asRecord(section?.mise);
    if (asRecord(mise?.tools)?.node !== undefined) {
      return stringValue(mise?.source);
    }

    const toolVersions = asRecord(section?.toolVersions);
    if (asRecord(toolVersions?.tools)?.node !== undefined) {
      return stringValue(toolVersions?.source);
    }

    const node = asRecord(section?.node);
    if (node?.node !== undefined) {
      return stringValue(node.source);
    }
  }

  if (field === "python" || field === "ruby") {
    const tool = asRecord(section?.mise);
    if (asRecord(tool?.tools)?.[field] !== undefined) {
      return stringValue(tool?.source);
    }

    const toolVersions = asRecord(section?.toolVersions);
    if (asRecord(toolVersions?.tools)?.[field] !== undefined) {
      return stringValue(toolVersions?.source);
    }

    const report = asRecord(section?.pythonRuby);
    if (report?.[field] !== undefined) {
      const filename = field === "python" ? ".python-version" : ".ruby-version";
      return asRecord(report.files)?.[filename] === undefined ? undefined : filename;
    }
  }

  return undefined;
}

function toolchainLines(section: ReportRecord | undefined): string[] {
  if (section === undefined) {
    return ["  (none detected)"];
  }

  const lines: string[] = [];
  const resolved = asRecord(section.resolved);
  if (resolved !== undefined) {
    for (const [field, value] of Object.entries(resolved)) {
      const source = sourceForField(section, field);
      lines.push(`  ${field}: ${displayValue(value)}${source === undefined ? "" : ` (${source})`}`);
    }
  }

  const add = (field: string, value: unknown, source?: string): void => {
    if (value === undefined || resolved?.[field] !== undefined) {
      return;
    }
    lines.push(`  ${field}: ${displayValue(value)}${source === undefined ? "" : ` (${source})`}`);
  };

  const node = asRecord(section.node);
  add("node", node?.node, stringValue(node?.source));

  const toolVersionsTools = asRecord(asRecord(section.toolVersions)?.tools);
  if (toolVersionsTools !== undefined) {
    for (const [field, value] of Object.entries(toolVersionsTools)) {
      add(field, value, stringValue(asRecord(section.toolVersions)?.source));
    }
  }

  const miseTools = asRecord(asRecord(section.mise)?.tools);
  if (miseTools !== undefined) {
    for (const [field, value] of Object.entries(miseTools)) {
      add(field, value, stringValue(asRecord(section.mise)?.source));
    }
  }

  const pythonRuby = asRecord(section.pythonRuby);
  add("python", pythonRuby?.python, sourceForField(section, "python"));
  add("ruby", pythonRuby?.ruby, sourceForField(section, "ruby"));

  const goMod = asRecord(section.goMod);
  add("go", asRecord(goMod?.go)?.version, stringValue(goMod?.source));
  add("toolchain", asRecord(goMod?.toolchain)?.version, stringValue(goMod?.source));

  return lines.length === 0 ? ["  (none detected)"] : lines;
}

function installCommandLines(section: ReportRecord | undefined): string[] {
  const commands: Array<{ name: string; command: string }> = [];
  const resolved = asRecord(section?.resolved);

  for (const name of ["javascript", "python"]) {
    const resolvedCommand = stringValue(asRecord(resolved?.[name])?.installCommand);
    const rawCommand = stringValue(asRecord(section?.[name])?.installCommand);
    const command = resolvedCommand ?? rawCommand;
    if (command !== undefined && !commands.some((item) => item.command === command)) {
      commands.push({ name, command });
    }
  }

  const rustRuby = asRecord(section?.rustRuby);
  for (const name of ["cargo", "ruby"]) {
    const command = stringValue(asRecord(rustRuby?.[name])?.installCommand);
    if (command !== undefined && !commands.some((item) => item.command === command)) {
      commands.push({ name, command });
    }
  }

  if (commands.length === 0) {
    return ["Install command: (none detected)"];
  }

  return commands.map((item, index) =>
    index === 0 ? `Install command: ${item.command}` : `Install command (${item.name}): ${item.command}`,
  );
}

function testCommand(
  section: ReportRecord | undefined,
  packageManager: ReportRecord | undefined,
): string | undefined {
  const resolved = stringValue(asRecord(section?.resolved)?.test);
  if (resolved !== undefined) {
    return resolved;
  }

  for (const name of ["packageScripts", "makefile", "githubActions"]) {
    const command = stringValue(asRecord(section?.[name])?.test);
    if (command !== undefined) {
      return command;
    }
  }

  const cargo = asRecord(asRecord(packageManager?.rustRuby)?.cargo);
  return stringValue(cargo?.testCommand) ?? stringValue(cargo?.test);
}

function workspacePackageLines(section: ReportRecord | undefined): string[] {
  const workspace = asRecord(section?.workspace);
  const packages = Array.isArray(workspace?.packages) ? workspace.packages : [];
  const lines = packages.flatMap((value) => {
    const packageReport = asRecord(value);
    const name = stringValue(packageReport?.name);
    const path = stringValue(packageReport?.path);
    return name !== undefined && path !== undefined ? [`  - ${name} (${path})`] : [];
  });

  return lines.length === 0 ? ["  (none detected)"] : lines;
}

function instructionFileLines(section: ReportRecord | undefined): string[] {
  const paths: string[] = [];
  const add = (value: unknown): void => {
    const path = stringValue(asRecord(value)?.path);
    if (path !== undefined && !paths.includes(path)) {
      paths.push(path);
    }
  };

  const devContainer = asRecord(section?.devContainer);
  if (devContainer !== undefined) {
    const source = stringValue(devContainer.source);
    if (source !== undefined) {
      paths.push(source);
    }
  }

  const context = asRecord(section?.context);
  if (Array.isArray(context?.files)) {
    context.files.forEach(add);
  }

  const skills = asRecord(section?.skills);
  if (Array.isArray(skills?.skills)) {
    skills.skills.forEach(add);
  }
  if (Array.isArray(skills?.malformed)) {
    skills.malformed.forEach(add);
  }

  const rules = asRecord(section?.rules);
  if (Array.isArray(rules?.rules)) {
    rules.rules.forEach(add);
  }
  if (Array.isArray(rules?.malformed)) {
    rules.malformed.forEach(add);
  }

  return paths.length === 0 ? ["  (none detected)"] : paths.map((path) => `  - ${path}`);
}

function conflictLines(report: ProbeReport): string[] {
  const lines: string[] = [];
  for (const sectionName of ["toolchain", "packageManager", "commands"] as const) {
    const section = asRecord(report[sectionName]);
    const conflicts = section?.conflicts;
    if (!Array.isArray(conflicts)) {
      continue;
    }

    for (const value of conflicts) {
      const conflict = asRecord(value);
      if (conflict === undefined || typeof conflict.field !== "string") {
        continue;
      }
      const sources = Array.isArray(conflict.sources)
        ? conflict.sources
            .map((source) => {
              const candidate = asRecord(source);
              return candidate?.source === undefined
                ? undefined
                : `${String(candidate.source)}=${displayValue(candidate.value)}`;
            })
            .filter((source): source is string => source !== undefined)
            .join(", ")
        : "";
      const winner = conflict.winner === null ? "unresolved" : String(conflict.winner);
      lines.push(`  - ${sectionName}.${conflict.field}: ${sources} (winner: ${winner})`);
    }
  }

  return lines.length === 0 ? ["  (none detected)"] : lines;
}

export function formatSummary(report: ProbeReport): string {
  const packageManager = asRecord(report.packageManager);
  const lines = [
    "Toolchain:",
    ...toolchainLines(asRecord(report.toolchain)),
    ...installCommandLines(packageManager),
    `Test command: ${testCommand(asRecord(report.commands), packageManager) ?? "(none detected)"}`,
    "Workspace packages:",
    ...workspacePackageLines(asRecord(report.workspace)),
    "Instruction files:",
    ...instructionFileLines(asRecord(report.instructions)),
    "Conflicts:",
    ...conflictLines(report),
  ];

  return lines.join("\n");
}

export interface CliWriter {
  write(message: string): void;
}

function argumentError(message: string, stderr: CliWriter): number {
  stderr.write(`repo-probe: ${message}\n`);
  return 2;
}

export async function runCli(
  argv: readonly string[] = process.argv.slice(2),
  stdout: CliWriter = process.stdout,
  stderr: CliWriter = process.stderr,
): Promise<number> {
  let json = false;
  let root: string | undefined;

  for (const argument of argv) {
    if (argument === "--json") {
      json = true;
    } else if (argument.startsWith("-")) {
      return argumentError(`unknown option: ${argument}`, stderr);
    } else if (root !== undefined) {
      return argumentError("only one repository path may be supplied", stderr);
    } else {
      root = argument;
    }
  }

  const report = await probe(root ?? process.cwd());
  if (json) {
    stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    stdout.write(`${formatSummary(report)}\n`);
  }

  return Object.keys(report).length === 0 ? 1 : 0;
}

export const main = runCli;

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }

  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(entry));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  const exitCode = await runCli();
  process.exitCode = exitCode;
}
