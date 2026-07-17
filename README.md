# Pi Custom Input

An Amp-inspired input for Pi Coding Agent, with an optional sticky terminal layout that keeps the editor visible while chat history scrolls.

https://github.com/user-attachments/assets/26a42a07-b4f0-4419-ac40-c9c7be68c181

## Feature list

1. **Amp-inspired input:** Minimal frame with an active-agent timer, Git state, cost, model, thinking level, context usage, cwd, and bash-mode feedback.
2. **Default input:** Restore Pi's built-in input UI at any time.
3. **Sticky input:** Keep either input style pinned while chat history scrolls with the mouse wheel or Page Up/Down.
4. **Settings:** Use `/input-style` to select a style and toggle sticky input. Settings are saved to `~/.pi/agent/pi-custom-input.json`.

## Code layout

The root `index.ts` is a tiny compatibility shim. The extension implementation lives in [`src/`](src/):

- [`src/default/`](src/default/) restores Pi's built-in input UI.
- [`src/amp/`](src/amp/) contains the Amp-inspired input.
- [`src/shared/`](src/shared/) contains shared input utilities.
- [`src/settings/`](src/settings/) contains the style picker and preview frame.
- [`src/sticky/`](src/sticky/) contains the sticky terminal split.

**How to use:** Clone into `~/.pi/agent/extensions/`, run `pnpm install` for development tooling, then use `/reload` in Pi.
