This project improves Pi Coding Agent UX with an Amp-inspired input and optional sticky terminal input.

Project layout:
- `index.ts` is only a compatibility shim; implementation starts at `src/index.ts`.
- `src/default/` contains the extension-owned editor matching Pi's standard input appearance.
- `src/amp/` contains the Amp-inspired minimal input UI.
- `src/shared/` contains code shared by the input UI.
- `src/settings/` contains the `/input-style` settings UI.
- `src/sticky/` contains the pure viewport/selection models, SGR mouse subsystem, and capability-checked Pi root-layout adapter.
- Sticky may wrap only the validated root render boundary. Pi remains the sole screen-content renderer/writer, and unsupported layouts must fail closed.
- The dedicated mouse-mode owner is the sole exception for direct terminal writes: only idempotent `1002`/`1006` enable, pause/resume, and disable sequences are allowed. Sticky mouse supports wheel scrolling, transcript/dock drag selection, edge extension, whole-line double-click, ANSI/Unicode-aware highlighting and copy, auto-copy, and native right-click context-menu handoff. Its stateful input firewall must consume fragmented and malformed SGR packets as well as complete batches.

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
