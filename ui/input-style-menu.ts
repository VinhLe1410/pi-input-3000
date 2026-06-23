import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import {
  type SelectItem,
  SelectList,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui";
import { contextPercent } from "../core/session-metrics";
import { isInputStyle, type InputStyle } from "../core/input-style-config";
import { EDITOR_CHROME, EDITOR_LAYOUT } from "./design-tokens";
import { getThinkingLevel } from "./editor-meta";
import { contextColor, thinkingColor } from "./theme";
import {
  fitBorderLabels,
  renderAmpBottomRightLabel,
  renderAmpTopRightLabel,
} from "./amp/labels";

function selectListTheme(theme: Theme) {
  return {
    selectedPrefix: (text: string) => theme.fg("accent", text),
    selectedText: (text: string) => theme.fg("accent", theme.bold(text)),
    description: (text: string) => theme.fg("muted", text),
    scrollInfo: (text: string) => theme.fg("dim", text),
    noMatch: (text: string) => theme.fg("warning", text),
  };
}

function itemLabel(label: string, style: InputStyle, currentStyle: InputStyle): string {
  return style === currentStyle ? `${label} (current)` : label;
}

function styleItems(currentStyle: InputStyle): SelectItem[] {
  return [
    {
      value: "default",
      label: itemLabel("Default", "default", currentStyle),
      description: "Current pi-input-3000 chrome with badges, footer, and border chase",
    },
    {
      value: "amp",
      label: itemLabel("Amp-inspired", "amp", currentStyle),
      description: "Minimal chrome: cost, thinking, context %, and cwd only",
    },
  ];
}

function defaultPreviewBorder(
  width: number,
  theme: Theme,
  cap: string,
): string {
  return Array.from({ length: Math.max(0, width) }, (_, index) => {
    const isCap = width <= 1 || index === 0 || index === width - 1;
    return theme.fg(isCap ? "border" : "borderMuted", isCap ? cap : EDITOR_CHROME.horizontal);
  }).join("");
}

function accentBorder(width: number, theme: Theme): string {
  return theme.fg("accent", EDITOR_CHROME.horizontal.repeat(Math.max(0, width)));
}

function padRight(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - visibleWidth(text)));
}

function defaultRailCell(theme: Theme): string {
  return theme.inverse(theme.fg("border", EDITOR_CHROME.railCell));
}

function defaultPreviewRow(content: string, width: number, theme: Theme): string {
  const rail = defaultRailCell(theme);
  const innerWidth = Math.max(
    0,
    width - visibleWidth(rail) * 2 - visibleWidth(EDITOR_LAYOUT.railGap) - visibleWidth(EDITOR_LAYOUT.rightRailGap),
  );

  return [
    rail,
    EDITOR_LAYOUT.railGap,
    padRight(truncateToWidth(content, innerWidth, ""), innerWidth),
    EDITOR_LAYOUT.rightRailGap,
    rail,
  ].join("");
}

function renderDefaultPreview(
  ctx: ExtensionContext,
  width: number,
  theme: Theme,
  thinkingLevel: string,
): string[] {
  const previewWidth = Math.max(0, width);
  const percent = contextPercent(ctx);
  const contextLabel = percent === undefined
    ? ""
    : theme.bold(theme.fg(contextColor(percent), ` CTX ${percent}% `));
  const thinkingLabel = thinkingLevel && thinkingLevel !== "off"
    ? theme.inverse(theme.bold(theme.fg(thinkingColor(thinkingLevel), ` ${thinkingLevel.toUpperCase()} `)))
    : "";
  const modelLabel = theme.bg(
    "toolPendingBg",
    theme.bold(theme.fg("text", ` ${ctx.model?.name ?? ctx.model?.id ?? "no-model"} `)),
  );
  const meta = [modelLabel, thinkingLabel, contextLabel].filter(Boolean).join(" ");

  return [
    defaultPreviewBorder(previewWidth, theme, EDITOR_CHROME.topCap),
    defaultPreviewRow(
      theme.fg("dim", "current design keeps the full status footer and animated border"),
      previewWidth,
      theme,
    ),
    defaultPreviewRow("", previewWidth, theme),
    defaultPreviewRow(meta, previewWidth, theme),
    defaultPreviewBorder(previewWidth, theme, EDITOR_CHROME.bottomCap),
  ];
}

