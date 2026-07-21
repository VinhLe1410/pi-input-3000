import { visibleWidth } from "@earendil-works/pi-tui";
import { isLeftDrag, isLeftPress, isMouseRelease, isRightPress, mouseScrollDelta, type SgrMousePacket } from "./mouse-packets.ts";
import { MouseModeController } from "./mouse-mode.ts";
import { highlightSelection, isPointInsideSelection, selectedText, stripAnsi, type SelectionArea, type SelectionPoint, type SelectionSnapshot } from "./selection.ts";

const DOUBLE_CLICK_MS = 500;
const CONTEXT_PAUSE_MS = 1200;
const RESTORE_INTERVAL_MS = 100;
const RESTORE_COUNT = 50;
interface Frame {
  width: number;
  transcript: readonly string[];
  dock: readonly string[];
  transcriptSourceRows: readonly (number | null)[];
  dockStartRow: number;
  transcriptHeight: number;
}
interface Options { mode: MouseModeController; copy(text: string): void; scroll(delta: number): boolean; requestRender(): void; now?: () => number }

export class StickyMouseSelection {
  private readonly options: Options;
  private frame: Frame = { width: 0, transcript: [], dock: [], transcriptSourceRows: [], dockStartRow: 0, transcriptHeight: 0 };
  private area: SelectionArea | null = null;
  private anchor: SelectionPoint | null = null;
  private focus: SelectionPoint | null = null;
  private dragging = false;
  private preserveFocus = false;
  private lastPress: { area: SelectionArea; line: number; at: number } | null = null;
  private restoreTimer: ReturnType<typeof setTimeout> | undefined;
  constructor(options: Options) { this.options = options; }
  updateFrame(frame: Frame): void {
    const invalidated = frame.width !== this.frame.width
      || frame.transcriptHeight !== this.frame.transcriptHeight
      || frame.dockStartRow !== this.frame.dockStartRow
      || !sameLines(frame.transcript, this.frame.transcript)
      || !sameLines(frame.dock, this.frame.dock);
    this.frame = frame;
    if (invalidated) this.clearState();
  }
  snapshot(): SelectionSnapshot { return { area: this.area, anchor: this.anchor, focus: this.focus }; }
  decorateTranscript(line: string, absoluteLine: number): string { return highlightSelection(line, absoluteLine, "transcript", this.snapshot()); }
  decorateDock(line: string, lineIndex: number): string { return highlightSelection(line, lineIndex, "dock", this.snapshot()); }
  suspend(): void {
    if (this.restoreTimer) clearTimeout(this.restoreTimer);
    this.restoreTimer = undefined;
    this.clearState();
    this.lastPress = null;
    this.options.mode.disable();
  }
  dispose(): void { this.suspend(); }

