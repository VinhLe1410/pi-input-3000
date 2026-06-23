import { matchesKey, type KeyId } from "@earendil-works/pi-tui";

const SUPER_SHORTCUT_PATTERNS = new Map<string, RegExp>([
  ["super+up", /^\x1b\[(?:1;9(?::[12])?[AH]|574(?:19|23);9(?::[12])?u|7;9(?::[12])?~|27;9;65~)$/],
  ["super+down", /^\x1b\[(?:1;9(?::[12])?[BF]|574(?:20|24);9(?::[12])?u|8;9(?::[12])?~|27;9;66~)$/],
  ["super+home", /^\x1b\[(?:1;9(?::[12])?H|57423;9(?::[12])?u|7;9(?::[12])?~)$/],
  ["super+end", /^\x1b\[(?:1;9(?::[12])?F|57424;9(?::[12])?u|8;9(?::[12])?~)$/],
  ["super+pageup", /^\x1b\[(?:5;9(?::[12])?~|57421;9(?::[12])?u)$/],
  ["super+pagedown", /^\x1b\[(?:6;9(?::[12])?~|57422;9(?::[12])?u)$/],
  ["super+shift+up", /^\x1b\[(?:1;10(?::[12])?[AH]|574(?:19|23);10(?::[12])?u|7;10(?::[12])?~|27;10;65~)$/],
  ["super+shift+down", /^\x1b\[(?:1;10(?::[12])?[BF]|574(?:20|24);10(?::[12])?u|8;10(?::[12])?~|27;10;66~)$/],
  ["super+shift+home", /^\x1b\[(?:1;10(?::[12])?H|57423;10(?::[12])?u|7;10(?::[12])?~)$/],
  ["super+shift+end", /^\x1b\[(?:1;10(?::[12])?F|57424;10(?::[12])?u|8;10(?::[12])?~)$/],
]);

function shortcutUsesSuper(shortcut: string): boolean {
  const parts = shortcut.toLowerCase().split("+");
  return parts.slice(0, -1).includes("super");
}

export function matchesConfiguredShortcut(data: string, shortcut: KeyId): boolean {
  const normalizedShortcut = shortcut.toLowerCase();
  if (shortcutUsesSuper(normalizedShortcut)) {
    return SUPER_SHORTCUT_PATTERNS.get(normalizedShortcut)?.test(data) ?? false;
  }

  return matchesKey(data, shortcut);
}
