import { formatResetTime, normalizePercent } from "../core/format";
import { fetchWithTimeout } from "../core/network";
import type { RateWindow, UsageSnapshot } from "../core/types";
import type { AuthResolver } from "../seams/auth";
import type { UsageFetcher } from "./index";
import { createUsageSnapshotBuilder } from "./snapshot";

interface ClaudeUsageResponse {
  five_hour?: { utilization: number; resets_at?: string };
  seven_day?: { utilization: number; resets_at?: string };
}

export function createClaudeFetcher(auth: AuthResolver): UsageFetcher {
  return {
    async fetch(): Promise<UsageSnapshot> {
      const providerKey = "claude";
      const snapshot = createUsageSnapshotBuilder(providerKey);
      const token = auth.tokenFor(providerKey);
      if (!token) return snapshot.noAuth();

      try {
        const res = await fetchWithTimeout("https://api.anthropic.com/api/oauth/usage", {
          headers: {
            Authorization: `Bearer ${token}`,
            "anthropic-beta": "oauth-2025-04-20",
          },
        });

        if (!res.ok) {
          return snapshot.error(`HTTP ${res.status}`);
        }

        const data = (await res.json()) as ClaudeUsageResponse;
        const windows: RateWindow[] = [];

        if (data.five_hour?.utilization !== undefined) {
          windows.push({
            label: "5h",
            usedPercent: normalizePercent(data.five_hour.utilization),
            resetsIn: data.five_hour.resets_at
              ? formatResetTime(new Date(data.five_hour.resets_at))
              : undefined,
          });
        }

        if (data.seven_day?.utilization !== undefined) {
          windows.push({
            label: "Week",
            usedPercent: normalizePercent(data.seven_day.utilization),
            resetsIn: data.seven_day.resets_at
              ? formatResetTime(new Date(data.seven_day.resets_at))
              : undefined,
          });
        }

        return snapshot.success(windows);
      } catch (e: unknown) {
        return snapshot.caught(e);
      }
    },
  };
}
