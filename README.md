# Pi Input 3000

**A riced up version for the user input section to make you feel like you're in Los Almos or Las Vegas or anything I don't even know**

https://github.com/user-attachments/assets/26a42a07-b4f0-4419-ac40-c9c7be68c181

## Feature list

1. **Default input:** OpenCode-alike chrome with model/thinking/context/git badges, animated border chase, whimsical working messages, and extension/package status display.
2. **Amp-inspired input:** Minimal, zen input UI with cost, thinking, context %, and cwd labels.
3. **Sticky input:** Terminal split keeps the input/editor/footer pinned while chat history scrolls with mouse wheel and Page Up/Down.
4. **Settings:** `/input-style` toggles between styles and sticky input with accurate previews. Choices are saved to `~/.pi/agent/pi-input-3000.json`.

## Code layout

The root `index.ts` is a tiny compatibility shim. The extension implementation lives in [`src/`](src/):

- [`src/default/`](src/default/) contains default-input-only code.
- [`src/amp/`](src/amp/) contains Amp-inspired-input-only code.
- [`src/shared/`](src/shared/) contains code shared by both input styles.
- [`src/settings/`](src/settings/) contains the style picker and preview frame.
- [`src/sticky/`](src/sticky/) contains the global sticky terminal split.

**How to use:** Clone to `~/.pi/agent/extensions/`, `pnpm install` (moreso for development than for actually using it), then enjoy.
