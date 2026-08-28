import { readdir, readFile } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { join } from "node:path";

export type GitHubActionsDirectoryName = ".github/workflows";
export type GitHubActionsWorkflowFileName = string;
export type GitHubActionsUnavailableRequirement = "services" | "secrets" | "docker";

export interface GitHubActionsRunStepReport {
  job: string;
  name?: string;
  run: string;
  unavailable?: GitHubActionsUnavailableRequirement[];
}

export type GitHubActionsStepReport = GitHubActionsRunStepReport;

export interface GitHubActionsWorkflowReport extends Record<string, unknown> {
  file: GitHubActionsWorkflowFileName;
  name?: string;
  triggers: string[];
  steps: GitHubActionsRunStepReport[];
}

export interface GitHubActionsReport extends Record<string, unknown> {
  workflows: GitHubActionsWorkflowReport[];
  test?: string;
  testWorkflow?: GitHubActionsWorkflowFileName;
  source: GitHubActionsDirectoryName;
}

export class GitHubActionsYamlSyntaxError extends SyntaxError {
  constructor(
    public readonly line: number,
    message: string,
  ) {
    super(`Invalid GitHub Actions YAML on line ${line}: ${message}`);
    this.name = "GitHubActionsYamlSyntaxError";
  }
}

type YamlValue =
  | null
  | boolean
  | number
  | string
  | YamlValue[]
  | { [key: string]: YamlValue };

type YamlObject = { [key: string]: YamlValue };

interface SourceLine {
  number: number;
  indent: number;
  content: string;
  raw: string;
}

function stripComment(value: string): string {
  let quote: '"' | "'" | undefined;
  let escaped = false;

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
        if (quote === "'" && value[index + 1] === "'") {
          index += 1;
        } else {
          quote = undefined;
        }
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "#" && (index === 0 || /\s/.test(value[index - 1] ?? ""))) {
      return value.slice(0, index);
    }
  }

  return value;
}

function sourceLines(contents: string): SourceLine[] {
  return contents.split(/\r?\n/).map((raw, index) => {
    const leading = /^( *)/.exec(raw)?.[1] ?? "";
    if (/^[ ]*\t/.test(raw)) {
      throw new GitHubActionsYamlSyntaxError(index + 1, "tabs are not supported for indentation");
    }

    return {
      number: index + 1,
      indent: leading.length,
      content: stripComment(raw.slice(leading.length)).trim(),
      raw,
    };
  });
}

function isIgnorable(line: SourceLine): boolean {
  return line.content === "";
}

function isSequenceItem(value: string): boolean {
  return value === "-" || value.startsWith("- ");
}

function findTopLevelCharacter(value: string, expected: string): number {
  let quote: '"' | "'" | undefined;
  let escaped = false;
  let squareDepth = 0;
  let curlyDepth = 0;

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
        if (quote === "'" && value[index + 1] === "'") {
          index += 1;
        } else {
          quote = undefined;
        }
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (character === "[") {
      squareDepth += 1;
    } else if (character === "]") {
      squareDepth -= 1;
    } else if (character === "{") {
      curlyDepth += 1;
    } else if (character === "}") {
      curlyDepth -= 1;
    } else if (
      character === expected &&
      squareDepth === 0 &&
      curlyDepth === 0 &&
      (index + 1 === value.length || /\s/.test(value[index + 1] ?? ""))
    ) {
      return index;
    }
  }

  return -1;
}

function splitMappingEntry(value: string): { key: string; value: string } | null {
  const colon = findTopLevelCharacter(value, ":");
  if (colon <= 0) {
    return null;
  }

  return { key: value.slice(0, colon).trim(), value: value.slice(colon + 1).trim() };
}

