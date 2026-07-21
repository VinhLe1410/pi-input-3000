import assert from "node:assert/strict";
import test from "node:test";
import { CURSOR_MARKER } from "@earendil-works/pi-tui";
import { isLeftDrag, isLeftPress, isMouseRelease, isRightPress, mouseScrollDelta, parseSgrMousePackets, SgrMousePacketFirewall } from "../../src/sticky/mouse-packets.ts";
import { DISABLE_SGR_MOUSE, ENABLE_SGR_MOUSE, MouseModeController } from "../../src/sticky/mouse-mode.ts";
import { StickyMouseSelection } from "../../src/sticky/mouse-selection.ts";
import { highlightSelection, selectedText, type SelectionSnapshot } from "../../src/sticky/selection.ts";

const packet = (code: number, col: number, row: number, final: "M" | "m" = "M") => ({ code, col, row, final } as const);

function selectionHarness(now?: () => number) {
  const writes: string[] = [];
  const copies: string[] = [];
  const scrolls: number[] = [];
  let renders = 0;
  const mode = new MouseModeController({ write: (data: string) => { writes.push(data); } });
  const mouse = new StickyMouseSelection({
    mode,
    copy: (text) => { copies.push(text); },
    scroll: (delta) => { scrolls.push(delta); return true; },
    requestRender: () => { renders++; },
    now,
  });
  mouse.updateFrame({
    width: 20,
    transcript: ["zero", "one", "two", "three", "four", "five"],
    dock: ["dock α", "dock two"],
    transcriptSourceRows: [1, 2, 3],
    dockStartRow: 3,
    transcriptHeight: 3,
  });
  return { mouse, mode, writes, copies, scrolls, renders: () => renders };
}

test("SGR packets parse batches without accepting mixed keyboard input", () => {
  const packets = parseSgrMousePackets("\x1b[<0;3;4M\x1b[<32;4;4M\x1b[<0;4;4m");
  assert.ok(packets);
  assert.equal(isLeftPress(packets[0]), true);
  assert.equal(isLeftDrag(packets[1]), true);
  assert.equal(isMouseRelease(packets[2]), true);
  assert.equal(parseSgrMousePackets("x\x1b[<0;3;4M"), null);
  assert.equal(isRightPress(parseSgrMousePackets("\x1b[<2;1;1M")![0]), true);
  assert.equal(mouseScrollDelta(parseSgrMousePackets("\x1b[<64;1;1M")![0]), 1);
  assert.equal(mouseScrollDelta(parseSgrMousePackets("\x1b[<65;1;1M")![0]), -1);
});

test("fragmented SGR packets never leak suffixes", () => {
  const packet = "\x1b[<32;14;7M";
  for (let split = 1; split < packet.length; split++) {
    const firewall = new SgrMousePacketFirewall();
    const first = firewall.feed(packet.slice(0, split));
    const second = firewall.feed(packet.slice(split));
    assert.equal(first.data + second.data, "", `split ${split}`);
    assert.equal(first.packets.length + second.packets.length, 1, `split ${split}`);
  }
  const firewall = new SgrMousePacketFirewall();
  assert.deepEqual(firewall.feed(`a${packet}b`), {
    packets: [{ code: 32, col: 14, row: 7, final: "M" }], data: "ab", pending: false,
  });
});

