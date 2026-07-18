# Pi Custom Input

**A riced up version for the user input section to make you feel like you're in Los Almos or Las Vegas or anything I don't even know**

**Note: It's riced up for now, I'm slowly getting bored of it and prefer minimalism**

https://github.com/user-attachments/assets/d05d8ce4-130b-463b-b0ec-68ecd6425ac1

## Feature list

1. **Default input:** Pi's built-in input UI with no custom styling.
2. **Input 3000:** Polished chrome with model/thinking/context/git badges, animated border chase, whimsical working messages, and extension/package status display.
3. **Amp-inspired input:** Minimal, zen input UI with cost, thinking, context %, and cwd labels.
4. **Sticky input:** Terminal split keeps any input style pinned while chat history scrolls with mouse wheel and Page Up/Down.
5. **Settings:** `/input-style` selects an input style and toggles sticky input. Styled choices include previews. Settings are saved to `~/.pi/agent/pi-custom-input.json`.

## Code layout

The root `index.ts` is a tiny compatibility shim. The extension implementation lives in [`src/`](src/):

- [`src/default/`](src/default/) restores Pi's built-in input UI.
- [`src/input-3000/`](src/input-3000/) contains Input-3000-only code.
- [`src/amp/`](src/amp/) contains Amp-inspired-input-only code.
- [`src/shared/`](src/shared/) contains code shared by custom input styles.
- [`src/settings/`](src/settings/) contains the style picker and preview frame.
- [`src/sticky/`](src/sticky/) contains the global sticky terminal split.

**How to use:** Clone to `~/.pi/agent/extensions/`, `pnpm install` (moreso for development than for actually using it), then enjoy.