function parseQuoted(value: string, line: number): string {
  const quote = value[0];
  if ((quote !== '"' && quote !== "'") || value.at(-1) !== quote) {
    throw new GitHubActionsYamlSyntaxError(line, "unterminated quoted scalar");
  }

  if (quote === '"') {
    try {
      return JSON.parse(value) as string;
    } catch {
      throw new GitHubActionsYamlSyntaxError(line, "invalid double-quoted scalar");
    }
  }

  const inner = value.slice(1, -1);
  let result = "";
  for (let index = 0; index < inner.length; index += 1) {
    const character = inner[index];
    if (character === "'") {
      if (inner[index + 1] !== "'") {
        throw new GitHubActionsYamlSyntaxError(line, "invalid single-quoted scalar");
      }
      result += "'";
      index += 1;
    } else {
      result += character;
    }
  }

  return result;
}

function splitFlow(value: string, line: number): string[] {
  const parts: string[] = [];
  let start = 0;
  let quote: '"' | "'" | undefined;
  let escaped = false;
  let squareDepth = 0;
  let curlyDepth = 0;

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
        if (quote === "'" && value[index + 1] === "'") {
          index += 1;
        } else {
          quote = undefined;
        }
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "[") {
      squareDepth += 1;
    } else if (character === "]") {
      squareDepth -= 1;
    } else if (character === "{") {
      curlyDepth += 1;
    } else if (character === "}") {
      curlyDepth -= 1;
    } else if (character === "," && squareDepth === 0 && curlyDepth === 0) {
      const part = value.slice(start, index).trim();
      if (part === "") {
        throw new GitHubActionsYamlSyntaxError(line, "empty flow collection item");
      }
      parts.push(part);
      start = index + 1;
    }
  }

  if (quote !== undefined || escaped || squareDepth !== 0 || curlyDepth !== 0) {
    throw new GitHubActionsYamlSyntaxError(line, "unterminated flow collection");
  }

  const last = value.slice(start).trim();
  if (last !== "") {
    parts.push(last);
  } else if (parts.length > 0) {
    throw new GitHubActionsYamlSyntaxError(line, "empty flow collection item");
  }

  return parts;
}

function parseKey(value: string, line: number): string {
  if (value === "") {
    throw new GitHubActionsYamlSyntaxError(line, "empty mapping key");
  }

  if (value.startsWith('"') || value.startsWith("'")) {
    return parseQuoted(value, line);
  }

  if (/^[!&*]/.test(value)) {
    throw new GitHubActionsYamlSyntaxError(line, "YAML tags and aliases are not supported");
  }

  return value;
}

function parseScalar(value: string, line: number): YamlValue {
  if (value === "") {
    return null;
  }

  if (value.startsWith('"') || value.startsWith("'")) {
    return parseQuoted(value, line);
  }

  if (value.startsWith("[") || value.startsWith("{")) {
    const closing = value[0] === "[" ? "]" : "}";
    if (!value.endsWith(closing)) {
      throw new GitHubActionsYamlSyntaxError(line, "unterminated flow collection");
    }

    const inner = value.slice(1, -1).trim();
    if (value[0] === "[") {
      return inner === ""
        ? []
        : splitFlow(inner, line).map((part) => parseScalar(part, line));
    }

    const object: YamlObject = {};
    if (inner === "") {
      return object;
    }

    for (const part of splitFlow(inner, line)) {
      const entry = splitMappingEntry(part);
      if (entry === null) {
        throw new GitHubActionsYamlSyntaxError(line, "flow mapping item is not a mapping");
      }
      const key = parseKey(entry.key, line);
      if (Object.hasOwn(object, key)) {
        throw new GitHubActionsYamlSyntaxError(line, `duplicate mapping key ${key}`);
      }
      object[key] = parseScalar(entry.value, line);
    }
    return object;
  }

  if (value.startsWith("|") || value.startsWith(">")) {
    throw new GitHubActionsYamlSyntaxError(line, "only literal block scalars are supported");
  }

  if (/^[!&*]/.test(value)) {
    throw new GitHubActionsYamlSyntaxError(line, "YAML tags and aliases are not supported");
  }

  if (value === "null" || value === "~") {
    return null;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }

  return value;
}

class YamlSubsetParser {
  private readonly lines: SourceLine[];
  private index = 0;

