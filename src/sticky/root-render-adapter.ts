import {
  Key,
  matchesKey,
  type Component,
  type TUI,
} from "@earendil-works/pi-tui";
import { StickyScroll } from "./scroll.ts";
import { MouseModeController } from "./mouse-mode.ts";
import { SgrMousePacketFirewall } from "./mouse-packets.ts";
import { StickyMouseSelection } from "./mouse-selection.ts";
import { composeDockedFrame, viewportFromBottom } from "./viewport.ts";

const TRANSCRIPT_CHILD_COUNT = 4;
const EDITOR_CONTAINER_INDEX = 6;
const EXPECTED_ROOT_CHILD_COUNT = 9;
const IMAGE_SEQUENCE = /(?:\x1b_G|\x1b\]1337;File=)/;

export interface StickyInstallation {
  readonly applied: boolean;
  readonly reason?: string;
  dispose(): void;
}

function inactive(reason: string): StickyInstallation {
  return { applied: false, reason, dispose() {} };
}

function renderChildren(children: readonly Component[], width: number): string[] {
  return children.flatMap((child) => child.render(width));
}

function hasComponentChildren(component: Component): component is Component & { children: Component[] } {
  if (!("children" in component) || !Array.isArray(component.children)) return false;
  return component.children.every((child: unknown) => (
    typeof child === "object" && child !== null && "render" in child && typeof child.render === "function"
  ));
}

function isAutocompleteVisible(editor: Component): boolean {
  return "isShowingAutocomplete" in editor
    && typeof editor.isShowingAutocomplete === "function"
    && editor.isShowingAutocomplete() === true;
}

function viewportContainsImage(lines: readonly string[], height: number, offset: number): boolean {
  const viewport = viewportFromBottom(lines, height, offset);
  return viewport.lines.some((line) => IMAGE_SEQUENCE.test(line));
}

/**
 * Adapter for the root layout validated against Pi/TUI 0.80.10 and 0.81.1.
 * It wraps only root rendering; TUI still owns differential rendering,
 * overlays, cursor extraction, and terminal writes.
 */
