import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import type { InputStyle } from "../../core/input-style-config";
import type { GitStatusSummary } from "../../seams/git";

export interface InputStyleRuntime {
  currentGit(): GitStatusSummary;
  footerRightSegments(theme: Theme): string[];
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
  featureLifecycle?: boolean;
  borderChase?: boolean;
}

export interface InputStyleAdapter {
  readonly id: InputStyle;
  readonly label: string;
  readonly description: string;
  readonly capabilities?: InputStyleCapabilities;
  apply(ctx: ExtensionContext, runtime: InputStyleRuntime): void;
  renderPreview(ctx: ExtensionContext, width: number, theme: Theme): string[];
}