  constructor(contents: string) {
    this.lines = sourceLines(contents);
  }

  parse(): YamlValue | null {
    this.skipIgnorable();
    const first = this.lines[this.index];
    if (first === undefined) {
      return null;
    }

    const result = this.parseNode(first.indent);
    this.skipIgnorable();
    const remaining = this.lines[this.index];
    if (remaining !== undefined) {
      throw new GitHubActionsYamlSyntaxError(remaining.number, "unexpected document content");
    }
    return result;
  }

  private skipIgnorable(): void {
    while (this.index < this.lines.length && isIgnorable(this.lines[this.index]!)) {
      this.index += 1;
    }
  }

  private parseNode(indent: number): YamlValue {
    this.skipIgnorable();
    const line = this.lines[this.index];
    if (line === undefined || line.indent !== indent) {
      throw new GitHubActionsYamlSyntaxError(line?.number ?? 1, "unexpected indentation");
    }

    if (isSequenceItem(line.content)) {
      return this.parseSequence(indent);
    }

    if (splitMappingEntry(line.content) === null) {
      throw new GitHubActionsYamlSyntaxError(line.number, "expected a mapping or sequence");
    }

    return this.parseMapping(indent);
  }

  private parseMapping(indent: number): YamlObject {
    const object: YamlObject = {};

    while (true) {
      this.skipIgnorable();
      const line = this.lines[this.index];
      if (line === undefined || line.indent < indent) {
        break;
      }
      if (line.indent > indent) {
        throw new GitHubActionsYamlSyntaxError(line.number, "unexpected indentation");
      }
      if (isSequenceItem(line.content)) {
        throw new GitHubActionsYamlSyntaxError(line.number, "mapping and sequence cannot be mixed");
      }

      const entry = splitMappingEntry(line.content);
      if (entry === null) {
        throw new GitHubActionsYamlSyntaxError(line.number, "expected a mapping entry");
      }
      const key = parseKey(entry.key, line.number);
      if (Object.hasOwn(object, key)) {
        throw new GitHubActionsYamlSyntaxError(line.number, `duplicate mapping key ${key}`);
      }

      this.index += 1;
      object[key] = this.parseEntryValue(entry.value, indent, line.number);
    }

    return object;
  }

  private parseSequence(indent: number): YamlValue[] {
    const sequence: YamlValue[] = [];

    while (true) {
      this.skipIgnorable();
      const line = this.lines[this.index];
      if (line === undefined || line.indent < indent) {
        break;
      }
      if (line.indent > indent) {
        throw new GitHubActionsYamlSyntaxError(line.number, "unexpected indentation");
      }
      if (!isSequenceItem(line.content)) {
        throw new GitHubActionsYamlSyntaxError(line.number, "mapping and sequence cannot be mixed");
      }

      const rest = line.content === "-" ? "" : line.content.slice(2).trim();
      this.index += 1;

      if (rest === "") {
        this.skipIgnorable();
        const child = this.lines[this.index];
        sequence.push(child !== undefined && child.indent > indent ? this.parseNode(child.indent) : null);
        continue;
      }

      const entry = splitMappingEntry(rest);
      if (entry === null) {
        sequence.push(parseScalar(rest, line.number));
        continue;
      }

      const object: YamlObject = {};
      const key = parseKey(entry.key, line.number);
      object[key] = this.parseEntryValue(entry.value, indent + 2, line.number);

      this.skipIgnorable();
      const continuation = this.lines[this.index];
      if (continuation !== undefined && continuation.indent > indent) {
        if (isSequenceItem(continuation.content)) {
          throw new GitHubActionsYamlSyntaxError(continuation.number, "nested sequence is not supported here");
        }
        const restObject = this.parseMapping(continuation.indent);
        for (const [restKey, restValue] of Object.entries(restObject)) {
          if (Object.hasOwn(object, restKey)) {
            throw new GitHubActionsYamlSyntaxError(continuation.number, `duplicate mapping key ${restKey}`);
          }
          object[restKey] = restValue;
        }
      }
      sequence.push(object);
    }

    return sequence;
  }

