import { clampPercent } from "../core/format";
import { fetchWithTimeout } from "../core/network";
import type { RateWindow, UsageSnapshot } from "../core/types";
import type { AuthResolver } from "../seams/auth";
import type { UsageFetcher } from "./index";
import { createUsageSnapshotBuilder } from "./snapshot";

interface GeminiBucket {
  modelId?: string;
  remainingFraction?: number;
}

interface GeminiUsageResponse {
  buckets?: GeminiBucket[];
}

export function createGeminiFetcher(auth: AuthResolver): UsageFetcher {
  return {
    async fetch(): Promise<UsageSnapshot> {
      const providerKey = "gemini";
      const snapshot = createUsageSnapshotBuilder(providerKey);
      const token = auth.tokenFor(providerKey);
      if (!token) return snapshot.noAuth();

      try {
        const res = await fetchWithTimeout(
          "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: "{}",
          },
        );

        if (!res.ok) {
          return snapshot.error(`HTTP ${res.status}`);
        }

        const data = (await res.json()) as GeminiUsageResponse;
        const quotas: Record<string, number> = {};

        for (const bucket of data.buckets || []) {
          const model = bucket.modelId || "unknown";
          const remainingFraction = bucket.remainingFraction ?? 1;
          if (!quotas[model] || remainingFraction < quotas[model]) {
            quotas[model] = remainingFraction;
          }
        }

        const windows: RateWindow[] = [];
        let proMin = 1;
        let flashMin = 1;
        let hasProModel = false;
        let hasFlashModel = false;

        for (const [model, remainingFraction] of Object.entries(quotas)) {
          if (model.toLowerCase().includes("pro")) {
            hasProModel = true;
            if (remainingFraction < proMin) proMin = remainingFraction;
          }
          if (model.toLowerCase().includes("flash")) {
            hasFlashModel = true;
            if (remainingFraction < flashMin) flashMin = remainingFraction;
          }
        }

        if (hasProModel) {
          windows.push({
            label: "Pro",
            usedPercent: clampPercent((1 - proMin) * 100),
          });
        }
        if (hasFlashModel) {
          windows.push({
            label: "Flash",
            usedPercent: clampPercent((1 - flashMin) * 100),
          });
        }

        return snapshot.success(windows);
      } catch (e: unknown) {
        return snapshot.caught(e);
      }
    },
  };
}
