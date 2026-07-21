import assert from "node:assert/strict";
import test from "node:test";
import { StickyScroll } from "../../src/sticky/scroll.ts";
import { composeDockedFrame, viewportFromBottom } from "../../src/sticky/viewport.ts";

test("viewport clamps offsets and selects lines from the bottom", () => {
  assert.deepEqual(viewportFromBottom(["0", "1", "2", "3"], 2, 0).lines, ["2", "3"]);
  assert.deepEqual(viewportFromBottom(["0", "1", "2", "3"], 2, 99).lines, ["0", "1"]);
});

test("dock is padded to the terminal bottom", () => {
  assert.deepEqual(composeDockedFrame(["message"], ["editor", "footer"], 5, 0).lines, [
    "message", "", "", "editor", "footer",
  ]);
});

test("scroll anchors viewed transcript on append and resets on resize", () => {
  const scroll = new StickyScroll();
  assert.equal(scroll.update(80, 10, 6), 0);
  assert.equal(scroll.pageUp(3, 6), true);
  assert.equal(scroll.update(80, 12, 8), 5);
  assert.equal(scroll.update(100, 12, 8), 0);
});

test("page down and jump-to-bottom are deterministic", () => {
  const scroll = new StickyScroll();
  scroll.update(80, 20, 15);
  scroll.pageUp(10, 15);
  assert.equal(scroll.pageDown(4), true);
  assert.equal(scroll.currentOffset(), 6);
  assert.equal(scroll.jumpToBottom(), true);
  assert.equal(scroll.currentOffset(), 0);
});
