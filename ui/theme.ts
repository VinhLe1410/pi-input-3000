import type { ThemeColor } from "@earendil-works/pi-coding-agent";
import {
  CONTEXT_PERCENT_THRESHOLDS,
  USAGE_PERCENT_THRESHOLDS,
} from "./design-tokens";

export function percentColor(percent: number): ThemeColor {
  if (percent >= USAGE_PERCENT_THRESHOLDS.error) return "error";
  if (percent >= USAGE_PERCENT_THRESHOLDS.warning) return "warning";
  return "success";
}

export function contextColor(percent: number): ThemeColor {
  if (percent >= CONTEXT_PERCENT_THRESHOLDS.error) return "error";
  if (percent >= CONTEXT_PERCENT_THRESHOLDS.warning) return "warning";
  return "success";
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
    default:
      return "thinkingOff";
  }
}

