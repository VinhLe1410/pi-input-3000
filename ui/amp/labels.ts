import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import {
  contextPercent,
  formatCwd,
  formatSessionCost,
  sessionCostTotal,
} from "../../core/session-metrics";
import { contextColor, thinkingColor } from "../theme";

export function renderAmpTopRightLabel(
  ctx: ExtensionContext,
  thinkingLevel: string,
  theme: Theme,
): string {
  const segments = [
    theme.fg("dim", formatSessionCost(sessionCostTotal(ctx))),
    theme.bold(theme.fg(thinkingColor(thinkingLevel), thinkingLevel || "off")),
  ];
  const percent = contextPercent(ctx);

  if (percent !== undefined) {
    segments.push(theme.bold(theme.fg(contextColor(percent), `${percent}%`)));
  }

  return ` ${segments.join(theme.fg("borderMuted", " – "))} `;
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

  let leftText = left;
  let rightText = right;
  const fixedWidth = visibleWidth(caps.left) + visibleWidth(caps.right);
  const minimumGap = 1;

  while (
    fixedWidth + visibleWidth(leftText) + visibleWidth(rightText) + minimumGap > width &&
    visibleWidth(rightText) > 0
  ) {
    rightText = truncateToWidth(rightText, Math.max(0, visibleWidth(rightText) - 1), "");
  }

  while (
    fixedWidth + visibleWidth(leftText) + visibleWidth(rightText) + minimumGap > width &&
    visibleWidth(leftText) > 0
  ) {
    leftText = truncateToWidth(leftText, Math.max(0, visibleWidth(leftText) - 1), "");
  }

  const gapWidth = Math.max(
    0,
    width - fixedWidth - visibleWidth(leftText) - visibleWidth(rightText),
  );

  return `${border(caps.left)}${leftText}${fill("─".repeat(gapWidth))}${rightText}${border(caps.right)}`;
}
