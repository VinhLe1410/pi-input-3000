import { visibleWidth } from "@earendil-works/pi-tui";

export type SelectionArea = "transcript" | "dock";
export interface SelectionPoint { readonly line: number; readonly col: number }
export interface SelectionSnapshot { readonly area: SelectionArea | null; readonly anchor: SelectionPoint | null; readonly focus: SelectionPoint | null }

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
export const stripAnsi = (text: string): string => text
  .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
  .replace(/\x1b_[\s\S]*?(?:\x07|\x1b\\)/g, "")
  .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");

function sliceColumns(text: string, start: number, end: number): string {
  let col = 0;
  let result = "";
  for (const { segment } of segmenter.segment(text)) {
    const width = Math.max(0, visibleWidth(segment));
    if (col < end && col + width > start) result += segment;
    col += width;
  }
  return result;
}
const compare = (a: SelectionPoint, b: SelectionPoint): number => a.line === b.line ? a.col - b.col : a.line - b.line;
export function selectedRangeForLine(snapshot: SelectionSnapshot, line: number, area: SelectionArea): { startCol: number; endCol: number } | null {
  if (snapshot.area !== area || !snapshot.anchor || !snapshot.focus) return null;
  const start = compare(snapshot.anchor, snapshot.focus) <= 0 ? snapshot.anchor : snapshot.focus;
  const end = start === snapshot.anchor ? snapshot.focus : snapshot.anchor;
  if (line < start.line || line > end.line) return null;
  return { startCol: line === start.line ? start.col : 0, endCol: line === end.line ? end.col : Number.POSITIVE_INFINITY };
}
export function isPointInsideSelection(snapshot: SelectionSnapshot, area: SelectionArea, point: SelectionPoint): boolean {
  const range = selectedRangeForLine(snapshot, point.line, area);
  return Boolean(range && point.col >= range.startCol && point.col < range.endCol);
}
export function highlightSelection(line: string, lineIndex: number, area: SelectionArea, snapshot: SelectionSnapshot): string {
  const range = selectedRangeForLine(snapshot, lineIndex, area);
  if (!range) return line;
  const width = visibleWidth(stripAnsi(line));
  const start = Math.max(0, Math.min(width, range.startCol));
  const end = Math.max(start, Math.min(width, range.endCol));
  if (start === end) return line;

  // Preserve every control sequence (including OSC links and CURSOR_MARKER).
  // Reassert inverse after an SGR reset occurring inside the selected span.
  const control = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\)|_[\s\S]*?(?:\x07|\x1b\\))/gy;
  let offset = 0;
  let col = 0;
  let inverse = false;
  let result = "";
  while (offset < line.length) {
    control.lastIndex = offset;
    const match = control.exec(line);
    if (match) {
      result += match[0];
      if (inverse && match[0].startsWith("\x1b[")) result += "\x1b[7m";
      offset = control.lastIndex;
      continue;
    }
    const nextEscape = line.indexOf("\x1b", offset);
    const chunkEnd = nextEscape === -1 ? line.length : nextEscape;
    const chunk = line.slice(offset, chunkEnd === offset ? offset + 1 : chunkEnd);
    for (const { segment } of segmenter.segment(chunk)) {
      const segmentWidth = Math.max(0, visibleWidth(segment));
      const selected = col < end && col + segmentWidth > start;
      if (selected !== inverse) {
        result += selected ? "\x1b[7m" : "\x1b[27m";
        inverse = selected;
      }
      result += segment;
      col += segmentWidth;
    }
    offset += chunk.length;
  }
  return result + (inverse ? "\x1b[27m" : "");
}
export function selectedText(snapshot: SelectionSnapshot, lines: readonly string[]): string {
  if (!snapshot.area || !snapshot.anchor || !snapshot.focus) return "";
  const start = compare(snapshot.anchor, snapshot.focus) <= 0 ? snapshot.anchor : snapshot.focus;
  const end = start === snapshot.anchor ? snapshot.focus : snapshot.anchor;
  if (compare(start, end) === 0) return "";
  const result: string[] = [];
  for (let index = start.line; index <= end.line; index++) {
    const line = stripAnsi(lines[index] ?? "");
    result.push(sliceColumns(line, index === start.line ? start.col : 0, index === end.line ? end.col : Infinity));
  }
  return result.join("\n").replace(/[ \t]+$/gm, "").trimEnd();
}