  private parseEntryValue(value: string, parentIndent: number, line: number): YamlValue {
    if (/^\|[-+]?$/.test(value)) {
      return this.parseLiteralBlock(parentIndent, value.slice(1), line);
    }
    if (value.startsWith("|") || value.startsWith(">")) {
      throw new GitHubActionsYamlSyntaxError(line, "only literal block scalars are supported");
    }

    if (value !== "") {
      return parseScalar(value, line);
    }

    this.skipIgnorable();
    const child = this.lines[this.index];
    return child !== undefined && child.indent > parentIndent ? this.parseNode(child.indent) : null;
  }

  private parseLiteralBlock(parentIndent: number, chomping: string, line: number): string {
    const values: string[] = [];
    let contentIndent: number | undefined;

    while (this.index < this.lines.length) {
      const current = this.lines[this.index]!;
      if (current.raw === "" && this.index === this.lines.length - 1) {
        this.index += 1;
        break;
      }
      if (current.raw.trim() === "") {
        values.push("");
        this.index += 1;
        continue;
      }
      if (current.indent <= parentIndent) {
        break;
      }

      if (contentIndent === undefined) {
        contentIndent = current.indent;
      }
      if (current.indent < contentIndent) {
        throw new GitHubActionsYamlSyntaxError(current.number, "inconsistent block scalar indentation");
      }
      values.push(current.raw.slice(contentIndent));
      this.index += 1;
    }

    if (values.length === 0) {
      return "";
    }

    const text = values.join("\n");
    if (chomping === "-") {
      return text.replace(/\n+$/g, "");
    }
    if (chomping === "+") {
      return `${text}\n`;
    }
    return `${text.replace(/\n+$/g, "")}\n`;
  }
}

function parseWorkflow(contents: string): YamlObject {
  const parsed = new YamlSubsetParser(contents).parse();
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new GitHubActionsYamlSyntaxError(1, "workflow must be a mapping");
  }
  return parsed;
}

function objectValue(value: YamlValue | undefined, line: number, field: string): YamlObject | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new GitHubActionsYamlSyntaxError(line, `${field} must be a mapping`);
  }
  return value;
}

function triggerNames(value: YamlValue | undefined): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    if (!value.every((trigger): trigger is string => typeof trigger === "string")) {
      throw new GitHubActionsYamlSyntaxError(1, "workflow triggers must be strings");
    }
    return value;
  }
  if (typeof value === "object") {
    return Object.keys(value);
  }
  throw new GitHubActionsYamlSyntaxError(1, "workflow triggers must be a string, sequence, or mapping");
}

function containsSecret(value: YamlValue | undefined): boolean {
  if (typeof value === "string") {
    return /\bsecrets\.[A-Za-z0-9_-]+/.test(value);
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsSecret(item));
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).some((item) => containsSecret(item));
  }
  return false;
}

function usesDocker(command: string): boolean {
  return /\bdocker(?:\s|-|$)/i.test(command);
}

