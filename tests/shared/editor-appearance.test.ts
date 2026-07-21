import assert from "node:assert/strict";
import test from "node:test";
import { isBashInput, thinkingColor } from "../../src/shared/editor-appearance.ts";

test("the default-looking editor recognizes indented bash input", () => {
  assert.equal(isBashInput("  !pwd"), true);
});

test("maximum thinking uses its dedicated theme token", () => {
  assert.equal(thinkingColor("max"), "thinkingMax");
});
