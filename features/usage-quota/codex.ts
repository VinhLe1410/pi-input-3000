import { clampPercent, formatResetTime, getWindowLabel } from "../../core/format";
import { fetchWithTimeout } from "./network";
import { resolveCodexCredentials } from "./auth";
import type { CodexQuotaWindow, QuotaState } from "./types";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

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

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function numberField(record: UnknownRecord, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function codexRateWindowFromData(data: unknown): CodexRateWindow | undefined {
  if (!isRecord(data)) return undefined;

  return {
    used_percent: numberField(data, "used_percent"),
    reset_at: numberField(data, "reset_at"),
    limit_window_seconds: numberField(data, "limit_window_seconds"),
  };
}

function codexUsageResponseFromData(data: unknown): CodexUsageResponse {
  if (!isRecord(data)) return {};

  const rateLimit = data.rate_limit;
  if (!isRecord(rateLimit)) return {};

  return {
    rate_limit: {
      primary_window: codexRateWindowFromData(rateLimit.primary_window),
      secondary_window: codexRateWindowFromData(rateLimit.secondary_window),
    },
  };
}

function codexWindow(
  id: CodexQuotaWindow["id"],
  window: CodexRateWindow,
  fallbackLabel: string,
): CodexQuotaWindow {
  const resetDate = window.reset_at ? new Date(window.reset_at * 1000) : undefined;
  const durationMs =
    typeof window.limit_window_seconds === "number"
      ? window.limit_window_seconds * 1000
      : undefined;

  return {
    id,
    label: getWindowLabel(durationMs, fallbackLabel),
    usedPercent: clampPercent(window.used_percent ?? 0),
    resetsIn: resetDate ? formatResetTime(resetDate) : undefined,
  };
}

export async function fetchCodexQuota(ctx: ExtensionContext): Promise<QuotaState> {
  const credentials = await resolveCodexCredentials(ctx);
  if (!credentials) return { kind: "no-auth" };

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${credentials.token}`,
      "User-Agent": "pi-agent",
      Accept: "application/json",
    };

    if (credentials.accountId) {
      headers["ChatGPT-Account-Id"] = credentials.accountId;
    }

    const res = await fetchWithTimeout("https://chatgpt.com/backend-api/wham/usage", {
      method: "GET",
      headers,
    });

    if (!res.ok) return { kind: "error", error: `HTTP ${res.status}` };

    const data = codexUsageResponseFromData(await res.json());
    const windows: CodexQuotaWindow[] = [];

    if (data.rate_limit?.primary_window) {
      windows.push(codexWindow("primary", data.rate_limit.primary_window, "5h"));
    }

    if (data.rate_limit?.secondary_window) {
      windows.push(codexWindow("secondary", data.rate_limit.secondary_window, "Week"));
    }

    return { kind: "success", windows, fetchedAt: Date.now() };
  } catch (error: unknown) {
    return { kind: "error", error: String(error) };
  }
}
