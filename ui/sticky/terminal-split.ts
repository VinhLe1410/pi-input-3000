import { truncateToWidth, visibleWidth, type Component, type Terminal } from "@earendil-works/pi-tui";
import {
  beginSynchronizedOutput,
  clearLine,
  disableAlternateScrollMode,
  disableExtendedKeyboardMode,
  disableMouseReporting,
  enableAlternateScrollMode,
  enterAlternateScreen,
  enableExtendedKeyboardMode,
  enableMouseReporting,
  endSynchronizedOutput,
  exitAlternateScreen,
  hideCursor,
  moveCursor,
  resetExtendedKeyboardModes,
  resetScrollRegion,
  setScrollRegion,
  showCursor,
  stripAnsi,
  stripOscSequences,
  type ExtendedKeyboardMode,
} from "./ansi";
import {
  isLeftDrag,
  isLeftPress,
  isMouseRelease,
  isRightPress,
  mouseScrollDelta,
  parseKeyboardScrollDelta,
  parseSgrMousePackets,
  type SgrMousePacket,
} from "./terminal-input";
import type { FixedEditorClusterRender } from "./cluster.ts";
import { PiTuiAdapter } from "./pi-tui-adapter";
import { StickyScrollModel, type JumpDirection } from "./scroll-model";
import {
  isLocationInsideSelection,
  renderSelectionHighlight as renderSelectedLine,
  selectedText,
  type SelectionArea,
  type SelectionLocation,
  type SelectionPoint,
  type SelectionSnapshot,
} from "./selection-model";

export {
  beginSynchronizedOutput,
  emergencyTerminalModeReset,
  endSynchronizedOutput,
  moveCursor,
  resetScrollRegion,
  setScrollRegion,
} from "./ansi";

interface TerminalSplitCompositorOptions {
  adapter: PiTuiAdapter;
  renderCluster: (width: number, terminalRows: number) => FixedEditorClusterRender;
  mouseScroll?: boolean;
  onCopySelection?: (text: string) => void;
}

interface RenderPassCluster {
  width: number;
  terminalRows: number;
  cluster: FixedEditorClusterRender;
}

interface DisposeOptions {
  resetExtendedKeyboardModes?: boolean;
}

const CONTEXT_MENU_MOUSE_REPORTING_PAUSE_MS = 1200;
const CONTEXT_MENU_SELECTION_RESTORE_WINDOW_MS = 5000;
const CONTEXT_MENU_CLIPBOARD_RESTORE_INTERVAL_MS = 100;
const DOUBLE_CLICK_MS = 500;

function sanitizeLine(line: string, width: number): string {
  return visibleWidth(line) > width ? truncateToWidth(line, width, "", true) : line;
}

function sanitizeOverlayBaseLine(line: string, width: number): string {
  return sanitizeLine(stripOscSequences(line), width);
}

function normalizeOverlayCompositionLine(line: string): string {
  return line.includes("\t") ? line.replace(/\t/g, "   ") : line;
}

export function buildFixedClusterPaint(
  cluster: FixedEditorClusterRender,
  terminalRows: number,
  width: number,
  showHardwareCursor: boolean,
): string {
  if (cluster.lines.length === 0) return "";

  const startRow = Math.max(1, terminalRows - cluster.lines.length + 1);
  let buffer = resetScrollRegion();

  for (let i = 0; i < cluster.lines.length; i++) {
    buffer += moveCursor(startRow + i, 1);
    buffer += clearLine();
    buffer += sanitizeLine(cluster.lines[i] ?? "", width);
  }

  if (cluster.cursor && showHardwareCursor) {
    buffer += moveCursor(startRow + cluster.cursor.row, Math.max(1, cluster.cursor.col + 1));
    buffer += showCursor();
  } else {
    buffer += hideCursor();
  }

  return buffer;
}

