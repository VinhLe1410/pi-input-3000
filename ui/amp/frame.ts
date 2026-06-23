import type { Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { clampRenderedLines } from "../rendering";
import { fitBorderLabels } from "./labels";

const AMP_CHROME = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  vertical: "│",
  horizontal: "─",
} as const;

export interface AmpInputFrame {
  width: number;
  editorLines: string[];
  topRightLabel: string;
  bottomRightLabel: string;
  autocompleteLines?: string[];
}

export class AmpInputFrameRenderer {
  private theme: Theme;

  constructor(theme: Theme) {
    this.theme = theme;
  }

  contentWidth(width: number): number {
    return Math.max(1, width - 4);
  }

  render(frame: AmpInputFrame): string[] {
    const width = Math.max(0, frame.width);
    const innerWidth = this.contentWidth(width);
    const contentRows = [...frame.editorLines, ""];
    const autocompleteLines = frame.autocompleteLines ?? [];

    if (autocompleteLines.length > 0) {
      contentRows.push(this.renderSuggestionDivider(innerWidth));
      contentRows.push(...autocompleteLines);
    }

    return clampRenderedLines(
      [
        this.renderTopBorder(width, frame.topRightLabel),
        ...contentRows.map((line) => this.renderContentRow(line, innerWidth)),
        this.renderBottomBorder(width, frame.bottomRightLabel),
      ],
      width,
    );
  }

  private renderTopBorder(width: number, rightLabel: string): string {
    return fitBorderLabels(
      "",
      rightLabel,
      width,
      (text: string) => this.theme.fg("text", text),
      (text: string) => this.theme.fg("text", text),
      { left: AMP_CHROME.topLeft, right: AMP_CHROME.topRight },
    );
  }

  private renderBottomBorder(width: number, rightLabel: string): string {
    return fitBorderLabels(
      "",
      rightLabel,
      width,
      (text: string) => this.theme.fg("text", text),
      (text: string) => this.theme.fg("text", text),
      { left: AMP_CHROME.bottomLeft, right: AMP_CHROME.bottomRight },
    );
  }

  private renderContentRow(line: string, innerWidth: number): string {
    const border = this.theme.fg("text", AMP_CHROME.vertical);
    return `${border} ${truncateToWidth(line, innerWidth, "", true)} ${border}`;
  }

  private renderSuggestionDivider(innerWidth: number): string {
    return this.theme.fg("text", AMP_CHROME.horizontal.repeat(innerWidth));
  }
}