function workflowSteps(workflow: YamlObject): GitHubActionsRunStepReport[] {
  const jobs = objectValue(workflow.jobs, 1, "jobs");
  if (jobs === undefined) {
    return [];
  }

  const steps: GitHubActionsRunStepReport[] = [];
  const workflowHasSecret = containsSecret(workflow.env);
  for (const [jobName, jobValue] of Object.entries(jobs)) {
    const job = objectValue(jobValue, 1, `job ${jobName}`);
    if (job === undefined) {
      continue;
    }

    const services = job.services;
    if (services !== undefined) {
      objectValue(services, 1, `services for job ${jobName}`);
    }
    const jobHasServices = services !== undefined;
    const jobHasSecret = containsSecret(job.env);
    const jobSteps = job.steps;
    if (jobSteps === undefined) {
      continue;
    }
    if (!Array.isArray(jobSteps)) {
      throw new GitHubActionsYamlSyntaxError(1, `steps for job ${jobName} must be a sequence`);
    }

    for (const stepValue of jobSteps) {
      const step = objectValue(stepValue, 1, `steps for job ${jobName}`);
      if (step === undefined) {
        continue;
      }
      const run = step.run;
      if (run === undefined) {
        continue;
      }
      if (typeof run !== "string") {
        throw new GitHubActionsYamlSyntaxError(1, `run for job ${jobName} must be a string`);
      }

      const name = step.name;
      if (name !== undefined && typeof name !== "string") {
        throw new GitHubActionsYamlSyntaxError(1, `name for job ${jobName} must be a string`);
      }
      const unavailable: GitHubActionsUnavailableRequirement[] = [];
      if (jobHasServices) {
        unavailable.push("services");
      }
      if (workflowHasSecret || jobHasSecret || containsSecret(step)) {
        unavailable.push("secrets");
      }
      if (usesDocker(run)) {
        unavailable.push("docker");
      }
      steps.push({
        job: jobName,
        ...(name === undefined ? {} : { name }),
        run,
        ...(unavailable.length === 0 ? {} : { unavailable }),
      });
    }
  }

  return steps;
}

function workflowReport(file: string, workflow: YamlObject): GitHubActionsWorkflowReport {
  const name = workflow.name;
  if (name !== undefined && typeof name !== "string") {
    throw new GitHubActionsYamlSyntaxError(1, "workflow name must be a string");
  }

  return {
    file,
    ...(name === undefined ? {} : { name }),
    triggers: triggerNames(workflow.on),
    steps: workflowSteps(workflow),
  };
}

function isTestInvocation(command: string): boolean {
  return [
    /(?:^|[\s;&|])(?:pnpm|npm|yarn|bun)\s+(?:run\s+)?test(?:[:\s]|$)/i,
    /(?:^|[\s;&|])(?:npx\s+)?(?:vitest|jest|mocha|ava|pytest|rspec)\b/i,
    /(?:^|[\s;&|])(?:make|cargo|go|dotnet|mvn|gradle|rake)\s+test(?:\b|$)/i,
    /(?:^|[\s;&|])(?:node\s+)?--test(?:\b|$)/i,
  ].some((pattern) => pattern.test(command));
}

function selectedTestWorkflow(
  workflows: GitHubActionsWorkflowReport[],
): { workflow: GitHubActionsWorkflowReport; step: GitHubActionsRunStepReport } | undefined {
  let selected:
    | { workflow: GitHubActionsWorkflowReport; step: GitHubActionsRunStepReport; score: number }
    | undefined;

  for (const workflow of workflows) {
    const triggerScore = workflow.triggers.includes("pull_request")
      ? 2
      : workflow.triggers.includes("push")
        ? 1
        : 0;
    if (triggerScore === 0) {
      continue;
    }

    const step = workflow.steps.find(({ run }) => isTestInvocation(run));
    if (step === undefined) {
      continue;
    }

    const nameScore = /(?:test|check|ci)/i.test(`${workflow.name ?? ""} ${workflow.file}`) ? 1 : 0;
    const score = triggerScore * 2 + nameScore;
    if (selected === undefined || score > selected.score) {
      selected = { workflow, step, score };
    }
  }

  return selected;
}

export async function detectGitHubActions(root: string): Promise<GitHubActionsReport | null> {
  let entries: Dirent[];

  try {
    entries = await readdir(join(root, ".github/workflows"), { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }

  const files = entries
    .filter((entry) => entry.isFile() && /\.(?:yml|yaml)$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const workflows: GitHubActionsWorkflowReport[] = [];

  for (const file of files) {
    const contents = await readFile(join(root, ".github/workflows", file), "utf8");
    workflows.push(workflowReport(`.github/workflows/${file}`, parseWorkflow(contents)));
  }

  const selected = selectedTestWorkflow(workflows);
  return {
    source: ".github/workflows",
    workflows,
    ...(selected === undefined
      ? {}
      : { test: selected.step.run, testWorkflow: selected.workflow.file }),
  };
}