export class TerminalSplitCompositor {
  private readonly adapter: PiTuiAdapter;
  private readonly terminal: Terminal;
  private readonly renderCluster: (width: number, terminalRows: number) => FixedEditorClusterRender;
  private readonly mouseScroll: boolean;
  private readonly onCopySelection: ((text: string) => void) | null;
  private extendedKeyboardMode: ExtendedKeyboardMode | null = null;
  private emergencyCleanup: (() => void) | null = null;
  private mouseReportingResumeTimer: ReturnType<typeof setTimeout> | null = null;
  private clipboardRestoreTimer: ReturnType<typeof setTimeout> | null = null;
  private installed = false;
  private disposed = false;
  private writing = false;
  private renderPassActive = false;
  private renderPassCluster: RenderPassCluster | null = null;
  private renderingCluster = false;
  private renderingScrollableRoot = false;
  private checkingOverlay = false;
  private readonly scroll = new StickyScrollModel();
  private visibleClusterLines: string[] = [];
  private selectionArea: SelectionArea | null = null;
  private selectionAnchor: SelectionPoint | null = null;
  private selectionFocus: SelectionPoint | null = null;
  private selectionDragging = false;
  private preserveSelectionFocusOnRelease = false;
  private lastLeftPress: { area: SelectionArea; line: number; at: number } | null = null;

  constructor(options: TerminalSplitCompositorOptions) {
    this.adapter = options.adapter;
    this.terminal = options.adapter.terminal;
    this.renderCluster = options.renderCluster;
    this.mouseScroll = options.mouseScroll !== false;
    this.onCopySelection = options.onCopySelection ?? null;
  }

  install(): void {
    if (this.installed) return;
    if (typeof this.terminal.write !== "function") {
      throw new Error("[powerline-footer] Fixed editor compositor expected terminal.write(data) to exist");
    }

    this.emergencyCleanup = () => {
      if (!this.disposed) {
        this.restoreTerminalStateForExit();
      }
    };
    process.once("exit", this.emergencyCleanup);

    try {
      this.adapter.install({
        getRows: () => this.getScrollableRows(),
        renderRoot: (width: number) => this.renderScrollableRoot(width),
        handleInput: (data: string) => this.handleInput(data),
        write: (data: string) => this.write(data),
        renderPass: (renderOriginal) => this.renderRootPass(renderOriginal),
        normalizeCompositeLine: normalizeOverlayCompositionLine,
      });
      this.adapter.writeRaw(
        beginSynchronizedOutput()
        + enterAlternateScreen()
        + this.enableAlternateScreenKeyboardMode()
        + disableAlternateScrollMode()
        + (this.mouseScroll ? enableMouseReporting() : "")
        + endSynchronizedOutput(),
      );
    } catch (error: unknown) {
      process.removeListener("exit", this.emergencyCleanup);
      this.emergencyCleanup = null;
      this.adapter.restore();
      throw error;
    }
    this.installed = true;
  }

  hideRenderable(target: Component): void {
    this.adapter.hideRenderable(target);
  }

  renderHidden(target: Component, width: number): string[] {
    return this.adapter.renderHidden(target, width);
  }

  jumpToPreviousRootTarget(targetLines: readonly number[]): boolean {
    return this.jumpToRootTarget(targetLines, "previous");
  }

  jumpToNextRootTarget(targetLines: readonly number[]): boolean {
    return this.jumpToRootTarget(targetLines, "next");
  }

  jumpToRootBottom(): boolean {
    if (this.disposed || this.hasVisibleOverlay() || this.scroll.offset === 0) return false;

    this.clearSelection();
    this.lastLeftPress = null;
    this.scroll.jumpToBottom();
    this.requestRender();
    return true;
  }

  private jumpToRootTarget(targetLines: readonly number[], direction: JumpDirection): boolean {
    if (this.disposed || targetLines.length === 0 || this.hasVisibleOverlay()) return false;

    if (!this.scroll.jumpToTarget(targetLines, direction)) return false;
    this.clearSelection();
    this.lastLeftPress = null;
    this.requestRender();
    return true;
  }

