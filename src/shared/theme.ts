import type { ThemeColor } from "@earendil-works/pi-coding-agent";
import { CONTEXT_PERCENT_THRESHOLDS } from "../constants";
import { thinkingColor as editorThinkingColor } from "./editor-appearance";

export function contextColor(percent: number): ThemeColor {
  if (percent >= CONTEXT_PERCENT_THRESHOLDS.error) return "error";
  if (percent >= CONTEXT_PERCENT_THRESHOLDS.warning) return "warning";
  return "success";
}

export function thinkingColor(thinkingLevel: string): ThemeColor {
  return editorThinkingColor(thinkingLevel);
}
