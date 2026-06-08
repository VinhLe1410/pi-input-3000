import type { UsageProviderKey } from "../core/providers";
import type { UsageSnapshot } from "../core/types";
import type { UsageFetcher } from "../fetchers";
import { createUsageRefreshController } from "./usage-refresh";

interface UsageStateOptions {
  registry: Map<UsageProviderKey, UsageFetcher>;
  intervalMs: number;
}

export interface UsageState {
  start(provider: UsageProviderKey): void;
  stop(): void;
  current(): UsageSnapshot | null;
  onChange(callback: () => void): () => void;
}

export function createUsageState(options: UsageStateOptions): UsageState {
  const usageCache = new Map<UsageProviderKey, UsageSnapshot>();
  const listeners = new Set<() => void>();

  let latestUsage: UsageSnapshot | null = null;
  const refresh = createUsageRefreshController({
    registry: options.registry,
    intervalMs: options.intervalMs,
    onSnapshot(provider, snapshot) {
      const cached = usageCache.get(provider);
      if (
        snapshot.windows.length === 0 &&
        snapshot.error &&
        cached?.windows.length
      )
        return;

      usageCache.set(provider, snapshot);
      setLatestUsage(snapshot);
    },
  });

  function notifyChange(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function setLatestUsage(next: UsageSnapshot | null): void {
    if (latestUsage === next) return;
    latestUsage = next;
    notifyChange();
  }

  return {
    start(provider: UsageProviderKey): void {
      const cached = usageCache.get(provider);
      if (cached && cached.windows.length > 0) {
        setLatestUsage(cached);
      } else if (latestUsage !== null) {
        setLatestUsage(null);
      }

      refresh.start(provider);
    },
    stop(): void {
      refresh.stop();
      setLatestUsage(null);
    },
    current(): UsageSnapshot | null {
      return latestUsage;
    },
    onChange(callback: () => void): () => void {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
  };
}