export function installStickyRootAdapter(
  tui: TUI,
  editor: Component,
  copySelection: (text: string) => void = () => {},
): StickyInstallation {
  const children = tui.children;
  if (children.length !== EXPECTED_ROOT_CHILD_COUNT) {
    return inactive(`expected ${EXPECTED_ROOT_CHILD_COUNT} top-level components, found ${children.length}`);
  }
  const editorContainer = children[EDITOR_CONTAINER_INDEX];
  if (!editorContainer || !hasComponentChildren(editorContainer)) {
    return inactive("editor container is not a Pi Container");
  }
  const editorChildren = editorContainer.children;
  // Pi 0.80.10 clears this container immediately before invoking a custom
  // editor factory and mounts the returned editor immediately afterwards.
  // Installation therefore has to accept that one documented transition;
  // a different mounted component is an unsupported structure.
  if (editorChildren.length > 0 && !editorChildren.includes(editor)) {
    return inactive("a different component is mounted in the expected editor slot");
  }
  if (!Number.isInteger(tui.terminal.rows) || tui.terminal.rows <= 0) {
    return inactive("terminal height is unavailable");
  }

  const originalRender = tui.render;
  const expectedChildren = [...children];
  const scroll = new StickyScroll();
  let transcriptHeight = 1;
  let maxOffset = 0;
  let stickyFrameActive = false;
  const mouseMode = new MouseModeController(tui.terminal);
  const mouse = new StickyMouseSelection({
    mode: mouseMode,
    copy: copySelection,
    scroll: (delta) => delta > 0 ? scroll.pageUp(1, maxOffset) : scroll.pageDown(1),
    requestRender: () => tui.requestRender(),
  });

  const suspendStickyFrame = (): void => {
    stickyFrameActive = false;
    mouse.suspend();
  };
  const rootBoundaryIsSupported = (): boolean => tui.children.length === expectedChildren.length
    && tui.children.every((child, index) => child === expectedChildren[index])
    && tui.children[EDITOR_CONTAINER_INDEX] === editorContainer
    && hasComponentChildren(editorContainer);

  const wrappedRender = (width: number): string[] => {
    try {
      // Root mutations are unsupported. Fail closed for this frame and only resume
      // if Pi restores the exact validated boundary.
      if (!rootBoundaryIsSupported() || !editorContainer.children.includes(editor)) {
        suspendStickyFrame();
        return originalRender.call(tui, width);
      }

      const transcript = renderChildren(children.slice(0, TRANSCRIPT_CHILD_COUNT), width);
      const dock = renderChildren(children.slice(TRANSCRIPT_CHILD_COUNT), width);
      // Image payload lines must only pass through Pi as part of its complete
      // original frame. An off-screen image does not prevent later text-only
      // viewports from using sticky layout.
      if (dock.length >= tui.terminal.rows || dock.some((line) => IMAGE_SEQUENCE.test(line))) {
        suspendStickyFrame();
        return originalRender.call(tui, width);
      }

      transcriptHeight = Math.max(1, tui.terminal.rows - dock.length);
      const initial = viewportFromBottom(transcript, transcriptHeight, scroll.currentOffset());
      const offset = scroll.update(width, transcript.length, initial.maxOffset);
      if (viewportContainsImage(transcript, transcriptHeight, offset)) {
        suspendStickyFrame();
        return originalRender.call(tui, width);
      }

      const frame = composeDockedFrame(transcript, dock, tui.terminal.rows, offset);
      maxOffset = frame.maxOffset;
      mouse.updateFrame({
        width,
        transcript,
        dock,
        transcriptSourceRows: frame.transcriptSourceRows,
        dockStartRow: frame.dockStartRow,
        transcriptHeight: frame.transcriptHeight,
      });
      const decoratedTranscript = frame.lines.slice(0, frame.transcriptHeight).map((line, index) => {
        const sourceLine = frame.transcriptSourceRows[index];
        return sourceLine === null || sourceLine === undefined ? line : mouse.decorateTranscript(line, sourceLine);
      });
      const decoratedDock = frame.lines.slice(frame.dockStartRow).map((line, index) => mouse.decorateDock(line, index));
      const completedFrame = [...decoratedTranscript, ...decoratedDock];
      mouseMode.enable();
      stickyFrameActive = true;
      return completedFrame;
    } catch (error: unknown) {
      suspendStickyFrame();
      throw error;
    }
  };

  const firewall = new SgrMousePacketFirewall();
  let removeInputListener: (() => void) | undefined;
  try {
    tui.render = wrappedRender;
    removeInputListener = tui.addInputListener((data) => {
      const filtered = firewall.feed(data);
      if (filtered.packets.length > 0 && stickyFrameActive && !tui.hasOverlay() && rootBoundaryIsSupported() && editorContainer.children.includes(editor) && !isAutocompleteVisible(editor)) {
        for (const packet of filtered.packets) mouse.handle(packet);
      }
      if (filtered.pending || filtered.packets.length > 0 || filtered.data !== data) {
        if (filtered.data === "") return { consume: true };
        return { data: filtered.data };
      }
      if (
        !stickyFrameActive
        || tui.hasOverlay()
        || !editorContainer.children.includes(editor)
        || isAutocompleteVisible(editor)
      ) return undefined;
      const changed = matchesKey(data, Key.pageUp)
        ? scroll.pageUp(transcriptHeight, maxOffset)
        : matchesKey(data, Key.pageDown)
          ? scroll.pageDown(transcriptHeight)
          : matchesKey(data, Key.ctrl("end"))
            ? scroll.jumpToBottom()
            : false;
      if (!changed) return undefined;
      tui.requestRender();
      return { consume: true };
    });
  } catch (error: unknown) {
    mouse.dispose();
    if (tui.render === wrappedRender) tui.render = originalRender;
    throw error;
  }

  return {
    applied: true,
    dispose() {
      // Relinquish the terminal mode before removing the packet firewall or
      // restoring the root render boundary.
      mouse.dispose();
      firewall.clear();
      removeInputListener?.();
      removeInputListener = undefined;
      if (tui.render === wrappedRender) tui.render = originalRender;
    },
  };
}
