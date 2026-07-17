import type { ExtensionContext, Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { AgentTimerState } from "../input-styles";
import type { GitStatusSummary } from "./git-status";
import {
  contextPercent,
  formatCwd,
  formatSessionCost,
  sessionCostTotal,
} from "../shared/session-metrics";
import { contextColor, thinkingColor } from "../shared/theme";

export type BashModeState = "off" | "with-context" | "no-context";

export function detectBashMode(text: string): BashModeState {
  if (text.startsWith("!!")) return "no-context";
  if (text.startsWith("!")) return "with-context";
  return "off";
}

const DEFAULT_BORDER_COLOR: ThemeColor = "text";

export function ampBorderColor(state: BashModeState, theme: Theme): (text: string) => string {
  if (state === "with-context") return (text) => theme.fg("bashMode", text);
  if (state === "no-context") return (text) => theme.fg("dim", text);
  return (text) => theme.fg(DEFAULT_BORDER_COLOR, text);
}

export function renderAmpTopLeftLabel(
  state: BashModeState,
  agentTimer: AgentTimerState | undefined,
  theme: Theme,
): string {
  const segments: string[] = [];

  if (state !== "off") {
    const color = state === "no-context" ? "dim" : "bashMode";
    segments.push(theme.bold(theme.fg(color, "$")));
  }

  if (agentTimer) {
    const color = agentTimer.active ? "accent" : "dim";
    segments.push(theme.fg(color, `${agentTimer.seconds}s`));
  }

  return segments.length > 0
    ? ` ${segments.join(theme.fg("borderMuted", " · "))} `
    : "";
}

export function renderAmpTopRightLabel(
  ctx: ExtensionContext,
  thinkingLevel: string,
  theme: Theme,
): string {
  const modelLabel = ctx.model?.name ?? ctx.model?.id ?? "no-model";
  const segments = [
    theme.fg("dim", formatSessionCost(sessionCostTotal(ctx))),
    theme.bold(theme.fg("text", modelLabel)),
    theme.bold(theme.fg(thinkingColor(thinkingLevel), thinkingLevel || "off")),
  ];
  const percent = contextPercent(ctx);

  if (percent !== undefined) {
    segments.push(theme.bold(theme.fg(contextColor(percent), `${percent}%`)));
  }

  return ` ${segments.join(theme.fg("borderMuted", " – "))} `;
}

function takeEndToWidth(text: string, maxWidth: number): string {
  let result = "";

  for (const character of Array.from(text).reverse()) {
    const next = `${character}${result}`;
    if (visibleWidth(next) > maxWidth) break;
    result = next;
  }

  return result;
}

function truncateMiddle(text: string, maxWidth: number): string {
  if (visibleWidth(text) <= maxWidth) return text;
  if (maxWidth <= 0) return "";
  if (maxWidth === 1) return "…";

  const availableWidth = maxWidth - 1;
  const prefixWidth = Math.max(1, Math.floor(availableWidth * 0.4));
  const suffixWidth = Math.max(0, availableWidth - prefixWidth);
  const prefix = truncateToWidth(text, prefixWidth, "");
  const suffix = takeEndToWidth(text, suffixWidth);
  return `${prefix}…${suffix}`;
}

export function renderAmpBottomLeftLabel(
  git: GitStatusSummary,
  width: number,
  theme: Theme,
): string {
  if (!git.branch) return "";

  const statusLabels = [
    ...(git.dirty ? ["*"] : []),
    ...(git.ahead > 0 ? [`↑${git.ahead}`] : []),
    ...(git.behind > 0 ? [`↓${git.behind}`] : []),
  ];
  const maxContentWidth = Math.max(1, Math.min(36, Math.floor(width * 0.4)) - 2);
  const statusWidth = statusLabels.reduce((total, label) => total + visibleWidth(label), 0);
  const separatorWidth = statusLabels.length;
  const branchWidth = Math.max(1, maxContentWidth - statusWidth - separatorWidth);
  const branch = theme.fg("text", truncateMiddle(git.branch, branchWidth));
  const statuses = [
    ...(git.dirty ? [theme.bold(theme.fg("warning", "*"))] : []),
    ...(git.ahead > 0 ? [theme.fg("success", `↑${git.ahead}`)] : []),
    ...(git.behind > 0 ? [theme.fg("error", `↓${git.behind}`)] : []),
  ];

  return ` ${[branch, ...statuses].join(" ")} `;
}
export function renderAmpBottomRightLabel(ctx: ExtensionContext, theme: Theme): string {
  return theme.fg("muted", ` ${formatCwd(ctx.cwd)} `);
}

interface BorderCaps {
  left: string;
  right: string;
}

export function fitBorderLabels(
  left: string,
  right: string,
  width: number,
  border: (text: string) => string,
  fill: (text: string) => string = border,
  caps: BorderCaps = { left: "─", right: "─" },
): string {
  if (width <= 0) return "";
  if (width === 1) return border(caps.left);

  const fixedWidth = visibleWidth(caps.left) + visibleWidth(caps.right);
  const minimumGap = 1;
  const labelWidth = Math.max(0, width - fixedWidth - minimumGap);
  const leftWidth = visibleWidth(left);
  const rightWidth = visibleWidth(right);
  const rightMaxWidth = Math.max(0, labelWidth - leftWidth);
  const rightText = rightWidth > rightMaxWidth ? truncateToWidth(right, rightMaxWidth, "") : right;
  const leftMaxWidth = Math.max(0, labelWidth - visibleWidth(rightText));
  const leftText = leftWidth > leftMaxWidth ? truncateToWidth(left, leftMaxWidth, "") : left;

  const gapWidth = Math.max(
    0,
    width - fixedWidth - visibleWidth(leftText) - visibleWidth(rightText),
  );

  return `${border(caps.left)}${leftText}${fill("─".repeat(gapWidth))}${rightText}${border(caps.right)}`;
}
