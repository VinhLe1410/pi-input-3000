import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { clampRenderedLines } from "../../shared/rendering";
import { thinkingColor } from "../../shared/theme";
import {
  blendRgb,
  heavyBorderChar,
  parseAnsiRgb,
  rgbBg,
  rgbFg,
  type Rgb,
} from "./border-color";
import { EDITOR_CHROME, EDITOR_LAYOUT } from "../constants";
import {
  chaseDistance,
  createBorderChase,
  type BorderChase,
} from "./border-animation";

export interface PolishedInputFrame {
  width: number;
  editorLines: string[];
  metadata: string;
  thinkingLevel: string;
  autocompleteLines?: string[];
  workingMessage?: string;
  chaseFrameIndex?: number;
  chaseFrameCount?: number;
}

export class PolishedInputFrameRenderer {
  private labelTheme: Theme;
  private defaultBorderColor: (text: string) => string;
  private activeBorderColor: (text: string) => string;
  private activeBorderRgb: Rgb | undefined;
  private colorCache = new Map<ThemeColor, Rgb | undefined>();

  constructor(labelTheme: Theme, borderColor?: (text: string) => string) {
    this.labelTheme = labelTheme;
    this.defaultBorderColor = borderColor ?? ((text: string) => labelTheme.fg("border", text));
    this.activeBorderColor = this.defaultBorderColor;
  }

  invalidate(): void {
    this.colorCache.clear();
    this.activeBorderRgb = undefined;
  }

  contentWidth(width: number): number {
    const railWidth = visibleWidth(`${EDITOR_CHROME.railCell}${EDITOR_LAYOUT.railGap}`);
    const rightRailWidth = visibleWidth(`${EDITOR_LAYOUT.rightRailGap}${EDITOR_CHROME.railCell}`);
    return Math.max(1, width - railWidth - rightRailWidth);
  }

  render(frame: PolishedInputFrame): string[] {
    this.activeBorderColor = this.frameBorderColor(frame.thinkingLevel);
    this.activeBorderRgb = parseAnsiRgb(this.activeBorderColor(" "));
    const width = Math.max(0, frame.width);
    const innerWidth = this.contentWidth(width);
    const contentLines = [
      ...frame.editorLines,
      "",
      frame.metadata,
    ];
    const autocompleteLines = frame.autocompleteLines ?? [];
    const hasSuggestions = autocompleteLines.length > 0;
    const rowCount = contentLines.length + autocompleteLines.length + (hasSuggestions ? 1 : 0);
    const chase = createBorderChase(
      width,
      rowCount,
      frame.chaseFrameIndex,
      frame.chaseFrameCount,
    );
    const rows = contentLines.map((line, index) =>
      this.renderContentRow(line, index, rowCount, width, innerWidth, chase),
    );

    if (hasSuggestions) {
      rows.push(this.renderSuggestionDivider(width));
      rows.push(
        ...autocompleteLines.map((line, index) =>
          this.renderContentRow(
            line,
            contentLines.length + 1 + index,
            rowCount,
            width,
            innerWidth,
            chase,
          ),
        ),
      );
    }

    return clampRenderedLines(
      [
        this.renderTopBorder(width, chase, frame.workingMessage),
        ...rows,
        this.renderBottomBorder(width, rowCount, chase),
      ],
      width,
    );
  }

  private frameBorderColor(thinkingLevel: string): (text: string) => string {
    return thinkingLevel
      ? (text: string) => this.labelTheme.fg(thinkingColor(thinkingLevel), text)
      : this.defaultBorderColor;
  }

  private renderContentRow(
    line: string,
    rowIndex: number,
    rowCount: number,
    width: number,
    innerWidth: number,
    chase?: BorderChase,
  ): string {
    return `${this.renderRail(rowIndex, rowCount, width, chase)}${this.fillLine(line, innerWidth)}${this.renderRightRail(rowIndex, width, chase)}`;
  }

  private renderRail(
    rowIndex?: number,
    rowCount?: number,
    width?: number,
    chase?: BorderChase,
  ): string {
    if (rowIndex === undefined || rowCount === undefined || width === undefined) {
      return this.renderRailBackgroundCell("border") + EDITOR_LAYOUT.railGap;
    }

    const pathIndex = width * 2 + rowCount + (rowCount - 1 - rowIndex);
    return this.renderRailCell(pathIndex, chase) + EDITOR_LAYOUT.railGap;
  }

  private renderRightRail(rowIndex?: number, width?: number, chase?: BorderChase): string {
    if (rowIndex === undefined || width === undefined) {
      return EDITOR_LAYOUT.rightRailGap + this.renderRailBackgroundCell("border");
    }

    const pathIndex = width + rowIndex;
    return EDITOR_LAYOUT.rightRailGap + this.renderRailCell(pathIndex, chase);
  }

