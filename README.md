# Pi Custom Input

An Amp-inspired input for Pi Coding Agent, with an optional sticky terminal layout that keeps the editor visible while chat history scrolls.

https://github.com/user-attachments/assets/26a42a07-b4f0-4419-ac40-c9c7be68c181

## Feature list

1. **Amp-inspired input:** Minimal frame with an active-agent timer, Git state, cost, model, thinking level, context usage, cwd, and bash-mode feedback.
2. **Default input:** Use an extension-owned editor matching Pi's standard input appearance.
3. **Sticky input:** On supported Pi/TUI versions, pins status, widgets, editor, and footer to the bottom while the transcript scrolls. Use the mouse wheel or PageUp/PageDown to scroll and Ctrl+End to jump to the latest output. Mouse dragging selects and automatically copies transcript or dock text; double-click selects a whole line. Dragging at transcript edges extends the selection while scrolling. Right-click inside a selection preserves it for the terminal context menu.
4. **Settings:** Use `/input-style` to select a style and toggle sticky input. Settings are saved to `~/.pi/agent/pi-custom-input.json`.

Sticky uses a capability-checked root-layout adapter validated against Pi/TUI 0.80.10 and 0.81.1. Pi continues to compose overlays, while sticky temporarily yields to non-overlay custom UI, viewports containing terminal images, and docks too tall for the terminal. It resumes when the normal text-only editor layout returns. Pi remains the sole screen-content renderer and writer. A dedicated, cleanup-safe mouse owner writes only SGR button-event/reporting toggles (`1002` + `1006`), including a short reporting pause for native right-click context menus. A stateful packet firewall consumes complete, batched, fragmented, and malformed mouse packets before editors, autocomplete, overlays, or temporary custom UI can interpret them as text. Selection mapping preserves ANSI/OSC styling and handles Unicode grapheme cell widths; selection is cleared when its rendered source or geometry becomes invalid. Unsupported root layouts fail closed without enabling mouse reporting, while the selected editor remains functional.

## Code layout

The root `index.ts` is a tiny compatibility shim. The extension implementation lives in [`src/`](src/):

- [`src/default/`](src/default/) implements Pi's standard-looking editor.
- [`src/amp/`](src/amp/) contains the Amp-inspired input.
- [`src/shared/`](src/shared/) contains shared input utilities.
- [`src/settings/`](src/settings/) contains the style picker and preview frame.
- [`src/sticky/`](src/sticky/) contains the viewport, scrolling model, and Pi root-layout adapter.

**How to use:** Clone into `~/.pi/agent/extensions/`, run `pnpm install` for development tooling, then use `/reload` in Pi.
