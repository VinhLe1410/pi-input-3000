import { providerDisplayName, type UsageProviderKey } from "../core/providers";
import type { RateWindow, UsageSnapshot } from "../core/types";

export interface UsageSnapshotBuilder {
  success(windows: RateWindow[]): UsageSnapshot;
  error(error: string): UsageSnapshot;
  noAuth(): UsageSnapshot;
  caught(error: unknown): UsageSnapshot;
}

export function createUsageSnapshotBuilder(
  providerKey: UsageProviderKey,
): UsageSnapshotBuilder {
  const provider = providerDisplayName(providerKey);

  function build(windows: RateWindow[], error?: string): UsageSnapshot {
    const snapshot: UsageSnapshot = {
      providerKey,
      provider,
      windows,
      fetchedAt: Date.now(),
    };
    if (error !== undefined) snapshot.error = error;
    return snapshot;
  }

  return {
    success(windows: RateWindow[]): UsageSnapshot {
      return build(windows);
    },
    error(error: string): UsageSnapshot {
      return build([], error);
    },
    noAuth(): UsageSnapshot {
      return build([], "no-auth");
    },
    caught(error: unknown): UsageSnapshot {
      return build([], String(error));
    },
  };
}
