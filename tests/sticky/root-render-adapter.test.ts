import assert from "node:assert/strict";
import test from "node:test";
import { Container, TUI, type Component, type Terminal } from "@earendil-works/pi-tui";
import { installStickyRootAdapter } from "../../src/sticky/root-render-adapter.ts";

class FakeTerminal implements Terminal {
  columns = 80;
  rows = 8;
  kittyProtocolActive = false;
  readonly writes: string[] = [];
  private input: ((data: string) => void) | undefined;
  start(onInput: (data: string) => void): void { this.input = onInput; }
  send(data: string): void { this.input?.(data); }
  stop(): void {}
  async drainInput(): Promise<void> {}
  write(data: string): void { this.writes.push(data); }
  moveBy(): void {}
  hideCursor(): void {}
  showCursor(): void {}
  clearLine(): void {}
  clearFromCursor(): void {}
  clearScreen(): void {}
  setTitle(): void {}
  setProgress(): void {}
}

function component(...lines: string[]): Component {
  return { render: () => lines, invalidate() {} };
}

function supportedRoot(transcript: string[] = ["one", "two", "three"]): {
  tui: TUI;
  terminal: FakeTerminal;
  editor: Component;
  editorContainer: Container;
} {
  const terminal = new FakeTerminal();
  const tui = new TUI(terminal);
  const editor = component("editor");
  const editorContainer = new Container();
  editorContainer.addChild(editor);
  const roots: Component[] = [
    component(...transcript), component(), component(), component(), component("status"),
    component("above"), editorContainer, component("below"), component("footer"),
  ];
  for (const child of roots) tui.addChild(child);
  return { tui, terminal, editor, editorContainer };
}

test("installation accepts Pi's cleared editor-container factory transition", () => {
  const { tui, editor, editorContainer } = supportedRoot();
  editorContainer.clear();
  const installation = installStickyRootAdapter(tui, editor);
  assert.equal(installation.applied, true);
  assert.deepEqual(tui.render(80).slice(-1), ["footer"]);
  editorContainer.addChild(editor);
  assert.deepEqual(tui.render(80).slice(-4), ["above", "editor", "below", "footer"]);
  installation.dispose();
});

test("a different mounted editor fails closed", () => {
  const { tui, editor, editorContainer } = supportedRoot();
  editorContainer.clear();
  editorContainer.addChild(component("other editor"));
  const original = tui.render;
  const installation = installStickyRootAdapter(tui, editor);
  assert.equal(installation.applied, false);
  assert.equal(tui.render, original);
});

test("supported Pi root is adapted and restored by method identity", () => {
  const { tui, editor } = supportedRoot();
  const original = tui.render;
  const installation = installStickyRootAdapter(tui, editor);
  assert.equal(installation.applied, true);
  assert.notEqual(tui.render, original);
  assert.equal(tui.render(80).length, 8);
  assert.deepEqual(tui.render(80).slice(-4), ["above", "editor", "below", "footer"]);
  installation.dispose();
  assert.equal(tui.render, original);
});

test("non-overlay editor replacement suspends sticky and mouse mode, then restoration resumes both", () => {
  const { tui, terminal, editor, editorContainer } = supportedRoot(Array(10).fill("line"));
  const installation = installStickyRootAdapter(tui, editor);
  assert.equal(terminal.writes.length, 0, "mouse mode waits for the first successful sticky frame");
  assert.equal(tui.render(80).length, 8);
  assert.equal(terminal.writes.at(-1), "\x1b[?1002h\x1b[?1006h");

  editorContainer.clear();
  editorContainer.addChild(component("dialog"));
  assert.equal(tui.render(80).length, 15);
  assert.equal(terminal.writes.at(-1), "\x1b[?1006l\x1b[?1002l");

  editorContainer.clear();
  editorContainer.addChild(editor);
  assert.equal(tui.render(80).length, 8);
  assert.equal(terminal.writes.at(-1), "\x1b[?1002h\x1b[?1006h");
  installation.dispose();
});

