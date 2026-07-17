export interface GitStatusSummary {
  branch?: string;
  dirty: boolean;
  ahead: number;
  behind: number;
}

export function emptyGitStatus(): GitStatusSummary {
  return {
    branch: undefined,
    dirty: false,
    ahead: 0,
    behind: 0,
  };
}

export function parseGitStatus(stdout: string): GitStatusSummary {
  const status = emptyGitStatus();

  for (const line of stdout.split(/\r?\n/)) {
    if (line.startsWith("# branch.head ")) {
      const branch = line.slice("# branch.head ".length).trim();
      status.branch = branch && branch !== "(detached)" ? branch : undefined;
    } else if (line.startsWith("# branch.ab ")) {
      const counts = line.match(/\+(\d+)\s+-(\d+)/);
      status.ahead = Number(counts?.[1] ?? 0);
      status.behind = Number(counts?.[2] ?? 0);
    } else if (line && !line.startsWith("#")) {
      status.dirty = true;
    }
  }

  return status;
}

export function sameGitStatus(a: GitStatusSummary, b: GitStatusSummary): boolean {
  return a.branch === b.branch
    && a.dirty === b.dirty
    && a.ahead === b.ahead
    && a.behind === b.behind;
}
