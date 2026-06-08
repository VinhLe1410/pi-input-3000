import { clampPercent, formatResetTime, getWindowLabel } from "../core/format";
import { fetchWithTimeout } from "../core/network";
import type { UsageProviderKey } from "../core/providers";
import type { RateWindow, UsageSnapshot } from "../core/types";
import type { AuthResolver } from "../seams/auth";
import type { UsageFetcher } from "./index";
import { createUsageSnapshotBuilder } from "./snapshot";

interface MinimaxBaseResp {
  status_code?: number;
  status_msg?: string;
}

interface MinimaxModelRemain {
  model_name?: string;
  current_interval_total_count?: number | string;
  current_interval_usage_count?: number | string;
  end_time?: number | string;
  start_time?: number | string;
  current_weekly_total_count?: number | string;
  current_weekly_usage_count?: number | string;
  weekly_end_time?: number | string;
  weekly_start_time?: number | string;
}

interface MinimaxUsageResponse {
  base_resp?: MinimaxBaseResp;
  model_remains?: MinimaxModelRemain[];
}

type MinimaxProviderKey = Extract<UsageProviderKey, "minimax" | "minimax-cn">;

export function createMinimaxFetcher(
  auth: AuthResolver,
  provider: MinimaxProviderKey,
): UsageFetcher {
  return {
    async fetch(): Promise<UsageSnapshot> {
      const providerKey = provider;
      const snapshot = createUsageSnapshotBuilder(providerKey);
      const token = auth.tokenFor(providerKey);
      const endpoint =
        provider === "minimax-cn"
          ? "https://api.minimaxi.com/v1/api/openplatform/coding_plan/remains"
          : "https://api.minimax.io/v1/api/openplatform/coding_plan/remains";

      if (!token) {
        return snapshot.noAuth();
      }

      try {
        const res = await fetchWithTimeout(endpoint, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          return snapshot.error(`HTTP ${res.status}`);
        }

        const data = (await res.json()) as MinimaxUsageResponse;
        const baseResp = data?.base_resp;
        if (baseResp?.status_code && baseResp.status_code !== 0) {
          return snapshot.error(baseResp.status_msg || `API ${baseResp.status_code}`);
        }

        const remains = Array.isArray(data?.model_remains) ? data.model_remains : [];
        const textBucket =
          remains.find(
            (entry: MinimaxModelRemain) =>
              typeof entry?.model_name === "string" &&
              /^minimax-m/i.test(entry.model_name),
          ) ||
          remains.find(
            (entry: MinimaxModelRemain) =>
              typeof entry?.model_name === "string" && /minimax/i.test(entry.model_name),
          ) ||
          remains[0];

        if (!textBucket) {
          return snapshot.error("no-usage-data");
        }

        const windows: RateWindow[] = [];

        const intervalTotal = Number(textBucket.current_interval_total_count) || 0;
        const intervalRemaining = Number(textBucket.current_interval_usage_count) || 0;
        if (intervalTotal > 0) {
          // current_*_usage_count = remaining (confirmed against MiniMax website UI)
          const used = intervalTotal - intervalRemaining;
          const usedPercent = clampPercent((used / intervalTotal) * 100);
          const resetDate = textBucket.end_time
            ? new Date(Number(textBucket.end_time))
            : undefined;
          const durationMs =
            textBucket.start_time && textBucket.end_time
              ? Number(textBucket.end_time) - Number(textBucket.start_time)
              : undefined;
          windows.push({
            label: getWindowLabel(durationMs, "5h"),
            usedPercent,
            resetsIn: resetDate ? formatResetTime(resetDate) : undefined,
          });
        }

        const weeklyTotal = Number(textBucket.current_weekly_total_count) || 0;
        const weeklyRemaining = Number(textBucket.current_weekly_usage_count) || 0;
        if (weeklyTotal > 0) {
          // current_*_usage_count = remaining (confirmed against MiniMax website UI)
          const used = weeklyTotal - weeklyRemaining;
          const usedPercent = clampPercent((used / weeklyTotal) * 100);
          const resetDate = textBucket.weekly_end_time
            ? new Date(Number(textBucket.weekly_end_time))
            : undefined;
          const durationMs =
            textBucket.weekly_start_time && textBucket.weekly_end_time
              ? Number(textBucket.weekly_end_time) - Number(textBucket.weekly_start_time)
              : undefined;
          windows.push({
            label: getWindowLabel(durationMs, "Week"),
            usedPercent,
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
