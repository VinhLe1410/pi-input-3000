import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";

export function isBashInput(text: string): boolean {
  return text.trimStart().startsWith("!");
}

export function thinkingColor(thinkingLevel: string): ThemeColor {
  switch (thinkingLevel) {
    case "minimal":
      return "thinkingMinimal";
    case "low":
      return "thinkingLow";
    case "medium":
      return "thinkingMedium";
    case "high":
      return "thinkingHigh";
    case "xhigh":
      return "thinkingXhigh";
    case "max":
      return "thinkingMax";
    default:
      return "thinkingOff";
  }
}

export function defaultEditorBorderColor(
  text: string,
  thinkingLevel: string,
  theme: Theme,
): (value: string) => string {
  const color = isBashInput(text) ? "bashMode" : thinkingColor(thinkingLevel);
  return (value) => theme.fg(color, value);
}
