import type { Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { clampRenderedLines } from "../shared/rendering";
import { fitBorderLabels } from "./labels";

const AMP_CHROME = {
  topLeft: "╭─",
  topRight: "─╮",
  bottomLeft: "╰─",
  bottomRight: "─╯",
  vertical: "│",
  horizontal: "─",
} as const;

export interface AmpInputFrame {
  width: number;
  editorLines: string[];
  topRightLabel: string;
  bottomLeftLabel?: string;
  bottomRightLabel: string;
  topLeftLabel?: string;
  borderColor?: (text: string) => string;
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
    const borderColor = frame.borderColor ?? ((text: string) => this.theme.fg("text", text));
    const topLeftLabel = frame.topLeftLabel ?? "";
    const contentRows = [...frame.editorLines, ""];
    const autocompleteLines = frame.autocompleteLines ?? [];

    if (autocompleteLines.length > 0) {
      contentRows.push(this.renderSuggestionDivider(innerWidth, borderColor));
      contentRows.push(...autocompleteLines);
    }

    return clampRenderedLines(
      [
        this.renderTopBorder(width, topLeftLabel, frame.topRightLabel, borderColor),
        ...contentRows.map((line) => this.renderContentRow(line, innerWidth, borderColor)),
        this.renderBottomBorder(
          width,
          frame.bottomLeftLabel ?? "",
          frame.bottomRightLabel,
          borderColor,
        ),
      ],
      width,
    );
  }

  private renderTopBorder(
    width: number,
    leftLabel: string,
    rightLabel: string,
    borderColor: (text: string) => string,
  ): string {
    return fitBorderLabels(
      leftLabel,
      rightLabel,
      width,
      borderColor,
      borderColor,
      { left: AMP_CHROME.topLeft, right: AMP_CHROME.topRight },
    );
  }

  private renderBottomBorder(
    width: number,
    leftLabel: string,
    rightLabel: string,
    borderColor: (text: string) => string,
  ): string {
    return fitBorderLabels(
      leftLabel,
      rightLabel,
      width,
      borderColor,
      borderColor,
      { left: AMP_CHROME.bottomLeft, right: AMP_CHROME.bottomRight },
    );
  }

  private renderContentRow(
    line: string,
    innerWidth: number,
    borderColor: (text: string) => string,
  ): string {
    const border = borderColor(AMP_CHROME.vertical);
    return `${border} ${truncateToWidth(line, innerWidth, "", true)} ${border}`;
  }

  private renderSuggestionDivider(
    innerWidth: number,
    borderColor: (text: string) => string,
  ): string {
    return borderColor(AMP_CHROME.horizontal.repeat(innerWidth));
  }
}