  private renderTopBorder(width: number, chase?: BorderChase, workingMessage?: string): string {
    const chars: string[] = Array.from({ length: Math.max(0, width) }, (_, index) =>
      width <= 1
        ? EDITOR_CHROME.topCap
        : index === 0 || index === width - 1
          ? EDITOR_CHROME.topCap
          : EDITOR_CHROME.horizontal,
    );

    if (workingMessage && width >= 8) {
      const text = truncateToWidth(workingMessage, Math.max(0, width - 4), "");
      const label = Array.from(` ${text} `);
      const labelWidth = visibleWidth(label.join(""));

      if (labelWidth > 0 && labelWidth <= width - 2) {
        const start = Math.max(1, Math.floor((width - labelWidth) / 2));
        for (let offset = 0; offset < label.length && start + offset < width - 1; offset += 1) {
          chars[start + offset] = label[offset]!;
        }
      }
    }

    return chars
      .map((char, index) =>
        this.renderBorderCell(
          char,
          index,
          chase,
          width > 1 && (index === 0 || index === width - 1) ? "border" : "borderMuted",
        ),
      )
      .join("");
  }

  private renderSuggestionDivider(width: number): string {
    return Array.from({ length: Math.max(0, width) }, (_, index) => {
      if (width > 1 && (index === 0 || index === width - 1)) {
        return this.renderRailBackgroundCell("border");
      }

      return this.labelTheme.fg("borderMuted", EDITOR_CHROME.horizontal);
    }).join("");
  }

  private renderBottomBorder(width: number, rowCount: number, chase?: BorderChase): string {
    return Array.from({ length: Math.max(0, width) }, (_, index) => {
      const char = width <= 1
        ? EDITOR_CHROME.bottomCap
        : index === 0 || index === width - 1
          ? EDITOR_CHROME.bottomCap
          : EDITOR_CHROME.horizontal;
      const pathIndex = width + rowCount + (width - 1 - index);
      return this.renderBorderCell(
        char,
        pathIndex,
        chase,
        width > 1 && (index === 0 || index === width - 1) ? "border" : "borderMuted",
      );
    }).join("");
  }

  private renderRailCell(pathIndex: number, chase: BorderChase | undefined): string {
    const distance = chase ? chaseDistance(pathIndex, chase) : undefined;
    if (distance !== undefined && chase && distance <= chase.trailLength) {
      return this.renderRailChaseCell(distance, chase);
    }

    return this.renderRailBackgroundCell("border");
  }

  private renderRailBackgroundCell(color: ThemeColor): string {
    const rgb = color === "border" ? this.currentBorderRgb() : this.themeRgb(color);
    if (rgb) return rgbBg(rgb, EDITOR_CHROME.railCell);

    return this.labelTheme.inverse(
      color === "border"
        ? this.activeBorderColor(EDITOR_CHROME.railCell)
        : this.labelTheme.fg(color, EDITOR_CHROME.railCell),
    );
  }

  private renderRailChaseCell(distance: number, chase: BorderChase): string {
    const accent = this.themeRgb("borderAccent");
    const base = this.currentBorderRgb();
    const intensity = distance <= chase.headLength ? 1 : 1 - distance / (chase.trailLength + 1);
    const easedIntensity = intensity * intensity;

    if (!accent || !base) {
      const color = distance <= chase.heavyLength ? "borderAccent" : "border";
      return this.renderRailBackgroundCell(color);
    }

    return rgbBg(blendRgb(base, accent, easedIntensity), " ");
  }

  private currentBorderRgb(): Rgb | undefined {
    return this.activeBorderRgb;
  }

  private renderBorderCell(
    char: string,
    pathIndex: number,
    chase: BorderChase | undefined,
    baseColor: "border" | "borderMuted",
  ): string {
    const distance = chase ? chaseDistance(pathIndex, chase) : undefined;
    if (distance !== undefined && chase && distance <= chase.trailLength) {
      return this.renderChaseCell(char, distance, chase, baseColor);
    }

    return baseColor === "border"
      ? this.activeBorderColor(char)
      : this.labelTheme.fg("borderMuted", char);
  }

  private renderChaseCell(
    char: string,
    distance: number,
    chase: BorderChase,
    baseColor: "border" | "borderMuted",
  ): string {
    const accent = this.themeRgb("borderAccent");
    const base = baseColor === "border" ? this.currentBorderRgb() : this.themeRgb(baseColor);
    const isHead = distance <= chase.headLength;
    const glyph = distance <= chase.heavyLength ? heavyBorderChar(char) : char;
    const intensity = isHead ? 1 : 1 - distance / (chase.trailLength + 1);
    const easedIntensity = intensity * intensity;

    if (!accent || !base) {
      if (isHead) return this.labelTheme.bold(this.labelTheme.fg("borderAccent", glyph));
      if (distance <= chase.heavyLength) return this.labelTheme.fg("borderAccent", glyph);
      return baseColor === "border"
        ? this.activeBorderColor(char)
        : this.labelTheme.fg("borderMuted", char);
    }

    const color = blendRgb(base, accent, easedIntensity);
    const rendered = rgbFg(color, glyph);
    return isHead ? this.labelTheme.bold(rendered) : rendered;
  }

  private themeRgb(color: ThemeColor): Rgb | undefined {
    if (!this.colorCache.has(color)) {
      this.colorCache.set(color, parseAnsiRgb(this.labelTheme.getFgAnsi(color)));
    }
    return this.colorCache.get(color);
  }

  private fillLine(content: string, width: number): string {
    return truncateToWidth(content, Math.max(0, width), "", true);
  }
}
