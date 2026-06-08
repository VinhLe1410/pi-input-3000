import { CustomEditor } from "@earendil-works/pi-coding-agent";
import type { KeybindingsManager, Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import {
  type EditorTheme,
  type TUI,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui";
import {
  blendRgb,
  heavyBorderChar,
  parseAnsiRgb,
  rgbBg,
  rgbFg,
  type Rgb,
} from "./border-chase";
import { EDITOR_LAYOUT } from "./design-tokens";
import { splitRenderedEditor } from "./editor-autocomplete";
import { renderEditorMetadata } from "./editor-badges";
import {
  chaseDistance,
  createBorderChase,
  type BorderChase,
} from "./editor-chase";
import type { EditorChrome } from "./editor-types";

export type {
  EditorBranchMeta,
  EditorChrome,
  EditorContextMeter,
  EditorMeta,
} from "./editor-types";

function padRight(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - visibleWidth(text)));
}

function clampRenderedLines(lines: string[], width: number): string[] {
  const maxWidth = Math.max(0, width);
  return lines.map((line) => truncateToWidth(line, maxWidth, ""));
}

export class PolishedInputEditor extends CustomEditor {
  private getChrome: () => EditorChrome;
  private labelTheme: Theme;
  private colorCache = new Map<ThemeColor, Rgb | undefined>();

  constructor(
    tui: TUI,
    theme: EditorTheme,
    keybindings: KeybindingsManager,
    getChrome: () => EditorChrome,
    labelTheme: Theme,
  ) {
    super(tui, theme, keybindings, { paddingX: 0 });
    this.borderColor = (text: string) => labelTheme.fg("border", text);
    this.getChrome = getChrome;
    this.labelTheme = labelTheme;
  }

  render(width: number): string[] {
    if (width <= 2) return clampRenderedLines(super.render(width), width);

    const chrome = this.getChrome();
    const { meta } = chrome;
    const rail = this.renderRail();
    const rightRail = this.renderRightRail();
    const railWidth = visibleWidth(rail);
    const rightRailWidth = visibleWidth(rightRail);
    const innerWidth = Math.max(1, width - railWidth - rightRailWidth);
    const rendered = super.render(innerWidth);

    if (rendered.length < 2) {
      return clampRenderedLines(super.render(width), width);
    }

    const { editorFrame, autocompleteLines } = splitRenderedEditor(
      this,
      rendered,
      innerWidth,
    );
    if (editorFrame.length < 2) return clampRenderedLines(rendered, width);

    const editorLines = editorFrame.slice(1, -1);
    const metadata = renderEditorMetadata(meta, innerWidth, this.labelTheme);
    const lines = ["", ...editorLines, "", metadata];
    const hasSuggestions = autocompleteLines.length > 0;
    const rowCount = lines.length + autocompleteLines.length + (hasSuggestions ? 1 : 0);
    const chase = createBorderChase(
      width,
      rowCount,
      chrome.chaseFrameIndex,
      chrome.chaseFrameCount,
    );
    const top = this.renderTopBorder(width, chase, chrome.workingMessage);
    const rows = lines.map((line, index) =>
      this.renderContentRow(line, index, rowCount, width, innerWidth, chase),
    );

    if (hasSuggestions) {
      rows.push(this.renderSuggestionDivider(width));
      rows.push(
        ...autocompleteLines.map((line, index) =>
          this.renderContentRow(line, lines.length + 1 + index, rowCount, width, innerWidth, chase),
        ),
      );
    }

    return clampRenderedLines(
      [
        top,
        ...rows,
        this.renderBottomBorder(width, rowCount, chase),
      ],
      width,
    );
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
      width <= 1 ? "▄" : index === 0 || index === width - 1 ? "▄" : "─",
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

      return this.labelTheme.fg("borderMuted", "─");
    }).join("");
  }

  private renderBottomBorder(width: number, rowCount: number, chase?: BorderChase): string {
    return Array.from({ length: Math.max(0, width) }, (_, index) => {
      const char = width <= 1 ? "▀" : index === 0 || index === width - 1 ? "▀" : "─";
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
    if (rgb) return rgbBg(rgb, " ");

    return this.labelTheme.inverse(color === "border" ? this.borderColor(" ") : this.labelTheme.fg(color, " "));
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
    return parseAnsiRgb(this.borderColor(" "));
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

    return baseColor === "border" ? this.borderColor(char) : this.labelTheme.fg("borderMuted", char);
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
      return baseColor === "border" ? this.borderColor(char) : this.labelTheme.fg("borderMuted", char);
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
    return padRight(truncateToWidth(content, Math.max(0, width), ""), width);
  }
}
