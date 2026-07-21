import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : entry.name.endsWith(".ts") ? [file] : [];
  }));
  return nested.flat();
}

test("extension owns no screen rendering or non-mouse terminal modes", async () => {
  const forbidden: readonly [label: string, pattern: RegExp][] = [
    ["terminal writes", /terminal\s*\.\s*write\s*\(/],
    ["terminal row overrides", /defineProperty\s*\([^,]+,\s*["']rows["']/],
    ["private render patches", /["'](?:doRender|compositeLineAt)["']/],
    ["terminal mode control", /\\x1b\[(?:\?1049|\?100[0267]|>4|>7u|<u|r)/],
    ["editor cache restoration", /setEditorComponent\s*\(\s*undefined\s*\)/],
  ];

  for (const file of await sourceFiles(path.resolve("src"))) {
    const source = await readFile(file, "utf8");
    for (const [label, pattern] of forbidden) {
      if (file.endsWith("mouse-mode.ts") && (label === "terminal writes" || label === "terminal mode control")) continue;
      assert.doesNotMatch(source, pattern, `${file} contains forbidden ${label}`);
    }
  }

  const mouseOwner = await readFile(path.resolve("src/sticky/mouse-mode.ts"), "utf8");
  assert.doesNotMatch(mouseOwner, /\?1049|\?1000|\?1007|scrollRegion|doRender|compositeLineAt/);
  const controls = [...mouseOwner.matchAll(/\\x1b\[([^"']+)/g)].map((match) => match[1]);
  assert.deepEqual(controls, ["?1002h\\x1b[?1006h", "?1006l\\x1b[?1002l"]);
});
