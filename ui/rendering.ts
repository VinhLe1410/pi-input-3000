import { truncateToWidth } from "@earendil-works/pi-tui";

export function clampRenderedLines(lines: string[], width: number): string[] {
  const maxWidth = Math.max(0, width);
  return lines.map((line) => truncateToWidth(line, maxWidth, ""));
}
