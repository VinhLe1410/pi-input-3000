import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { loadInputStyleConfig, saveInputStyleConfig } from "./config";
import {
  findInputStyleAdapter,
  type InputStyle,
  type InputStyleConfig,
} from "./input-styles";
import type { InputStyleRuntimeController } from "./runtime";
import { showInputStyleMenu } from "./settings/menu";
import type { StickyInputController } from "./sticky/install-sticky-input";

function formatInputStyleLabel(style: InputStyle): string {
  return findInputStyleAdapter(style).label;
}

export function registerInputStyleLifecycle(
  pi: ExtensionAPI,
  runtime: InputStyleRuntimeController,
  stickyInput: StickyInputController,
): void {
  let activeConfig: InputStyleConfig = loadInputStyleConfig();

  function applyInputStyle(ctx: ExtensionContext, style: InputStyle): void {
    activeConfig = { ...activeConfig, style };
    runtime.applyStyle(ctx, findInputStyleAdapter(style));
  }

  function applyConfig(ctx: ExtensionContext, config: InputStyleConfig): void {
    activeConfig = config;
    stickyInput.setEnabled(ctx, config.stickyInput);
    applyInputStyle(ctx, config.style);
  }

  pi.registerCommand("input-style", {
    description: "Select a Pi Custom Input style",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("/input-style requires TUI mode", "error");
        return;
      }

      const selected = await showInputStyleMenu(ctx, activeConfig);
      if (!selected) return;

      try {
        saveInputStyleConfig(selected);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`Failed to save input settings: ${message}`, "error");
        return;
      }

      applyConfig(ctx, selected);
      ctx.ui.notify(
        `Input style: ${formatInputStyleLabel(selected.style)}; sticky input: ${selected.stickyInput ? "on" : "off"}`,
        "info",
      );
    },
  });

  pi.on("session_start", (_event, ctx) => {
    runtime.refreshThinkingLevel(ctx);
    if (ctx.mode !== "tui") return;

    activeConfig = loadInputStyleConfig();
    applyInputStyle(ctx, activeConfig.style);
  });

  pi.on("session_shutdown", () => {
    // Pi resets extension-owned UI before invalidating the session.
    runtime.shutdown();
  });

  pi.on("agent_start", () => {
    runtime.startAgentTimer();
  });

  pi.on("agent_settled", (_event, ctx) => {
    runtime.handleAgentSettled(ctx);
  });
  pi.on("message_end", () => {
    runtime.requestRender();
  });

  pi.on("session_tree", (_event, ctx) => {
    runtime.refreshThinkingLevelAndRender(ctx);
  });

  pi.on("session_compact", (_event, ctx) => {
    runtime.refreshThinkingLevelAndRender(ctx);
  });

  pi.on("model_select", (_event, ctx) => {
    runtime.refreshThinkingLevelAndRender(ctx);
  });

  pi.on("thinking_level_select", (_event, ctx) => {
    runtime.refreshThinkingLevelAndRender(ctx);
  });
}
