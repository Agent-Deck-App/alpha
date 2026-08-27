import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export type RepoFiles = Record<string, string | object>;

export async function withRepo<Result>(
  files: RepoFiles,
  callback: (root: string) => Promise<Result>,
): Promise<Result> {
  const root = await mkdtemp(join(tmpdir(), "repo-probe-"));

  try {
    for (const [path, contents] of Object.entries(files)) {
      const file = join(root, path);
      await mkdir(dirname(file), { recursive: true });
      const text =
        typeof contents === "string" ? contents : JSON.stringify(contents, null, 2);
      await writeFile(file, text);
    }

    return await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
