import type {
  ExtensionContext,
  ReadonlyFooterDataProvider,
  Theme,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { FOOTER_LAYOUT, ICONS } from "../constants";
import { collectExtensionStatusSegments } from "./extension-status";

function formatCwdLabel(cwd: string): string {
  const normalized = cwd.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? cwd;
}

function renderCwd(ctx: ExtensionContext, theme: Theme): string {
  return theme.fg("accent", `${ICONS.cwd} ${formatCwdLabel(ctx.cwd)}`);
}

function renderStatusChip(text: string, theme: Theme): string {
  return [theme.fg("success", ICONS.extensionStatus), " ", theme.fg("dim", text)].join("");
}

function fitStatusTexts(
  statusTexts: readonly string[],
  maxWidth: number,
  separator: string,
): string {
  if (maxWidth <= 0) return "";

  let fitted = "";
  for (const text of statusTexts) {
    if (!text) continue;

    const candidate = fitted ? `${fitted}${separator}${text}` : text;
    if (visibleWidth(candidate) <= maxWidth) {
      fitted = candidate;
      continue;
    }

    if (!fitted) {
      return maxWidth > 1 ? truncateToWidth(text, maxWidth, "…") : "";
    }
    break;
  }

  return fitted;
}

function composeFooter(
  left: string,
  extensionStatuses: readonly string[],
  separator: string,
  width: number,
): string {
  const leftWidth = visibleWidth(left);
  if (leftWidth >= width) return truncateToWidth(left, width, "");

  const available = Math.max(0, width - leftWidth - 1);
  const statusText = fitStatusTexts(extensionStatuses, available, separator);
  if (!statusText) return left;

  const gapWidth = Math.max(1, width - leftWidth - visibleWidth(statusText));
  return `${left}${" ".repeat(gapWidth)}${statusText}`;
}

export function renderStatusFooter(
  ctx: ExtensionContext,
  footerData: ReadonlyFooterDataProvider,
  width: number,
  theme: Theme,
): string[] {
  if (width <= 0) return [""];

  const sidePadding = width >= FOOTER_LAYOUT.sidePadding * 2 ? FOOTER_LAYOUT.sidePadding : 0;
  const innerWidth = Math.max(0, width - sidePadding * 2);
  const separator = theme.fg("dim", FOOTER_LAYOUT.separator);
  const left = renderCwd(ctx, theme);
  const extensionStatuses = collectExtensionStatusSegments(footerData.getExtensionStatuses());
  const content = composeFooter(
    left,
    extensionStatuses.map((segment) => renderStatusChip(segment.text, theme)),
    separator,
    innerWidth,
  );

  return [
    `${" ".repeat(sidePadding)}${truncateToWidth(content, innerWidth, "")}${" ".repeat(sidePadding)}`,
  ];
}
