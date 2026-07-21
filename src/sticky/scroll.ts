export class StickyScroll {
  private offset = 0;
  private width: number | undefined;
  private transcriptLength = 0;

  update(width: number, transcriptLength: number, maxOffset: number): number {
    if (this.width !== width) {
      this.offset = 0;
    } else if (this.offset > 0 && transcriptLength > this.transcriptLength) {
      this.offset += transcriptLength - this.transcriptLength;
    }
    this.width = width;
    this.transcriptLength = transcriptLength;
    this.offset = Math.min(Math.max(0, this.offset), maxOffset);
    return this.offset;
  }

  pageUp(pageSize: number, maxOffset: number): boolean {
    const next = Math.min(maxOffset, this.offset + Math.max(1, pageSize));
    if (next === this.offset) return false;
    this.offset = next;
    return true;
  }

  pageDown(pageSize: number): boolean {
    const next = Math.max(0, this.offset - Math.max(1, pageSize));
    if (next === this.offset) return false;
    this.offset = next;
    return true;
  }

  jumpToBottom(): boolean {
    if (this.offset === 0) return false;
    this.offset = 0;
    return true;
  }

  currentOffset(): number { return this.offset; }
}
