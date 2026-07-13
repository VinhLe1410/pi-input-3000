import { stripVTControlCharacters } from "node:util";

export type ExtensionStatusSegment = {
  key: string;
  text: string;
};

function compareKeys(a: ExtensionStatusSegment, b: ExtensionStatusSegment): number {
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

export function sanitizeExtensionStatusText(value: string): string {
  return stripVTControlCharacters(value)
    .replace(/[\r\n\t\f\v]+/g, " ")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function collectExtensionStatusSegments(
  statuses: ReadonlyMap<string, string>,
): ExtensionStatusSegment[] {
  const segments: ExtensionStatusSegment[] = [];

  for (const [key, value] of statuses.entries()) {
    const text = sanitizeExtensionStatusText(value);
    if (text) segments.push({ key, text });
  }

  return segments.sort(compareKeys);
}
