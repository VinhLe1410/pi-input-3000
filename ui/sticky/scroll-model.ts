export type JumpDirection = "previous" | "next";

export class StickyScrollModel {
  rootLines: string[] = [];
  visibleRootLines: string[] = [];
  visibleRootStart = 0;
  visibleScrollableRows = 0;
  offset = 0;
  maxOffset = 0;
  private lastRootLineCount = 0;

  updateRootWindow(lines: string[], scrollableRows: number): number {
    if (this.offset > 0 && this.lastRootLineCount > 0 && lines.length > this.lastRootLineCount) {
      this.offset += lines.length - this.lastRootLineCount;
    }

    this.rootLines = lines;
    this.lastRootLineCount = lines.length;
    this.maxOffset = Math.max(0, lines.length - scrollableRows);
    this.offset = Math.max(0, Math.min(this.offset, this.maxOffset));
    return this.updateVisibleWindow(scrollableRows);
  }

  updateVisibleWindow(scrollableRows = this.visibleScrollableRows): number {
    const rows = Math.max(1, scrollableRows);
    const start = Math.max(0, this.rootLines.length - rows - this.offset);
    const visibleLines = this.rootLines.slice(start, start + rows);
    while (visibleLines.length < rows) visibleLines.push("");

    this.visibleRootStart = start;
    this.visibleScrollableRows = rows;
    this.visibleRootLines = visibleLines;
    return start;
  }

  jumpToBottom(): boolean {
    if (this.offset === 0) return false;
    this.offset = 0;
    return true;
  }

  scrollBy(delta: number): boolean {
    const nextOffset = Math.max(0, Math.min(this.offset + delta, this.maxOffset));
    if (nextOffset === this.offset) return false;
    this.offset = nextOffset;
    return true;
  }

  scrollSelectionAtEdge(delta: number): number | null {
    const nextOffset = Math.max(0, Math.min(this.offset + delta, this.maxOffset));
    if (nextOffset === this.offset) return null;

    this.offset = nextOffset;
    const start = this.updateVisibleWindow();
    return delta > 0 ? start : start + Math.max(0, this.visibleScrollableRows - 1);
  }

  jumpToTarget(targetLines: readonly number[], direction: JumpDirection): boolean {
    const candidates = direction === "previous"
      ? targetLines.filter((line) => line < this.visibleRootStart).sort((a, b) => b - a)
      : targetLines.filter((line) => line > this.visibleRootStart).sort((a, b) => a - b);

    for (const target of candidates) {
      const nextOffset = Math.max(0, Math.min(
        this.rootLines.length - Math.max(1, this.visibleScrollableRows) - target,
        this.maxOffset,
      ));
      if (nextOffset === this.offset) continue;
      this.offset = nextOffset;
      return true;
    }

    return false;
  }
}
