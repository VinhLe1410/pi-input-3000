export interface ViewportResult {
  readonly lines: string[];
  readonly maxOffset: number;
  readonly offset: number;
}

export interface DockedFrame extends ViewportResult {
  /** Source transcript index for each screen row; padding and dock rows are null. */
  readonly transcriptSourceRows: readonly (number | null)[];
  readonly dockStartRow: number;
  readonly transcriptHeight: number;
}

export function viewportFromBottom(
  lines: readonly string[],
  height: number,
  requestedOffset: number,
): ViewportResult {
  const safeHeight = Math.max(0, Math.floor(height));
  const maxOffset = Math.max(0, lines.length - safeHeight);
  const offset = Math.min(maxOffset, Math.max(0, Math.floor(requestedOffset)));
  const end = Math.max(0, lines.length - offset);
  const start = Math.max(0, end - safeHeight);
  return { lines: lines.slice(start, end), maxOffset, offset };
}

export function composeDockedFrame(
  transcript: readonly string[],
  dock: readonly string[],
  terminalHeight: number,
  offset: number,
): DockedFrame {
  const height = Math.max(0, Math.floor(terminalHeight));
  const visibleDock = dock.slice(-height);
  const transcriptHeight = Math.max(0, height - visibleDock.length);
  const viewport = viewportFromBottom(transcript, transcriptHeight, offset);
  const padding = Math.max(0, transcriptHeight - viewport.lines.length);
  const sourceStart = Math.max(0, transcript.length - viewport.offset - viewport.lines.length);
  return {
    ...viewport,
    transcriptHeight,
    dockStartRow: transcriptHeight,
    transcriptSourceRows: [
      ...viewport.lines.map((_, index) => sourceStart + index),
      ...Array<null>(padding).fill(null),
      ...Array<null>(visibleDock.length).fill(null),
    ],
    lines: [...viewport.lines, ...Array<string>(padding).fill(""), ...visibleDock],
  };
}
