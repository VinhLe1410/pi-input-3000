This project improves Pi Coding Agent UX with an Amp-inspired input and optional sticky terminal input.

Project layout:
- `index.ts` is only a compatibility shim; implementation starts at `src/index.ts`.
- `src/default/` restores Pi's built-in input UI.
- `src/amp/` contains the Amp-inspired minimal input UI.
- `src/shared/` contains code shared by the input UI.
- `src/settings/` contains the `/input-style` settings UI.
- `src/sticky/` contains the sticky terminal split implementation.

Pi docs/source:
- Do not hardcode user-specific global install paths in docs or code.
- Pi documentation should be read from the globally installed Node package for `@earendil-works/pi-coding-agent`.
- Resolve the package root with:
  - `npm root -g` then append `@earendil-works/pi-coding-agent`
  - or `node -p "require.resolve('@earendil-works/pi-coding-agent/package.json')"` when Node can resolve the global package.
- Useful paths under the package root:
  - `README.md`
  - `docs/`
  - `examples/`
- For this project, read Pi docs before changing extension, TUI, settings, sticky input, or package-loading behavior.

Validation:
- Run `pnpm typecheck` after code changes.
- Run `pnpm lint` after code changes.
