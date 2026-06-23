import type { Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { EDITOR_CHROME } from "./design-tokens";

function accentBorder(width: number, theme: Theme): string {
  return theme.fg("accent", EDITOR_CHROME.horizontal.repeat(Math.max(0, width)));
}

export function renderSettingsFocusFrame(
  lines: string[],
  width: number,
  theme: Theme,
): string[] {
  return [accentBorder(width, theme), ...lines, accentBorder(width, theme)].map((line) => {
    const lineWidth = visibleWidth(line);
    return lineWidth <= width ? line : truncateToWidth(line, width, "");
  });
}
