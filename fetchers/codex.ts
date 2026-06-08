import { clampPercent, formatResetTime, getWindowLabel } from "../core/format";
import { fetchWithTimeout } from "../core/network";
import type { RateWindow, UsageSnapshot } from "../core/types";
import type { AuthResolver } from "../seams/auth";
import type { UsageFetcher } from "./index";
import { createUsageSnapshotBuilder } from "./snapshot";

interface CodexRateWindow {
  used_percent?: number;
  reset_at?: number;
  limit_window_seconds?: number;
}

interface CodexUsageResponse {
  rate_limit?: {
    primary_window?: CodexRateWindow;
    secondary_window?: CodexRateWindow;
  };
}

export function createCodexFetcher(auth: AuthResolver): UsageFetcher {
  return {
    async fetch(): Promise<UsageSnapshot> {
      const providerKey = "codex";
      const snapshot = createUsageSnapshotBuilder(providerKey);
      const token = auth.tokenFor(providerKey);
      if (!token) return snapshot.noAuth();

      const accountId = auth.accountIdFor?.(providerKey);

      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          "User-Agent": "pi-agent",
          Accept: "application/json",
        };

        if (accountId) {
          headers["ChatGPT-Account-Id"] = accountId;
        }

        const res = await fetchWithTimeout("https://chatgpt.com/backend-api/wham/usage", {
          method: "GET",
          headers,
        });

        if (!res.ok) {
          return snapshot.error(`HTTP ${res.status}`);
        }

        const data = (await res.json()) as CodexUsageResponse;
        const windows: RateWindow[] = [];

        if (data.rate_limit?.primary_window) {
          const primaryWindow = data.rate_limit.primary_window;
          const resetDate = primaryWindow.reset_at
            ? new Date(primaryWindow.reset_at * 1000)
            : undefined;
          const durationMs =
            typeof primaryWindow.limit_window_seconds === "number"
              ? primaryWindow.limit_window_seconds * 1000
              : undefined;

          windows.push({
            label: getWindowLabel(durationMs, "5h"),
            usedPercent: clampPercent(primaryWindow.used_percent || 0),
            resetsIn: resetDate ? formatResetTime(resetDate) : undefined,
          });
        }

        if (data.rate_limit?.secondary_window) {
          const secondaryWindow = data.rate_limit.secondary_window;
          const resetDate = secondaryWindow.reset_at
            ? new Date(secondaryWindow.reset_at * 1000)
            : undefined;
          const durationMs =
            typeof secondaryWindow.limit_window_seconds === "number"
              ? secondaryWindow.limit_window_seconds * 1000
              : undefined;

          windows.push({
            label: getWindowLabel(durationMs, "Week"),
            usedPercent: clampPercent(secondaryWindow.used_percent || 0),
            resetsIn: resetDate ? formatResetTime(resetDate) : undefined,
          });
        }

        return snapshot.success(windows);
      } catch (e: unknown) {
        return snapshot.caught(e);
      }
    },
  };
}
