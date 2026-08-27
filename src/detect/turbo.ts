import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type TurboFileName = "turbo.json";

export interface TurboTaskReport extends Record<string, unknown> {
  dependsOn: string[];
  requiresBuild?: boolean;
  env?: string[];
  passThroughEnv?: string[];
}

export interface TurboReport extends Record<string, unknown> {
  tasks?: Record<string, TurboTaskReport>;
  source: TurboFileName;
  error?: string;
}

function readStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item): item is string => typeof item === "string")
    ? value
    : undefined;
}

function readTasks(value: unknown): Record<string, TurboTaskReport> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const tasks: Record<string, TurboTaskReport> = {};
  for (const [name, taskValue] of Object.entries(value)) {
    const task =
      typeof taskValue === "object" && taskValue !== null && !Array.isArray(taskValue)
        ? (taskValue as Record<string, unknown>)
        : {};
    const dependsOn = readStringArray(task.dependsOn) ?? [];
    const env = readStringArray(task.env);
    const passThroughEnv = readStringArray(task.passThroughEnv);
    tasks[name] = {
      dependsOn,
      ...(env === undefined ? {} : { env }),
      ...(passThroughEnv === undefined ? {} : { passThroughEnv }),
    };
  }

  return tasks;
}

function dependencyTaskName(dependency: string): string {
  return dependency.startsWith("^") ? dependency.slice(1) : dependency;
}

function reachesBuild(
  taskName: string,
  tasks: Record<string, TurboTaskReport>,
  visiting: Set<string>,
): boolean {
  if (visiting.has(taskName)) {
    return false;
  }

  const task = tasks[taskName];
  if (task === undefined) {
    return taskName === "build";
  }

  visiting.add(taskName);
  const result = task.dependsOn.some((dependency) => {
    const dependencyName = dependencyTaskName(dependency);
    return dependencyName === "build" || reachesBuild(dependencyName, tasks, visiting);
  });
  visiting.delete(taskName);
  return result;
}

function markBuildDependencies(tasks: Record<string, TurboTaskReport>): void {
  for (const [name, task] of Object.entries(tasks)) {
    if (reachesBuild(name, tasks, new Set())) {
      task.requiresBuild = true;
    }
  }
}

export async function detectTurbo(root: string): Promise<TurboReport | null> {
  let contents: string;

  try {
    contents = await readFile(join(root, "turbo.json"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    return {
      source: "turbo.json",
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { source: "turbo.json" };
  }

  const config = parsed as Record<string, unknown>;
  const taskGraph = config.tasks ?? config.pipeline;
  const tasks = readTasks(taskGraph);
  markBuildDependencies(tasks);

  return {
    source: "turbo.json",
    tasks,
  };
}
