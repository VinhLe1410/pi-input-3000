import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { renderPinnedCluster, hidePinnedSlots } from "./pinned-cluster-policy";
import { PiTuiAdapter } from "./pi-tui-adapter";
import { discoverStickySlots } from "./slot-discovery";
import { TerminalSplitCompositor } from "./terminal-split";
import { installStickyUiCapture, type StickyUiCapture } from "./ui-capture";

interface StickyInputRuntimeOptions {
  copyToClipboard(text: string): void;
}

interface StopOptions {
  resetExtendedKeyboardModes: boolean;
}

const INSTALL_RETRY_DELAYS_MS = [16, 50, 100, 250, 500, 1000] as const;

export class StickyInputRuntime {
  private readonly copyToClipboard: (text: string) => void;
  private compositor: TerminalSplitCompositor | null = null;
  private capture: StickyUiCapture | null = null;

  constructor(options: StickyInputRuntimeOptions) {
    this.copyToClipboard = options.copyToClipboard;
  }

  start(ctx: ExtensionContext): void {
    if (ctx.mode !== "tui") return;

    this.stop({ resetExtendedKeyboardModes: false });

    let capturedTui: TUI | null = null;
    let capturedEditor: Component | null = null;
    let installTimer: ReturnType<typeof setTimeout> | null = null;
    let installRetryIndex = 0;

    const clearInstallTimer = (): void => {
      if (installTimer === null) return;
      clearTimeout(installTimer);
      installTimer = null;
    };

    const disposeCompositor = (): void => {
      this.compositor?.dispose({ resetExtendedKeyboardModes: false });
      this.compositor = null;
    };

    const install = (): void => {
      if (!capturedTui) return;

      disposeCompositor();
      const tui = capturedTui;
      const slots = discoverStickySlots(tui, capturedEditor);

      if (!slots) {
        const delay = INSTALL_RETRY_DELAYS_MS[
          Math.min(installRetryIndex, INSTALL_RETRY_DELAYS_MS.length - 1)
        ];
        installRetryIndex += 1;
        scheduleInstall(delay);
        return;
      }

      const adapter = new PiTuiAdapter(tui, {
        getShowHardwareCursor: () => tui.getShowHardwareCursor?.() ?? false,
      });
      installRetryIndex = 0;
      let nextCompositor: TerminalSplitCompositor;
      nextCompositor = new TerminalSplitCompositor({
        adapter,
        mouseScroll: true,
        onCopySelection: this.copyToClipboard,
        renderCluster: (width, terminalRows) => renderPinnedCluster({
          compositor: nextCompositor,
          slots,
          width,
          terminalRows,
        }),
      });

      hidePinnedSlots(nextCompositor, slots);
      nextCompositor.install();
      this.compositor = nextCompositor;
      tui.requestRender?.();
    };

    const scheduleInstall = (delay = 0): void => {
      if (installTimer !== null) return;
      installTimer = setTimeout(() => {
        installTimer = null;
        install();
      }, delay);
    };

    this.capture = installStickyUiCapture(ctx.ui, {
      editorFactoryStarted: (tui) => {
        capturedTui = tui;
        installRetryIndex = 0;
        disposeCompositor();
      },
      editorCaptured: (tui, editor) => {
        capturedTui = tui;
        capturedEditor = editor;
        installRetryIndex = 0;
        scheduleInstall();
      },
      footerFactoryStarted: (tui) => {
        capturedTui ??= tui;
        disposeCompositor();
      },
      footerCaptured: (tui) => {
        capturedTui ??= tui;
        scheduleInstall();
      },
      probeCaptured: (tui) => {
        capturedTui = tui;
      },
    });

    const capture = this.capture;
    this.capture = {
      restore: () => {
        clearInstallTimer();
        capture.restore();
      },
    };

    scheduleInstall();
  }

  shutdown(): void {
    this.stop({ resetExtendedKeyboardModes: true });
  }

  private stop(options: StopOptions): void {
    this.compositor?.dispose(options);
    this.compositor = null;
    this.capture?.restore();
    this.capture = null;
  }
}
