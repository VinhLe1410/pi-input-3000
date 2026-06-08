import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { renderQuotaSegments } from "./render";
import { createUsageQuotaState, type UsageQuotaState } from "./state";

export interface UsageQuotaFeature extends UsageQuotaState {
  renderSegments(theme: Theme): string[];
}

export function createUsageQuotaFeature(options: {
  intervalMs: number;
  onChange: () => void;
}): UsageQuotaFeature {
  const state = createUsageQuotaState(options);

  return {
    start(ctx: ExtensionContext): void {
      state.start(ctx);
    },
    stop(): void {
      state.stop();
    },
    current() {
      return state.current();
    },
    renderSegments(theme: Theme): string[] {
      return renderQuotaSegments(state.current(), theme);
    },
  };
}

export { CODEX_PROVIDER_KEY } from "./types";
export type { CodexQuotaWindow, QuotaState } from "./types";
