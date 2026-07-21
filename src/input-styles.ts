import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import type { GitStatusSummary } from "./amp/git-status";
import { ampStyle } from "./amp/adapter";
import { defaultStyle } from "./default/adapter";

export const INPUT_STYLES = ["default", "amp"] as const;
export type InputStyle = (typeof INPUT_STYLES)[number];

export interface InputStyleConfig {
  style: InputStyle;
  stickyInput: boolean;
}

export interface AgentTimerState {
  seconds: number;
  active: boolean;
}
export interface InputStyleRuntime {
  currentGit(): GitStatusSummary;
  getAgentTimer(): AgentTimerState | undefined;
  getThinkingLevel(ctx: ExtensionContext): string;
  registerActiveEditor(tui: TUI, editor: Component): void;
  requestRender(): void;
}

export interface InputStyleAdapter {
  readonly id: InputStyle;
  readonly label: string;
  readonly description: string;
  apply(ctx: ExtensionContext, runtime: InputStyleRuntime): void;
  renderPreview?(ctx: ExtensionContext, width: number, theme: Theme): string[];
}

export const inputStyleAdapters: readonly InputStyleAdapter[] = [defaultStyle, ampStyle];

export function isInputStyle(value: string): value is InputStyle {
  return INPUT_STYLES.some((style) => style === value);
}

export function findInputStyleAdapter(id: InputStyle): InputStyleAdapter {
  return inputStyleAdapters.find((adapter) => adapter.id === id) ?? defaultStyle;
}
