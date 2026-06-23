import { visibleWidth } from "@earendil-works/pi-tui";
import { stripAnsi } from "./ansi";

export interface SelectionPoint {
  line: number;
  col: number;
}

export type SelectionArea = "root" | "cluster";

export interface SelectionLocation {
  area: SelectionArea;
  point: SelectionPoint;
}

export interface SelectionSnapshot {
  area: SelectionArea | null;
  anchor: SelectionPoint | null;
  focus: SelectionPoint | null;
}

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function sliceColumns(text: string, startCol: number, endCol: number): string {
  let col = 0;
  let result = "";
  for (const { segment } of graphemeSegmenter.segment(text)) {
    const width = Math.max(0, visibleWidth(segment));
    if (col >= startCol && col < endCol) result += segment;
    col += width;
  }
  return result;
}

function compareSelectionPoints(a: SelectionPoint, b: SelectionPoint): number {
  return a.line === b.line ? a.col - b.col : a.line - b.line;
}

export function selectedRangeForLine(
  snapshot: SelectionSnapshot,
  lineIndex: number,
  area: SelectionArea,
): { startCol: number; endCol: number } | null {
  if (snapshot.area !== area || !snapshot.anchor || !snapshot.focus) return null;

  const start = compareSelectionPoints(snapshot.anchor, snapshot.focus) <= 0
    ? snapshot.anchor
    : snapshot.focus;
  const end = start === snapshot.anchor ? snapshot.focus : snapshot.anchor;
  if (lineIndex < start.line || lineIndex > end.line) return null;

  return {
    startCol: lineIndex === start.line ? start.col : 0,
    endCol: lineIndex === end.line ? end.col : Number.POSITIVE_INFINITY,
  };
}

export function isLocationInsideSelection(
  snapshot: SelectionSnapshot,
  location: SelectionLocation | null,
): boolean {
  if (!location || location.area !== snapshot.area) return false;
  const range = selectedRangeForLine(snapshot, location.point.line, location.area);
  return Boolean(range && location.point.col >= range.startCol && location.point.col < range.endCol);
}

export function renderSelectionHighlight(
  line: string,
  lineIndex: number,
  area: SelectionArea,
  snapshot: SelectionSnapshot,
): string {
  const range = selectedRangeForLine(snapshot, lineIndex, area);
  if (!range) return line;

  const plain = stripAnsi(line);
  const plainWidth = visibleWidth(plain);
  const startCol = Math.max(0, Math.min(range.startCol, plainWidth));
  const endCol = Math.max(startCol, Math.min(range.endCol, plainWidth));
  if (startCol === endCol) return line;

  const before = sliceColumns(plain, 0, startCol);
  const selected = sliceColumns(plain, startCol, endCol);
  const after = sliceColumns(plain, endCol, Number.POSITIVE_INFINITY);
  return `${before}\x1b[7m${selected}\x1b[27m${after}`;
}

export function selectedText(snapshot: SelectionSnapshot, lines: readonly string[]): string {
  if (!snapshot.area || !snapshot.anchor || !snapshot.focus) return "";

  const start = compareSelectionPoints(snapshot.anchor, snapshot.focus) <= 0
    ? snapshot.anchor
    : snapshot.focus;
  const end = start === snapshot.anchor ? snapshot.focus : snapshot.anchor;
  if (start.line === end.line && start.col === end.col) return "";

  const selected: string[] = [];
  for (let lineIndex = start.line; lineIndex <= end.line; lineIndex++) {
    const line = stripAnsi(lines[lineIndex] ?? "");
    const startCol = lineIndex === start.line ? start.col : 0;
    const endCol = lineIndex === end.line ? end.col : Number.POSITIVE_INFINITY;
    selected.push(sliceColumns(line, startCol, endCol));
  }

  return selected.join("\n").replace(/[ \t]+$/gm, "").trimEnd();
}