  handle(packet: SgrMousePacket): void {
    const wheel = mouseScrollDelta(packet);
    if (wheel !== 0) { this.dragging = false; if (this.options.scroll(wheel)) this.clear(); return; }
    const location = this.location(packet);
    if (isRightPress(packet)) { this.rightClick(location); return; }
    if (this.dragging && this.edgeScroll(packet)) return;
    if (this.dragging && isMouseRelease(packet)) { this.finish(packet, location); return; }
    if (!location) return;
    if (isLeftPress(packet)) this.start(location);
    else if (this.dragging && isLeftDrag(packet) && location.area === this.area) { this.focus = location.point; this.lastPress = null; this.preserveFocus = false; this.options.requestRender(); }
  }
  private location(packet: SgrMousePacket): { area: SelectionArea; point: SelectionPoint } | null {
    if (packet.row < 1) return null;
    const col = Math.max(0, packet.col - 1);
    if (packet.row <= this.frame.transcriptHeight) {
      const sourceLine = this.frame.transcriptSourceRows[packet.row - 1];
      return sourceLine === null || sourceLine === undefined
        ? null
        : { area: "transcript", point: { line: sourceLine, col } };
    }
    const line = packet.row - this.frame.dockStartRow - 1;
    return line >= 0 && line < this.frame.dock.length ? { area: "dock", point: { line, col } } : null;
  }
  private start(location: { area: SelectionArea; point: SelectionPoint }): void {
    const now = this.options.now?.() ?? Date.now();
    if (this.lastPress?.area === location.area && this.lastPress.line === location.point.line && now - this.lastPress.at <= DOUBLE_CLICK_MS) {
      this.area = location.area; this.anchor = { line: location.point.line, col: 0 }; this.focus = { line: location.point.line, col: this.lineWidth(location.area, location.point.line) }; this.preserveFocus = true; this.lastPress = null;
    } else {
      this.area = location.area; this.anchor = location.point; this.focus = location.point; this.preserveFocus = false; this.lastPress = { area: location.area, line: location.point.line, at: now };
    }
    this.dragging = true; this.options.requestRender();
  }
  private finish(packet: SgrMousePacket, location: { area: SelectionArea; point: SelectionPoint } | null): void {
    if (!this.preserveFocus) this.focus = location?.area === this.area ? location.point : this.clampedPoint(packet);
    this.dragging = false; this.preserveFocus = false;
    const text = this.text();
    if (text) {
      this.lastPress = null;
      this.options.copy(text);
    } else {
      // Retain the press timestamp across its matching release so the next
      // press can be recognized as a double-click.
      this.area = null;
      this.anchor = null;
      this.focus = null;
    }
    this.options.requestRender();
  }
  private rightClick(location: { area: SelectionArea; point: SelectionPoint } | null): void {
    this.dragging = false; this.preserveFocus = false;
    const inside = location && location.area === this.area && isPointInsideSelection(this.snapshot(), location.area, location.point);
    const text = inside ? this.text() : "";
    if (text) this.options.copy(text); else this.clear();
    this.lastPress = null; this.options.mode.pause(CONTEXT_PAUSE_MS);
    if (text) this.restoreClipboard(text, RESTORE_COUNT);
    this.options.requestRender();
  }
  private restoreClipboard(text: string, remaining: number): void {
    if (this.restoreTimer) clearTimeout(this.restoreTimer);
    this.restoreTimer = setTimeout(() => {
      this.restoreTimer = undefined;
      if (this.text() !== text) return;
      this.options.copy(text);
      if (remaining > 1) this.restoreClipboard(text, remaining - 1);
    }, RESTORE_INTERVAL_MS);
    this.restoreTimer.unref?.();
  }
  private edgeScroll(packet: SgrMousePacket): boolean {
    if (this.area !== "transcript" || !isLeftDrag(packet)) return false;
    const delta = packet.row <= 1 ? 1 : packet.row >= this.frame.transcriptHeight ? -1 : 0;
    if (delta === 0 || !this.options.scroll(delta)) return false;
    const visibleSources = this.frame.transcriptSourceRows.filter((line): line is number => line !== null);
    const first = visibleSources[0];
    const last = visibleSources.at(-1);
    if (first === undefined || last === undefined) return false;
    // Rendering is asynchronous, so several drag packets can arrive while the
    // frame still describes the viewport before the first scroll. Advance from
    // the selection focus as well as the rendered edge to keep every packet.
    const focusLine = this.focus?.line;
    const line = packet.row <= 1
      ? Math.max(0, Math.min(first, focusLine ?? first) - 1)
      : Math.min(this.frame.transcript.length - 1, Math.max(last, focusLine ?? last) + 1);
    this.focus = { line, col: Math.max(0, packet.col - 1) };
    this.lastPress = null; this.preserveFocus = true; this.options.requestRender(); return true;
  }
  private clampedPoint(packet: SgrMousePacket): SelectionPoint {
    if (this.area === "dock") return { line: Math.max(0, Math.min(this.frame.dock.length - 1, packet.row - this.frame.dockStartRow - 1)), col: Math.max(0, packet.col - 1) };
    const visibleSources = this.frame.transcriptSourceRows.filter((line): line is number => line !== null);
    const line = packet.row <= 1 ? visibleSources[0] : visibleSources.at(-1);
    return { line: line ?? 0, col: Math.max(0, packet.col - 1) };
  }
  private lineWidth(area: SelectionArea, line: number): number { return visibleWidth(stripAnsi(area === "transcript" ? this.frame.transcript[line] ?? "" : this.frame.dock[line] ?? "")); }
  private text(): string { return selectedText(this.snapshot(), this.area === "transcript" ? this.frame.transcript : this.frame.dock); }
  private clear(): void { this.clearState(); this.options.requestRender(); }
  private clearState(): void {
    this.area = null; this.anchor = null; this.focus = null; this.dragging = false; this.preserveFocus = false;
    this.lastPress = null;
  }
}

function sameLines(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((line, index) => line === right[index]);
}
