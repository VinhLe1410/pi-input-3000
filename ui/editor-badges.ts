import type { Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { EDITOR_LAYOUT } from "./design-tokens";
import type { EditorBranchMeta, EditorContextMeter, EditorMeta } from "./editor-types";
import { contextColor, thinkingColor } from "./theme";

export function renderEditorMetadata(
  meta: EditorMeta,
  width: number,
  theme: Theme,
): string {
  const left = renderIdentityBadge(meta, theme);
  const right = meta.contextMeter ? renderContextMeter(meta.contextMeter, theme) : "";

  if (!right) return truncateToWidth(left, width, "");

  const leftWidth = visibleWidth(left);
  const rightWidth = visibleWidth(right);
  const gapWidth = width - leftWidth - rightWidth;
  if (gapWidth >= 2) return `${left}${" ".repeat(gapWidth)}${right}`;

  return truncateToWidth(left, width, "");
}

function renderIdentityBadge(meta: EditorMeta, theme: Theme): string {
  const model = theme.bg(
    "toolPendingBg",
    theme.bold(theme.fg("text", ` ${meta.modelLabel} `)),
  );
  const effort = renderEffortBadge(meta.thinkingLevel, theme);
  const branch = meta.branch ? `  ${renderBranchBadge(meta.branch, theme)}` : "";

  return `${model}${effort}${branch}`;
}

function renderEffortBadge(thinkingLevel: string, theme: Theme): string {
  if (!thinkingLevel || thinkingLevel === "off") return "";

  return theme.inverse(
    theme.bold(
      theme.fg(thinkingColor(thinkingLevel), ` ${thinkingLevel.toUpperCase()} `),
    ),
  );
}

function renderBranchBadge(branch: EditorBranchMeta, theme: Theme): string {
  const color = branch.dirty ? "warning" : "success";
  const ahead = branch.ahead > 0 ? theme.fg("success", ` ↑${branch.ahead}`) : "";
  const behind = branch.behind > 0 ? theme.fg("error", ` ↓${branch.behind}`) : "";
  const dirty = branch.dirty ? theme.fg("warning", " *") : "";

  return [
    theme.fg(color, " "),
    theme.bold(theme.fg(color, branch.name)),
    dirty,
    ahead,
    behind,
  ].join("");
}

function renderContextMeter(meter: EditorContextMeter, theme: Theme): string {
  const clampedPercent = Math.max(0, Math.min(100, meter.percent));
  const filledCells = Math.round(
    (EDITOR_LAYOUT.contextMeterWidth * clampedPercent) / 100,
  );
  const color = contextColor(meter.percent);
  const bar = Array.from({ length: EDITOR_LAYOUT.contextMeterWidth }, (_, index) => {
    const isFilled = index < filledCells;
    return theme.fg(isFilled ? color : "borderMuted", isFilled ? "━" : "─");
  }).join("");

  return [
    theme.fg("muted", "CTX"),
    theme.fg("borderMuted", " "),
    bar,
    theme.fg("borderMuted", " "),
    theme.bold(theme.fg("text", meter.label)),
  ].join("");
}
