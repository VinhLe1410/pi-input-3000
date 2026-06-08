import type { UsageProviderKey } from "../core/providers";
import type { UsageSnapshot } from "../core/types";
import type { UsageFetcher } from "../fetchers";

interface UsageRefreshOptions {
  registry: Map<UsageProviderKey, UsageFetcher>;
  intervalMs: number;
  onSnapshot(provider: UsageProviderKey, snapshot: UsageSnapshot): void;
}

export interface UsageRefreshController {
  start(provider: UsageProviderKey): void;
  stop(): void;
}

export function createUsageRefreshController(
  options: UsageRefreshOptions,
): UsageRefreshController {
  let activeProvider: UsageProviderKey | null = null;
  let refreshTimer: ReturnType<typeof setInterval> | null = null;
  let requestVersion = 0;

  function fetch(provider: UsageProviderKey): void {
    const fetcher = options.registry.get(provider);
    if (!fetcher) return;

    const fetchVersion = ++requestVersion;
    fetcher
      .fetch()
      .then((snapshot) => {
        if (activeProvider !== provider) return;
        if (fetchVersion !== requestVersion) return;
        options.onSnapshot(provider, snapshot);
      })
      .catch(() => {});
  }

  function startTimer(): void {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      if (activeProvider) fetch(activeProvider);
    }, options.intervalMs);
    refreshTimer.unref?.();
  }

  return {
    start(provider: UsageProviderKey): void {
      activeProvider = provider;
      fetch(provider);
      startTimer();
    },
    stop(): void {
      activeProvider = null;
      requestVersion += 1;
      if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
      }
    },
  };
}