test("image viewports suspend without disabling later text-only viewports", () => {
  const transcript = ["before", "\x1b_Gi=1;payload\x1b\\", ...Array(8).fill("after")];
  const { tui, terminal, editor } = supportedRoot(transcript);
  const installation = installStickyRootAdapter(tui, editor);
  assert.equal(tui.render(80).length, 8);

  terminal.rows = 14;
  assert.equal(tui.render(80).length, 15);
  terminal.rows = 8;
  assert.equal(tui.render(80).length, 8);
  installation.dispose();
});

test("keyboard listener scrolls, jumps to bottom, and defers to autocomplete", () => {
  const transcript = Array.from({ length: 12 }, (_, index) => `line ${index}`);
  let autocomplete = false;
  const editor: Component & { isShowingAutocomplete(): boolean } = {
    render: () => ["editor"],
    invalidate() {},
    isShowingAutocomplete: () => autocomplete,
  };
  const { tui, terminal, editorContainer } = supportedRoot(transcript);
  editorContainer.clear();
  editorContainer.addChild(editor);
  const installation = installStickyRootAdapter(tui, editor);
  tui.render(80);
  tui.start();

  terminal.send("\x1b[5~");
  assert.deepEqual(tui.render(80).slice(0, 3), ["line 6", "line 7", "line 8"]);
  terminal.send("\x1b[6~");
  assert.deepEqual(tui.render(80).slice(0, 3), ["line 9", "line 10", "line 11"]);
  terminal.send("\x1b[5~");
  terminal.send("\x1b[1;5F");
  assert.deepEqual(tui.render(80).slice(0, 3), ["line 9", "line 10", "line 11"]);

  autocomplete = true;
  terminal.send("\x1b[5~");
  assert.deepEqual(tui.render(80).slice(0, 3), ["line 9", "line 10", "line 11"]);
  installation.dispose();
  tui.stop();
});

test("mouse drag copies highlighted transcript, wheel scrolls, and cleanup disables reporting", () => {
  const transcript = Array.from({ length: 12 }, (_, index) => `line ${index}`);
  const { tui, terminal, editor } = supportedRoot(transcript);
  const copied: string[] = [];
  const installation = installStickyRootAdapter(tui, editor, (text) => copied.push(text));
  tui.render(80);
  tui.start();

  assert.equal(terminal.writes[0], "\x1b[?1002h\x1b[?1006h");
  terminal.send("\x1b[<0;1;1M");
  terminal.send("\x1b[<32;5;2M");
  terminal.send("\x1b[<0;5;2m");
  assert.deepEqual(copied, ["line 9\nline"]);
  assert.match(tui.render(80)[0] ?? "", /\x1b\[7m/);

  terminal.send("\x1b[<64;1;1M");
  assert.deepEqual(tui.render(80).slice(0, 3), ["line 8", "line 9", "line 10"]);
  // A malformed mouse packet is consumed rather than reaching focused UI.
  terminal.send("prefix\x1b[<0;1;1M");

  installation.dispose();
  assert.equal(terminal.writes.at(-1), "\x1b[?1006l\x1b[?1002l");
  tui.stop();
});

test("render errors and runtime root mutations fail closed", () => {
  const { tui, terminal, editor } = supportedRoot();
  const installation = installStickyRootAdapter(tui, editor);
  tui.render(80);
  assert.equal(terminal.writes.at(-1), "\x1b[?1002h\x1b[?1006h");

  const throwing = component("replacement");
  throwing.render = () => { throw new Error("render failed"); };
  tui.children[0] = throwing;
  assert.throws(() => tui.render(80), /render failed/);
  assert.equal(terminal.writes.at(-1), "\x1b[?1006l\x1b[?1002l");

  tui.children[0] = component("unsupported replacement");
  assert.doesNotThrow(() => tui.render(80));
  assert.equal(terminal.writes.at(-1), "\x1b[?1006l\x1b[?1002l");
  installation.dispose();
});

test("capability validation fails closed without wrapping render", () => {
  const tui = new TUI(new FakeTerminal());
  const editor = component("editor");
  tui.addChild(editor);
  const original = tui.render;
  const installation = installStickyRootAdapter(tui, editor);
  assert.equal(installation.applied, false);
  assert.match(installation.reason ?? "", /top-level/);
  assert.equal(tui.render, original);
});
