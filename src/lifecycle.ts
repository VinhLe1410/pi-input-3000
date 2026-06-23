import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  loadInputStyleConfig,
  saveInputStyleConfig,
} from "./config";
import {
  findInputStyleAdapter,
  type InputStyle,
  type InputStyleConfig,
} from "./input-styles";
import type { InputStyleRuntimeController } from "./runtime";
import type { StickyInputController } from "./sticky/install-sticky-input";
import { showInputStyleMenu } from "./settings/menu";

function resetPromptUi(ctx: ExtensionContext): void {
  ctx.ui.setHeader(undefined);
  ctx.ui.setFooter(undefined);
  ctx.ui.setWorkingMessage();
  ctx.ui.setWorkingIndicator();
  ctx.ui.setWorkingVisible(true);
}

function formatInputStyleLabel(style: InputStyle): string {
  return style === "amp" ? "Amp-inspired" : "Default";
}

export function registerInputStyleLifecycle(
  pi: ExtensionAPI,
  runtime: InputStyleRuntimeController,
  stickyInput: StickyInputController,
): void {
  let activeConfig: InputStyleConfig = loadInputStyleConfig();

  function applyInputStyle(ctx: ExtensionContext, style: InputStyle): void {
    const adapter = findInputStyleAdapter(style);
    if (!adapter) return;

    activeConfig = { ...activeConfig, style };
    runtime.applyStyle(ctx, adapter);
  }

  function applyConfig(ctx: ExtensionContext, config: InputStyleConfig): void {
    activeConfig = config;
    stickyInput.setEnabled(ctx, config.stickyInput);
    applyInputStyle(ctx, config.style);
  }

  pi.registerCommand("input-style", {
    description: "Select pi-input-3000 input style",
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

    if (ctx.mode !== "tui") {
      runtime.setPromptUiActive(false);
      return;
    }

    runtime.setPromptUiActive(true);
    activeConfig = loadInputStyleConfig();
    applyInputStyle(ctx, activeConfig.style);
  });

  pi.on("session_shutdown", (_event, ctx) => {
    runtime.deactivateStyle(ctx);
    runtime.shutdown();

    if (ctx.mode === "tui") resetPromptUi(ctx);
  });

  pi.on("turn_start", () => {
    runtime.handleTurnStart();
  });

  pi.on("agent_start", () => {
    runtime.startBorderChase();
  });

  pi.on("agent_end", () => {
    runtime.stopBorderChase();
  });

  pi.on("turn_end", (_event, ctx) => {
    runtime.handleTurnEnd(ctx);
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
    runtime.handleModelSelect(ctx);
  });

  pi.on("thinking_level_select", (_event, ctx) => {
    runtime.refreshThinkingLevelAndRender(ctx);
  });
}
