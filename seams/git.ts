import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const GIT_COMMAND_TIMEOUT_MS = 5000;
const GIT_COMMAND_MAX_BUFFER = 1024 * 1024;

function gitExecOptions(cwd: string) {
  return {
    cwd,
    maxBuffer: GIT_COMMAND_MAX_BUFFER,
    timeout: GIT_COMMAND_TIMEOUT_MS,
  };
}

export type GitStatusSummary = {
  branch?: string;
  dirty: boolean;
  ahead: number;
  behind: number;
};

export interface GitState {
  refresh(cwd: string, shouldApply?: () => boolean): Promise<boolean>;
  current(): GitStatusSummary;
}

export function emptyGitStatus(): GitStatusSummary {
  return {
    branch: undefined,
    dirty: false,
    ahead: 0,
    behind: 0,
  };
}

export function parseGitStatusPorcelain(stdoutText: string): GitStatusSummary {
  const status = emptyGitStatus();

  for (const line of stdoutText.split(/\r?\n/)) {
    if (!line) continue;
    if (line.startsWith("# branch.head ")) {
      const branch = line.slice("# branch.head ".length).trim();
      status.branch = branch && branch !== "(detached)" ? branch : undefined;
      continue;
    }
    if (line.startsWith("# branch.ab ")) {
      const match = line.match(/\+(\d+)\s+-(\d+)/);
      if (match) {
        status.ahead = Number(match[1] ?? 0);
        status.behind = Number(match[2] ?? 0);
      }
      continue;
    }
    if (line.startsWith("#")) continue;

    status.dirty = true;
  }

  return status;
}

export async function readGitStatus(cwd: string): Promise<GitStatusSummary> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["status", "--porcelain=2", "--branch"],
      gitExecOptions(cwd),
    );

    return parseGitStatusPorcelain(typeof stdout === "string" ? stdout : String(stdout));
  } catch {
    return emptyGitStatus();
  }
}

function sameGitStatus(a: GitStatusSummary, b: GitStatusSummary): boolean {
  return (
    a.branch === b.branch &&
    a.dirty === b.dirty &&
    a.ahead === b.ahead &&
    a.behind === b.behind
  );
}

export function createGitState(): GitState {
  let cache = emptyGitStatus();

  return {
    async refresh(cwd: string, shouldApply = () => true): Promise<boolean> {
      const next = await readGitStatus(cwd);
      if (!shouldApply()) return false;

      const changed = !sameGitStatus(cache, next);
      cache = next;
      return changed;
    },
    current(): GitStatusSummary {
      return cache;
    },
  };
}
