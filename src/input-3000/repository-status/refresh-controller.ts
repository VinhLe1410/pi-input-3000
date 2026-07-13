import type { GitState } from "./git-status";

interface ProjectRefreshOptions {
  git: GitState;
  intervalMs: number;
  onChange: () => void;
}

export interface ProjectRefreshController {
  start(cwd: string): void;
  stop(): void;
  schedule(): void;
}

export function createProjectRefreshController(
  options: ProjectRefreshOptions,
): ProjectRefreshController {
  let generation = 0;
  let activeCwd: string | undefined;
  let refreshTimer: ReturnType<typeof setInterval> | undefined;
  let refreshInFlight = false;
  let refreshPending = false;

  function isCurrent(refreshGeneration: number, cwd: string): boolean {
    return refreshGeneration === generation && cwd === activeCwd;
  }

  function schedule(): void {
    const cwd = activeCwd;
    if (!cwd) return;

    const refreshGeneration = generation;
    if (refreshInFlight) {
      refreshPending = true;
      return;
    }

    refreshInFlight = true;
    options.git
      .refresh(cwd, () => isCurrent(refreshGeneration, cwd))
      .then((changed) => {
        if (!isCurrent(refreshGeneration, cwd)) return;
        if (changed) options.onChange();
      })
      .finally(() => {
        if (!isCurrent(refreshGeneration, cwd)) return;

        refreshInFlight = false;
        if (refreshPending) {
          refreshPending = false;
          schedule();
        }
      });
  }

  return {
    start(cwd: string): void {
      if (activeCwd === cwd && refreshTimer) return;

      generation += 1;
      activeCwd = cwd;
      refreshInFlight = false;
      refreshPending = false;
      if (refreshTimer) clearInterval(refreshTimer);

      schedule();
      refreshTimer = setInterval(schedule, options.intervalMs);
      refreshTimer.unref?.();
    },
    stop(): void {
      generation += 1;
      if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = undefined;
      }
      activeCwd = undefined;
      refreshInFlight = false;
      refreshPending = false;
    },
    schedule,
  };
}
