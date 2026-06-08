import type {
  ExtensionContext,
  ReadonlyFooterDataProvider,
  Theme,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { FOOTER_LAYOUT, ICONS } from "./design-tokens";
import { collectExtensionStatusSegments } from "./extension-status";

interface StatusFooterOptions {
  rightSegments?: readonly string[];
}

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

function joinStatusTexts(statusTexts: readonly string[], separator: string): string {
  return statusTexts.filter(Boolean).join(separator);
}

function fitStatusTexts(
  statusTexts: readonly string[],
  maxWidth: number,
  separator: string,
): string {
  if (maxWidth <= 0) return "";

  const fitted: string[] = [];
  for (const text of statusTexts) {
    const candidate = joinStatusTexts([...fitted, text], separator);
    if (visibleWidth(candidate) <= maxWidth) {
      fitted.push(text);
      continue;
    }

    if (fitted.length === 0) {
      return maxWidth > 1 ? truncateToWidth(text, maxWidth, "…") : "";
    }
    break;
  }

  return joinStatusTexts(fitted, separator);
}

function prependStatusArea(base: string, statusText: string, separator: string): string {
  if (!base) return statusText;
  if (!statusText) return base;
  return `${statusText}${separator}${base}`;
}

function composeBuiltInFooterContent(left: string, right: string, width: number): string {
  const leftWidth = visibleWidth(left);
  const rightWidth = visibleWidth(right);
  return leftWidth >= width
    ? truncateToWidth(left, width, "")
    : leftWidth + 1 + rightWidth <= width
      ? `${left}${" ".repeat(width - leftWidth - rightWidth)}${right}`
      : truncateToWidth(left, width, "");
}

function composeFooter(
  left: string,
  right: string,
  extensionRight: readonly string[],
  separator: string,
  width: number,
): string {
  const leftWidth = visibleWidth(left);
  const rightWidth = visibleWidth(right);
  const minimumGap = left && right ? 1 : 0;

  if (leftWidth + minimumGap + rightWidth > width) {
    return composeBuiltInFooterContent(left, right, width);
  }

  const available = Math.max(0, width - leftWidth - rightWidth - minimumGap);
  const connectorWidth = right && extensionRight.length > 0 ? visibleWidth(separator) : 0;
  const rightStatus = fitStatusTexts(
    extensionRight,
    Math.max(0, available - connectorWidth),
    separator,
  );
  const finalRight = prependStatusArea(right, rightStatus, separator);
  const gapWidth = Math.max(0, width - visibleWidth(left) - visibleWidth(finalRight));
  return `${left}${" ".repeat(gapWidth)}${finalRight}`;
}

export function renderStatusFooter(
  ctx: ExtensionContext,
  footerData: ReadonlyFooterDataProvider,
  width: number,
  theme: Theme,
  options: StatusFooterOptions = {},
): string[] {
  if (width <= 0) return [""];

  const sidePadding = width >= FOOTER_LAYOUT.sidePadding * 2 ? FOOTER_LAYOUT.sidePadding : 0;
  const innerWidth = Math.max(0, width - sidePadding * 2);
  const separator = theme.fg("dim", FOOTER_LAYOUT.separator);
  const left = renderCwd(ctx, theme);
  const right = joinStatusTexts(options.rightSegments ?? [], theme.fg("borderMuted", " "));
  const extensionStatuses = collectExtensionStatusSegments(footerData.getExtensionStatuses());
  const content = composeFooter(
    left,
    right,
    extensionStatuses.map((segment) => renderStatusChip(segment.text, theme)),
    separator,
    innerWidth,
  );

  return [
    `${" ".repeat(sidePadding)}${truncateToWidth(content, innerWidth, "")}${" ".repeat(sidePadding)}`,
  ];
}
