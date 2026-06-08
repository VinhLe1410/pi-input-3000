import { clampPercent, formatResetTime } from "../core/format";
import { fetchWithTimeout } from "../core/network";
import type { RateWindow, UsageSnapshot } from "../core/types";
import type { AuthResolver } from "../seams/auth";
import type { UsageFetcher } from "./index";
import { createUsageSnapshotBuilder } from "./snapshot";

interface CopilotQuotaSnapshot {
  percent_remaining?: number;
  unlimited?: boolean;
}

interface CopilotUsageResponse {
  quota_reset_date_utc?: string;
  quota_snapshots?: {
    premium_interactions?: CopilotQuotaSnapshot;
    chat?: CopilotQuotaSnapshot;
  };
}

export function createCopilotFetcher(auth: AuthResolver): UsageFetcher {
  return {
    async fetch(): Promise<UsageSnapshot> {
      const providerKey = "copilot";
      const snapshot = createUsageSnapshotBuilder(providerKey);
      const token = auth.tokenFor(providerKey);
      if (!token) return snapshot.noAuth();

      try {
        const res = await fetchWithTimeout("https://api.github.com/copilot_internal/user", {
          headers: {
            "Editor-Version": "vscode/1.96.2",
            "User-Agent": "GitHubCopilotChat/0.26.7",
            "X-Github-Api-Version": "2025-04-01",
            Accept: "application/json",
            Authorization: `token ${token}`,
          },
        });

        if (!res.ok) {
          return snapshot.error(`HTTP ${res.status}`);
        }

        const data = (await res.json()) as CopilotUsageResponse;
        const windows: RateWindow[] = [];

        const resetDate = data.quota_reset_date_utc
          ? new Date(data.quota_reset_date_utc)
          : undefined;
        const resetsIn = resetDate ? formatResetTime(resetDate) : undefined;

        if (data.quota_snapshots?.premium_interactions) {
          const premiumInteractions = data.quota_snapshots.premium_interactions;
          const usedPercent = clampPercent(
            100 - (premiumInteractions.percent_remaining || 0),
          );
          windows.push({ label: "Premium", usedPercent, resetsIn });
        }

        if (data.quota_snapshots?.chat && !data.quota_snapshots.chat.unlimited) {
          const chat = data.quota_snapshots.chat;
          windows.push({
            label: "Chat",
            usedPercent: clampPercent(100 - (chat.percent_remaining || 0)),
            resetsIn,
          });
        }

        return snapshot.success(windows);
      } catch (e: unknown) {
        return snapshot.caught(e);
      }
    },
  };
}
