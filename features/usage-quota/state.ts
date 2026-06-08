import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { fetchCodexQuota } from "./codex";
import { CODEX_PROVIDER_KEY, type QuotaState } from "./types";

interface UsageQuotaStateOptions {
  intervalMs: number;
  onChange: () => void;
}

export interface UsageQuotaState {
  start(ctx: ExtensionContext): void;
  stop(): void;
  current(): QuotaState;
}

function isCodexContext(ctx: ExtensionContext): boolean {
  return ctx.model?.provider === CODEX_PROVIDER_KEY;
}

export function createUsageQuotaState(options: UsageQuotaStateOptions): UsageQuotaState {
  let activeContext: ExtensionContext | undefined;
  let refreshTimer: ReturnType<typeof setInterval> | undefined;
  let requestVersion = 0;
  let state: QuotaState = { kind: "idle" };
  let latestSuccess: Extract<QuotaState, { kind: "success" }> | undefined;

  function setState(next: QuotaState): void {
    if (state === next) return;
    state = next;
    if (next.kind === "success") latestSuccess = next;
    options.onChange();
  }

  function stopTimer(): void {
    if (!refreshTimer) return;
    clearInterval(refreshTimer);
    refreshTimer = undefined;
  }

  function applyResolvedState(next: QuotaState): void {
    if (next.kind === "error" && latestSuccess) {
      setState({
        kind: "stale",
        windows: latestSuccess.windows,
        fetchedAt: latestSuccess.fetchedAt,
        error: next.error,
      });
      return;
    }

    setState(next);
  }

  function refresh(): void {
    const ctx = activeContext;
    if (!ctx || !isCodexContext(ctx)) return;

    const version = ++requestVersion;
    void fetchCodexQuota(ctx).then((next) => {
      if (version !== requestVersion || activeContext !== ctx) return;
      applyResolvedState(next);
    });
  }

  function startTimer(): void {
    stopTimer();
    refreshTimer = setInterval(refresh, options.intervalMs);
    refreshTimer.unref?.();
  }

  return {
    start(ctx: ExtensionContext): void {
      requestVersion += 1;
      activeContext = ctx;

      if (!isCodexContext(ctx)) {
        stopTimer();
        setState({ kind: "idle" });
        return;
      }

      if (state.kind === "idle" || state.kind === "error" || state.kind === "no-auth") {
        setState({ kind: "loading" });
      }

      refresh();
      startTimer();
    },
    stop(): void {
      requestVersion += 1;
      activeContext = undefined;
      stopTimer();
      setState({ kind: "idle" });
    },
    current(): QuotaState {
      return state;
    },
  };
}