  requestRepaint(): void {
    if (this.disposed || this.hasVisibleOverlay()) return;
    const rawRows = this.getRawRows();
    const width = Math.max(1, this.terminal.columns || 80);
    const cluster = this.getCluster(width, rawRows);
    if (cluster.lines.length === 0) return;

    this.adapter.writeRaw(
      beginSynchronizedOutput()
      + buildFixedClusterPaint(this.decorateCluster(cluster), rawRows, width, this.adapter.getShowHardwareCursor())
      + endSynchronizedOutput(),
    );
  }

  dispose(options: DisposeOptions = {}): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.emergencyCleanup) {
      process.removeListener("exit", this.emergencyCleanup);
      this.emergencyCleanup = null;
    }
    if (this.mouseReportingResumeTimer) {
      clearTimeout(this.mouseReportingResumeTimer);
      this.mouseReportingResumeTimer = null;
    }
    if (this.clipboardRestoreTimer) {
      clearTimeout(this.clipboardRestoreTimer);
      this.clipboardRestoreTimer = null;
    }

    this.adapter.restore();
    this.restoreTerminalState(options);
  }

  private getRawRows(): number {
    return Math.max(2, this.adapter.readRawRows());
  }

  private getScrollableRows(): number {
    if (this.disposed || this.writing || this.renderingCluster || this.checkingOverlay || this.hasVisibleOverlay()) {
      return this.getRawRows();
    }

    const rawRows = this.getRawRows();
    const width = Math.max(1, this.terminal.columns || 80);
    const cluster = this.getCluster(width, rawRows);
    return Math.max(1, rawRows - cluster.lines.length);
  }

  private renderScrollableRoot(width: number): string[] {
    if (!this.adapter.hasRootRender() || this.disposed || this.renderingScrollableRoot) {
      return this.adapter.renderRoot(width);
    }

    if (this.hasVisibleOverlay()) {
      return this.adapter.renderRoot(width).map((line) => sanitizeOverlayBaseLine(line, Math.max(1, width)));
    }

    this.renderingScrollableRoot = true;
    try {
      const rawRows = this.getRawRows();
      const renderWidth = Math.max(1, width);
      const cluster = this.getCluster(renderWidth, rawRows);
      const scrollableRows = Math.max(1, rawRows - cluster.lines.length);
      const lines = this.adapter.renderRoot(renderWidth);
      const start = this.scroll.updateRootWindow(lines, scrollableRows);
      return this.scroll.visibleRootLines.map((line, index) => this.renderSelectionHighlight(line, start + index, "root"));
    } finally {
      this.renderingScrollableRoot = false;
    }
  }

  private renderRootPass(renderOriginal: () => void): void {
    this.renderPassActive = true;
    this.renderPassCluster = null;
    try {
      renderOriginal();
      this.requestRepaint();
    } finally {
      this.renderPassActive = false;
      this.renderPassCluster = null;
    }
  }

  private handleInput(data: string): { consume?: boolean; data?: string } | undefined {
    if (this.disposed || this.hasVisibleOverlay()) return undefined;

    const mousePackets = this.mouseScroll ? parseSgrMousePackets(data) : null;
    if (mousePackets) {
      for (const packet of mousePackets) {
        this.handleMousePacket(packet);
      }
      return { consume: true };
    }

    const keyboardDelta = parseKeyboardScrollDelta(data);
    if (keyboardDelta === 0) return undefined;

    this.scrollBy(keyboardDelta);
    return { consume: true };
  }

  private handleMousePacket(packet: SgrMousePacket): void {
    const delta = mouseScrollDelta(packet);
    if (delta !== 0) {
      this.selectionDragging = false;
      this.scrollBy(delta);
      return;
    }

    const location = this.selectionLocationForPacket(packet);

    if (isRightPress(packet)) {
      this.selectionDragging = false;
      this.preserveSelectionFocusOnRelease = false;
      const selectedText = this.isLocationInsideSelection(location) ? this.getSelectedText() : "";
      if (selectedText) {
        this.onCopySelection?.(selectedText);
        this.lastLeftPress = null;
        this.pauseMouseReportingForContextMenu(selectedText);
        return;
      }

      this.clearSelection();
      this.lastLeftPress = null;
      this.pauseMouseReportingForContextMenu();
      return;
    }

    if (this.scrollSelectionAtViewportEdge(packet)) return;
    if (this.selectionDragging && isMouseRelease(packet)) {
      this.finishSelection(packet, location);
      return;
    }

    if (!location) return;

    if (isLeftPress(packet)) {
      this.startSelection(location);
      return;
    }

    if (this.selectionDragging && isLeftDrag(packet) && location.area === this.selectionArea) {
      this.lastLeftPress = null;
      this.preserveSelectionFocusOnRelease = false;
      this.selectionFocus = location.point;
      this.requestRender();
      return;
    }
  }

  private finishSelection(packet: SgrMousePacket, location: SelectionLocation | null): void {
    if (!this.preserveSelectionFocusOnRelease) {
      this.selectionFocus = location?.area === this.selectionArea
        ? location.point
        : this.clampedSelectionPointForPacket(packet, this.selectionArea);
    }

    this.preserveSelectionFocusOnRelease = false;
    this.selectionDragging = false;
    const selectedText = this.getSelectedText();
    if (selectedText) {
      this.lastLeftPress = null;
      this.onCopySelection?.(selectedText);
    } else {
      this.clearSelection();
    }
    this.requestRender();
  }

  private startSelection(location: SelectionLocation): void {
    const now = Date.now();
    const line = location.point.line;
    if (
      this.lastLeftPress
      && this.lastLeftPress.area === location.area
      && this.lastLeftPress.line === line
      && now - this.lastLeftPress.at <= DOUBLE_CLICK_MS
    ) {
      this.selectionArea = location.area;
      this.selectionAnchor = { line, col: 0 };
      this.selectionFocus = { line, col: this.selectionLineWidth(location.area, line) };
      this.selectionDragging = true;
      this.preserveSelectionFocusOnRelease = true;
      this.lastLeftPress = null;
      this.requestRender();
      return;
    }

    this.selectionArea = location.area;
    this.selectionAnchor = location.point;
    this.selectionFocus = location.point;
    this.selectionDragging = true;
    this.preserveSelectionFocusOnRelease = false;
    this.lastLeftPress = { area: location.area, line, at: now };
    this.requestRender();
  }

  private selectionLocationForPacket(packet: SgrMousePacket): SelectionLocation | null {
    if (packet.row < 1) return null;

    const col = Math.max(0, packet.col - 1);
    if (packet.row <= this.scroll.visibleScrollableRows) {
      return {
        area: "root",
        point: { line: this.scroll.visibleRootStart + packet.row - 1, col },
      };
    }

    const clusterLine = packet.row - this.scroll.visibleScrollableRows - 1;
    if (clusterLine >= this.visibleClusterLines.length) return null;

    return {
      area: "cluster",
      point: { line: clusterLine, col },
    };
  }

  private scrollSelectionAtViewportEdge(packet: SgrMousePacket): boolean {
    if (!this.selectionDragging || this.selectionArea !== "root" || !isLeftDrag(packet)) return false;

    const delta = packet.row <= 1 ? 1 : packet.row >= this.scroll.visibleScrollableRows ? -1 : 0;
    if (delta === 0) return false;

    const edgeLine = this.scroll.scrollSelectionAtEdge(delta);
    if (edgeLine === null) return false;

    this.lastLeftPress = null;
    this.preserveSelectionFocusOnRelease = true;
    this.selectionFocus = {
      line: edgeLine,
      col: Math.max(0, packet.col - 1),
    };
    this.requestRender();
    return true;
  }

  private clampedSelectionPointForPacket(packet: SgrMousePacket, area: SelectionArea | null): SelectionPoint {
    if (area === "cluster") {
      return {
        line: Math.max(0, Math.min(packet.row - this.scroll.visibleScrollableRows - 1, this.visibleClusterLines.length - 1)),
        col: Math.max(0, packet.col - 1),
      };
    }

    const row = Math.max(1, Math.min(packet.row, this.scroll.visibleScrollableRows));
    return {
      line: this.scroll.visibleRootStart + row - 1,
      col: Math.max(0, packet.col - 1),
    };
  }

  private renderSelectionHighlight(line: string, lineIndex: number, area: SelectionArea): string {
    return renderSelectedLine(line, lineIndex, area, this.selectionSnapshot());
  }

  private selectionLineWidth(area: SelectionArea, lineIndex: number): number {
    const lines = area === "root" ? this.scroll.visibleRootLines : this.visibleClusterLines;
    const firstLine = area === "root" ? this.scroll.visibleRootStart : 0;
    return visibleWidth(stripAnsi(lines[lineIndex - firstLine] ?? ""));
  }

  private getSelectedText(): string {
    const lines = this.selectionArea === "root" ? this.scroll.rootLines : this.visibleClusterLines;
    return selectedText(this.selectionSnapshot(), lines);
  }

  private selectionSnapshot(): SelectionSnapshot {
    return {
      area: this.selectionArea,
      anchor: this.selectionAnchor,
      focus: this.selectionFocus,
    };
  }

  private isLocationInsideSelection(location: SelectionLocation | null): boolean {
    return isLocationInsideSelection(this.selectionSnapshot(), location);
  }

  private scrollBy(delta: number): void {
    if (!this.scroll.scrollBy(delta)) return;

    this.clearSelection();
    this.lastLeftPress = null;
    this.requestRender();
  }

  private requestRender(): void {
    this.adapter.requestRender();
  }

  private pauseMouseReportingForContextMenu(textToRestoreToClipboard: string | null = null): void {
    if (this.mouseReportingResumeTimer) {
      clearTimeout(this.mouseReportingResumeTimer);
    }
    if (this.clipboardRestoreTimer) {
      clearTimeout(this.clipboardRestoreTimer);
      this.clipboardRestoreTimer = null;
    }

    this.adapter.writeRaw(beginSynchronizedOutput() + disableMouseReporting() + endSynchronizedOutput());
    this.mouseReportingResumeTimer = setTimeout(() => {
      this.mouseReportingResumeTimer = null;
      if (!this.disposed) {
        this.adapter.writeRaw(beginSynchronizedOutput() + enableMouseReporting() + endSynchronizedOutput());
      }
    }, CONTEXT_MENU_MOUSE_REPORTING_PAUSE_MS);

    if (typeof this.mouseReportingResumeTimer === "object" && "unref" in this.mouseReportingResumeTimer) {
      this.mouseReportingResumeTimer.unref();
    }

    const restoreClipboard = this.onCopySelection;
    if (!textToRestoreToClipboard || !restoreClipboard) return;

    let remainingRestores = Math.ceil(CONTEXT_MENU_SELECTION_RESTORE_WINDOW_MS / CONTEXT_MENU_CLIPBOARD_RESTORE_INTERVAL_MS);
    const scheduleClipboardRestore = () => {
      this.clipboardRestoreTimer = setTimeout(() => {
        this.clipboardRestoreTimer = null;
        if (this.disposed) return;

        remainingRestores -= 1;
        if (this.getSelectedText() !== textToRestoreToClipboard) return;

        restoreClipboard(textToRestoreToClipboard);
        if (remainingRestores > 0) {
          scheduleClipboardRestore();
        }
      }, CONTEXT_MENU_CLIPBOARD_RESTORE_INTERVAL_MS);

      if (typeof this.clipboardRestoreTimer === "object" && "unref" in this.clipboardRestoreTimer) {
        this.clipboardRestoreTimer.unref();
      }
    };

    scheduleClipboardRestore();
  }

  private clearSelection(): void {
    this.selectionArea = null;
    this.selectionAnchor = null;
    this.selectionFocus = null;
    this.selectionDragging = false;
    this.preserveSelectionFocusOnRelease = false;
  }

  private activeExtendedKeyboardMode(): ExtendedKeyboardMode | null {
    return this.adapter.activeExtendedKeyboardMode();
  }

  private enableAlternateScreenKeyboardMode(): string {
    this.extendedKeyboardMode = this.activeExtendedKeyboardMode();
    return this.extendedKeyboardMode ? enableExtendedKeyboardMode(this.extendedKeyboardMode) : "";
  }

  private restoreTerminalState(options: DisposeOptions = {}): void {
    const activeMode = this.extendedKeyboardMode ?? this.activeExtendedKeyboardMode();
    const restoreMainScreenMode = !options.resetExtendedKeyboardModes && this.extendedKeyboardMode === null && activeMode !== null;

    this.adapter.writeRaw(
      beginSynchronizedOutput()
      + resetScrollRegion()
      + (this.mouseScroll ? disableMouseReporting() : "")
      + (activeMode ? disableExtendedKeyboardMode(activeMode) : "")
      + enableAlternateScrollMode()
      + exitAlternateScreen()
      + (restoreMainScreenMode && activeMode ? enableExtendedKeyboardMode(activeMode) : "")
      + (options.resetExtendedKeyboardModes ? resetExtendedKeyboardModes() : "")
      + endSynchronizedOutput(),
    );
  }

  private restoreTerminalStateForExit(): void {
    try {
      this.restoreTerminalState({ resetExtendedKeyboardModes: true });
    } catch {
      // Process-exit cleanup cannot report useful errors and must not throw.
    }
  }

  private write(data: string): void {
    if (this.disposed || this.writing || this.hasVisibleOverlay()) {
      this.adapter.writeRaw(data);
      return;
    }

    this.writing = true;
    try {
      const rawRows = this.getRawRows();
      const width = Math.max(1, this.terminal.columns || 80);
      const cluster = this.getCluster(width, rawRows);
      const reservedRows = cluster.lines.length;

      if (reservedRows === 0 || rawRows <= 2) {
        this.adapter.writeRaw(data);
        return;
      }

      const scrollBottom = Math.max(1, rawRows - reservedRows);
      const screenRow = this.adapter.getCursorScreenRow(scrollBottom);
      const buffer = beginSynchronizedOutput()
        + setScrollRegion(1, scrollBottom)
        + moveCursor(screenRow, 1)
        + data
        + buildFixedClusterPaint(this.decorateCluster(cluster), rawRows, width, this.adapter.getShowHardwareCursor())
        + endSynchronizedOutput();

      this.adapter.writeRaw(buffer);
    } finally {
      this.writing = false;
    }
  }

  private getCluster(width: number, terminalRows: number): FixedEditorClusterRender {
    if (
      this.renderPassActive &&
      this.renderPassCluster?.width === width &&
      this.renderPassCluster.terminalRows === terminalRows
    ) {
      return this.renderPassCluster.cluster;
    }

    const cluster = this.withClusterRender(() => this.renderCluster(width, terminalRows));
    this.visibleClusterLines = cluster.lines;
    if (this.renderPassActive) {
      this.renderPassCluster = { width, terminalRows, cluster };
    }
    return cluster;
  }

  private decorateCluster(cluster: FixedEditorClusterRender): FixedEditorClusterRender {
    if (this.selectionArea !== "cluster") return cluster;

    return {
      ...cluster,
      lines: cluster.lines.map((line, index) => this.renderSelectionHighlight(line, index, "cluster")),
    };
  }

  private withClusterRender<T>(render: () => T): T {
    const wasRenderingCluster = this.renderingCluster;
    this.renderingCluster = true;
    try {
      return render();
    } finally {
      this.renderingCluster = wasRenderingCluster;
    }
  }

  private hasVisibleOverlay(): boolean {
    if (this.checkingOverlay) return false;

    this.checkingOverlay = true;
    try {
      return this.adapter.hasVisibleOverlay();
    } finally {
      this.checkingOverlay = false;
    }
  }
}
