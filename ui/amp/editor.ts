import { CustomEditor } from "@earendil-works/pi-coding-agent";
import type {
  ExtensionContext,
  KeybindingsManager,
  Theme,
} from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { splitRenderedEditor } from "../editor-autocomplete";
import {
  fitBorderLabels,
  renderAmpBottomRightLabel,
  renderAmpTopRightLabel,
} from "./labels";

const AMP_CHROME = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  vertical: "│",
  horizontal: "─",
};

function padRight(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - visibleWidth(text)));
}

function clampRenderedLines(lines: string[], width: number): string[] {
  const maxWidth = Math.max(0, width);
  return lines.map((line) => truncateToWidth(line, maxWidth, ""));
}

export class AmpInputEditor extends CustomEditor {
  private getThinkingLevel: () => string;
  private labelTheme: Theme;
  private ctx: ExtensionContext;

  constructor(
    tui: TUI,
    theme: EditorTheme,
    keybindings: KeybindingsManager,
    ctx: ExtensionContext,
    getThinkingLevel: () => string,
    labelTheme: Theme,
  ) {
    super(tui, theme, keybindings, { paddingX: 0 });
    this.ctx = ctx;
    this.getThinkingLevel = getThinkingLevel;
    this.labelTheme = labelTheme;
  }

  render(width: number): string[] {
    if (width <= 4) return clampRenderedLines(super.render(width), width);

    const innerWidth = Math.max(1, width - 4);
    const rendered = super.render(innerWidth);
    const { editorFrame, autocompleteLines } = splitRenderedEditor(
      this,
      rendered,
      innerWidth,
    );

    if (editorFrame.length < 2) return clampRenderedLines(super.render(width), width);

    const contentRows = [...editorFrame.slice(1, -1), ""];
    const hasSuggestions = autocompleteLines.length > 0;

    if (hasSuggestions) {
      contentRows.push(this.renderSuggestionDivider(innerWidth));
      contentRows.push(...autocompleteLines);
    }

    return clampRenderedLines(
      [
        this.renderTopBorder(width),
        ...contentRows.map((line) => this.renderContentRow(line, innerWidth)),
        this.renderBottomBorder(width),
      ],
      width,
    );
  }

  private renderTopBorder(width: number): string {
    return fitBorderLabels(
      "",
      renderAmpTopRightLabel(this.ctx, this.getThinkingLevel(), this.labelTheme),
      width,
      (text: string) => this.labelTheme.fg("borderMuted", text),
      (text: string) => this.labelTheme.fg("borderMuted", text),
      { left: AMP_CHROME.topLeft, right: AMP_CHROME.topRight },
    );
  }

  private renderBottomBorder(width: number): string {
    return fitBorderLabels(
      "",
      renderAmpBottomRightLabel(this.ctx, this.labelTheme),
      width,
      (text: string) => this.labelTheme.fg("borderMuted", text),
      (text: string) => this.labelTheme.fg("borderMuted", text),
      { left: AMP_CHROME.bottomLeft, right: AMP_CHROME.bottomRight },
    );
  }

  private renderContentRow(line: string, innerWidth: number): string {
    const border = this.labelTheme.fg("borderMuted", AMP_CHROME.vertical);
    return `${border} ${padRight(truncateToWidth(line, innerWidth, ""), innerWidth)} ${border}`;
  }

  private renderSuggestionDivider(innerWidth: number): string {
    return this.labelTheme.fg("borderMuted", AMP_CHROME.horizontal.repeat(innerWidth));
  }
}
