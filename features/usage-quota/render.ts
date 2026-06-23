import type { Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { roundedDisplayPercent } from "../../core/format";
import { percentColor } from "../../ui/theme";
import { QUOTA_BADGE_LABELS, QUOTA_ICONS } from "./config";
import type { CodexQuotaWindow, QuotaState } from "./types";

function quotaLabel(label: string): string {
  const normalized = label.trim().toLowerCase();
  return QUOTA_BADGE_LABELS[normalized] ?? label.trim().toUpperCase();
}

function renderQuotaBadge(window: CodexQuotaWindow, theme: Theme): string {
  const rounded = roundedDisplayPercent(window.usedPercent);
  const label = theme.bg(
    "toolPendingBg",
    theme.bold(theme.fg("muted", ` ${quotaLabel(window.label)} `)),
  );
  const percent = theme.inverse(theme.bold(theme.fg(percentColor(rounded), ` ${rounded}% `)));
  const reset = window.resetsIn
    ? theme.bg("toolPendingBg", theme.fg("text", ` ${QUOTA_ICONS.reset} ${window.resetsIn} `))
    : "";

  return `${label}${percent}${reset}`;
}

function renderQuotaStateBadge(text: string, theme: Theme, color: "warning" | "error"): string {
  return theme.inverse(theme.bold(theme.fg(color, ` CODEX ${text} `)));
}

function compactError(error: string): string {
  return truncateToWidth(error.replace(/\s+/g, " ").trim(), 18, "…");
}

export function renderQuotaSegments(state: QuotaState, theme: Theme): string[] {
  switch (state.kind) {
    case "idle":
      return [];
    case "loading":
      return [renderQuotaStateBadge("…", theme, "warning")];
    case "no-auth":
      return [renderQuotaStateBadge("NO AUTH", theme, "warning")];
    case "error":
      return [renderQuotaStateBadge(`ERR ${compactError(state.error)}`, theme, "error")];
    case "success":
      return state.windows.map((window) => renderQuotaBadge(window, theme));
    case "stale":
      return [
        ...state.windows.map((window) => renderQuotaBadge(window, theme)),
        renderQuotaStateBadge(`STALE ${compactError(state.error)}`, theme, "warning"),
      ];
  }
}
