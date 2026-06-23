/**
 * Sticky input support: keeps the chat input and footer pinned to the bottom while scrolling.
 *
 * External interface stays deliberately tiny: installStickyInput(pi). Internally the
 * feature is split into deeper modules:
 *   - StickyInputRuntime owns session lifecycle and reinstall/cleanup ordering.
 *   - Sticky UI capture isolates Pi UI method patching and TUI capture.
 *   - Slot discovery isolates Pi's private tui.children layout assumptions.
 *   - Pinned cluster policy decides what belongs in the fixed bottom region.
 *   - TerminalSplitCompositor owns the terminal split, scroll, selection, and input handling.
 */

import {
  copyToClipboard,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { StickyInputRuntime } from "./runtime/sticky-input-runtime";

export interface StickyInputController {
  setEnabled(ctx: ExtensionContext, enabled: boolean): void;
}

interface StickyInputOptions {
  isEnabled(): boolean;
}

export default function installStickyInput(
  pi: ExtensionAPI,
  options: StickyInputOptions,
): StickyInputController {
  const runtime = new StickyInputRuntime({ copyToClipboard });
  let currentEnabled = false;

  function apply(ctx: ExtensionContext, enabled: boolean): void {
    currentEnabled = enabled;
    if (enabled) runtime.start(ctx);
    else runtime.disable();
  }

  pi.on("session_start", (_event, ctx) => {
    apply(ctx, options.isEnabled());
  });

  pi.on("session_shutdown", async () => {
    currentEnabled = false;
    runtime.shutdown();
  });

  return {
    setEnabled(ctx: ExtensionContext, enabled: boolean): void {
      if (enabled === currentEnabled) return;
      apply(ctx, enabled);
    },
  };
}