function renderAmpPreview(
  ctx: ExtensionContext,
  width: number,
  theme: Theme,
  thinkingLevel: string,
): string[] {
  const previewWidth = Math.max(0, width);
  const innerWidth = Math.max(0, previewWidth - 4);
  const previewBorder = (text: string) => theme.fg("borderMuted", text);
  const vertical = previewBorder("│");
  const emptyRow = `${vertical} ${" ".repeat(innerWidth)} ${vertical}`;

  return [
    fitBorderLabels(
      "",
      renderAmpTopRightLabel(ctx, thinkingLevel, theme),
      previewWidth,
      previewBorder,
      previewBorder,
      { left: "╭", right: "╮" },
    ),
    emptyRow,
    emptyRow,
    fitBorderLabels(
      "",
      renderAmpBottomRightLabel(ctx, theme),
      previewWidth,
      previewBorder,
      previewBorder,
      { left: "╰", right: "╯" },
    ),
  ];
}

function renderPreview(
  ctx: ExtensionContext,
  style: InputStyle,
  width: number,
  theme: Theme,
): string[] {
  const thinkingLevel = getThinkingLevel(ctx);
  const title = theme.fg("dim", "Preview");
  const previewWidth = Math.max(0, width);
  const bodyWidth = Math.min(previewWidth, 92);
  const leftPad = Math.max(0, Math.floor((previewWidth - bodyWidth) / 2));
  const pad = " ".repeat(leftPad);
  const body = style === "amp"
    ? renderAmpPreview(ctx, bodyWidth, theme, thinkingLevel)
    : renderDefaultPreview(ctx, bodyWidth, theme, thinkingLevel);

  return [
    title,
    ...body.map((line) => `${pad}${truncateToWidth(line, bodyWidth, "")}`),
  ];
}

export async function showInputStyleMenu(
  ctx: ExtensionContext,
  currentStyle: InputStyle,
): Promise<InputStyle | undefined> {
  return ctx.ui.custom<InputStyle | undefined>((tui, theme, _keybindings, done) => {
    let previewStyle = currentStyle;
    const selectList = new SelectList(
      styleItems(currentStyle),
      2,
      selectListTheme(theme),
      { minPrimaryColumnWidth: 18, maxPrimaryColumnWidth: 28 },
    );

    selectList.setSelectedIndex(currentStyle === "amp" ? 1 : 0);
    selectList.onSelectionChange = (item) => {
      if (isInputStyle(item.value)) previewStyle = item.value;
      tui.requestRender();
    };
    selectList.onSelect = (item) => {
      done(isInputStyle(item.value) ? item.value : undefined);
    };
    selectList.onCancel = () => done(undefined);

    return {
      render(width: number): string[] {
        const heading = theme.fg("accent", theme.bold("Input Style"));
        const hint = theme.fg("dim", "↑↓ preview • enter select • esc cancel");
        const selection = selectList.render(width);
        const preview = renderPreview(ctx, previewStyle, width, theme);
        const lines = [
          accentBorder(width, theme),
          heading,
          "",
          ...selection,
          "",
          ...preview,
          "",
          hint,
          accentBorder(width, theme),
        ];
        return lines.map((line) => {
          const lineWidth = visibleWidth(line);
          return lineWidth <= width ? line : truncateToWidth(line, width, "");
        });
      },
      invalidate(): void {
        selectList.invalidate();
      },
      handleInput(data: string): void {
        selectList.handleInput(data);
        tui.requestRender();
      },
    };
  });
}
