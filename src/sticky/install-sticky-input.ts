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

import { copyToClipboard, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StickyInputRuntime } from "./runtime/sticky-input-runtime";

export default function installStickyInput(pi: ExtensionAPI) {
  const runtime = new StickyInputRuntime({ copyToClipboard });

  pi.on("session_start", (_event, ctx) => {
    runtime.start(ctx);
  });

  pi.on("session_shutdown", async () => {
    runtime.shutdown();
  });
}
