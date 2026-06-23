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

const IDLE_STATE: QuotaState = { kind: "idle" };
const LOADING_STATE: QuotaState = { kind: "loading" };

function sameWindows(
  a: Extract<QuotaState, { kind: "success" | "stale" }>["windows"],
  b: Extract<QuotaState, { kind: "success" | "stale" }>["windows"],
): boolean {
  return a.length === b.length && a.every((window, index) => {
    const other = b[index];
    return other !== undefined
      && window.id === other.id
      && window.label === other.label
      && window.usedPercent === other.usedPercent
      && window.resetsIn === other.resetsIn;
  });
}

function sameVisibleState(a: QuotaState, b: QuotaState): boolean {
  switch (a.kind) {
    case "idle":
    case "loading":
    case "no-auth":
      return a.kind === b.kind;
    case "error":
      return b.kind === "error" && a.error === b.error;
    case "success":
      return b.kind === "success" && sameWindows(a.windows, b.windows);
    case "stale": {
      return b.kind === "stale"
        && a.error === b.error
        && sameWindows(a.windows, b.windows);
    }
  }
}

export function createUsageQuotaState(options: UsageQuotaStateOptions): UsageQuotaState {
  let activeContext: ExtensionContext | undefined;
  let refreshTimer: ReturnType<typeof setInterval> | undefined;
  let requestVersion = 0;
  let activeRequest: AbortController | undefined;
  let state: QuotaState = IDLE_STATE;
  let latestSuccess: Extract<QuotaState, { kind: "success" }> | undefined;

  function setState(next: QuotaState): void {
    if (sameVisibleState(state, next)) {
      state = next;
      if (next.kind === "success") latestSuccess = next;
      return;
    }

    state = next;
    if (next.kind === "success") latestSuccess = next;
    options.onChange();
  }

  function abortActiveRequest(): void {
    activeRequest?.abort();
    activeRequest = undefined;
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
    abortActiveRequest();
    const request = new AbortController();
    activeRequest = request;

    void fetchCodexQuota(ctx, request.signal).then((next) => {
      if (version !== requestVersion || activeContext !== ctx) return;
      activeRequest = undefined;
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
      if (activeContext === ctx && isCodexContext(ctx) && refreshTimer) return;

      requestVersion += 1;
      activeContext = ctx;

      if (!isCodexContext(ctx)) {
        abortActiveRequest();
        stopTimer();
        setState(IDLE_STATE);
        return;
      }

      if (state.kind === "idle" || state.kind === "error" || state.kind === "no-auth") {
        setState(LOADING_STATE);
      }

      refresh();
      startTimer();
    },
    stop(): void {
      requestVersion += 1;
      activeContext = undefined;
      abortActiveRequest();
      stopTimer();
      setState(IDLE_STATE);
    },
    current(): QuotaState {
      return state;
    },
  };
}