test("selection extracts styled multiline Unicode by terminal columns", () => {
  const snapshot: SelectionSnapshot = { area: "transcript", anchor: { line: 0, col: 1 }, focus: { line: 1, col: 4 } };
  const lines = ["\x1b[31ma界é\x1b[0m ", "🙂 ok  "];
  assert.equal(selectedText(snapshot, lines), "界é\n🙂 o");
  const highlighted = highlightSelection(lines[0], 0, "transcript", snapshot);
  assert.match(highlighted, /^\x1b\[31ma\x1b\[7m界é\x1b\[0m\x1b\[7m \x1b\[27m$/);
  assert.match(highlighted, /\x1b\[31m/);
});

test("selection treats wide graphemes and Pi's cursor marker atomically", () => {
  const secondCell: SelectionSnapshot = {
    area: "dock", anchor: { line: 0, col: 1 }, focus: { line: 0, col: 2 },
  };
  assert.equal(selectedText(secondCell, [`${CURSOR_MARKER}界🙂`]), "界");
  const highlighted = highlightSelection(`${CURSOR_MARKER}界`, 0, "dock", secondCell);
  assert.equal(highlighted.includes(CURSOR_MARKER), true);
  assert.equal(selectedText({ ...secondCell, anchor: { line: 0, col: 2 }, focus: { line: 0, col: 4 } }, ["界🙂"]), "🙂");
});

test("mouse mode is idempotent and cleanup disables reporting", () => {
  const writes: string[] = [];
  const mode = new MouseModeController({ write: (data: string) => { writes.push(data); } });
  mode.enable(); mode.enable();
  assert.deepEqual(writes, [ENABLE_SGR_MOUSE]);
  mode.pause(10_000); mode.pause(10_000);
  assert.deepEqual(writes, [ENABLE_SGR_MOUSE, DISABLE_SGR_MOUSE]);
  mode.disable(); mode.disable();
  assert.deepEqual(writes, [ENABLE_SGR_MOUSE, DISABLE_SGR_MOUSE]);
  assert.equal(mode.isEnabled(), false);
});

test("dock drag selects, highlights, and copies on release", () => {
  const { mouse, copies } = selectionHarness();
  mouse.handle(packet(0, 2, 4));
  mouse.handle(packet(32, 7, 4));
  assert.match(mouse.decorateDock("dock α", 0), /\x1b\[7m/);
  mouse.handle(packet(0, 7, 4, "m"));
  assert.deepEqual(copies, ["ock α"]);
  mouse.dispose();
});

test("repeated edge packets extend transcript selection without waiting for render", () => {
  const { mouse, scrolls } = selectionHarness();
  mouse.handle(packet(0, 2, 2)); // source line 2
  mouse.handle(packet(32, 2, 1));
  mouse.handle(packet(32, 2, 1));
  assert.deepEqual(scrolls, [1, 1]);
  assert.equal(mouse.snapshot().focus?.line, 0);
  mouse.handle(packet(0, 2, 1, "m"));
  mouse.dispose();
});

test("double-click selects and copies whole transcript and dock lines", () => {
  let now = 100;
  const { mouse, copies } = selectionHarness(() => now);
  mouse.handle(packet(0, 3, 1));
  mouse.handle(packet(0, 3, 1, "m"));
  now += 100;
  mouse.handle(packet(0, 3, 1));
  mouse.handle(packet(0, 3, 1, "m"));
  assert.equal(copies.at(-1), "one");

  now += 600;
  mouse.handle(packet(0, 3, 5));
  mouse.handle(packet(0, 3, 5, "m"));
  now += 100;
  mouse.handle(packet(0, 3, 5));
  mouse.handle(packet(0, 3, 5, "m"));
  assert.equal(copies.at(-1), "dock two");
  mouse.dispose();
});

test("right-click pauses reporting, restores clipboard, resumes, and disposal cancels restoration", async () => {
  const { mouse, mode, writes, copies } = selectionHarness();
  mode.enable();
  mouse.handle(packet(0, 2, 2));
  mouse.handle(packet(32, 5, 2));
  mouse.handle(packet(0, 5, 2, "m"));
  assert.equal(copies.at(-1), "wo");
  mouse.handle(packet(2, 3, 2));
  assert.deepEqual(writes, [ENABLE_SGR_MOUSE, DISABLE_SGR_MOUSE]);
  await new Promise((resolve) => setTimeout(resolve, 1250));
  assert.equal(writes.at(-1), ENABLE_SGR_MOUSE);
  assert.ok(copies.length > 3, "clipboard should be restored while the context menu is open");
  const countAtDispose = copies.length;
  mouse.dispose();
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(copies.length, countAtDispose);
  assert.equal(writes.at(-1), DISABLE_SGR_MOUSE);
});
