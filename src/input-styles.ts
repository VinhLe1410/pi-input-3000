import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import { ampStyle } from "./amp/adapter";
import { defaultStyle } from "./default/adapter";
import { input3000Style } from "./input-3000/adapter";

export type InputStyle = "default" | "input-3000" | "amp";

export const INPUT_STYLES: readonly InputStyle[] = ["default", "input-3000", "amp"];

export interface InputStyleConfig {
  style: InputStyle;
  stickyInput: boolean;
}

export interface ProjectBranchStatus {
  branch?: string;
  dirty: boolean;
  ahead: number;
  behind: number;
}

export interface InputStyleRuntime {
  currentGit(): ProjectBranchStatus;
  getThinkingLevel(ctx: ExtensionContext): string;
  getWorkingMessage(): string | undefined;
  isBorderChaseActive(): boolean;
  getBorderChaseFrameIndex(): number;

  registerActiveTui(tui: TUI | undefined): void;
  registerFooterRender(fn: (() => void) | undefined): void;
  requestRender(): void;
}

export interface InputStyleCapabilities {
  projectRefresh?: boolean;
  borderChase?: boolean;
}

export interface InputStyleAdapter {
  readonly id: InputStyle;
  readonly label: string;
  readonly description: string;
  readonly capabilities?: InputStyleCapabilities;
  createWorkingMessage?(): string;
  apply(ctx: ExtensionContext, runtime: InputStyleRuntime): void;
  renderPreview?(ctx: ExtensionContext, width: number, theme: Theme): string[];
}

export const inputStyleAdapters: readonly InputStyleAdapter[] = [
  defaultStyle,
  input3000Style,
  ampStyle,
];

export function isInputStyle(value: string): value is InputStyle {
  return INPUT_STYLES.some((style) => style === value);
}

export function findInputStyleAdapter(id: InputStyle): InputStyleAdapter | undefined {
  return inputStyleAdapters.find((adapter) => adapter.id === id);
}
