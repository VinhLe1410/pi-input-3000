import type {
  ExtensionAPI,
  ExtensionContext,
  ReadonlyFooterDataProvider,
  Theme,
} from "@earendil-works/pi-coding-agent";
import type { KeybindingsManager } from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";
import { PROJECT_REFRESH_INTERVAL_MS } from "./core/runtime-config";
import { createFeatureHost } from "./features/host";
import { createUsageQuotaFeature } from "./features/usage-quota";
import { createGitState } from "./seams/git";
import { createProjectRefreshController } from "./seams/project-refresh";
import { BORDER_CHASE, BORDER_CHASE_FRAME_COUNT } from "./ui/design-tokens";
import { PolishedInputEditor } from "./ui/editor";
import { buildEditorMeta, getThinkingLevel } from "./ui/editor-meta";
import { renderStatusFooter } from "./ui/status-footer";
import { pickWorkingMessage } from "./whimsical/messages";

export default function (pi: ExtensionAPI) {
  const git = createGitState();

  let activeTui: TUI | undefined;
  let requestFooterRender: (() => void) | undefined;
  let hasPromptUi = false;
  let borderChaseTimer: ReturnType<typeof setInterval> | undefined;
  let borderChaseActive = false;
  let borderChaseFrameIndex = 0;
  let workingMessage: string | undefined;
  let cachedThinkingLevel: string | undefined;

  function refreshThinkingLevel(ctx: ExtensionContext): void {
    cachedThinkingLevel = getThinkingLevel(ctx);
  }

  function requestUiRender(): void {
    if (activeTui) {
      activeTui.requestRender();
      return;
    }
    requestFooterRender?.();
  }

  const features = createFeatureHost([
    createUsageQuotaFeature({ requestRender: requestUiRender }),
  ]);

  function stopBorderChase(render = true): void {
    const wasRunning = borderChaseActive || borderChaseTimer !== undefined;
    if (borderChaseTimer) {
      clearInterval(borderChaseTimer);
      borderChaseTimer = undefined;
    }
    borderChaseActive = false;
    borderChaseFrameIndex = 0;
    if (render && wasRunning) requestUiRender();
  }

  function startBorderChase(): void {
    if (!hasPromptUi) return;

    stopBorderChase(false);
    borderChaseActive = true;
    borderChaseFrameIndex = 0;
    borderChaseTimer = setInterval(() => {
      borderChaseFrameIndex = (borderChaseFrameIndex + 1) % BORDER_CHASE_FRAME_COUNT;
      requestUiRender();
    }, BORDER_CHASE.intervalMs);
    borderChaseTimer.unref?.();
    requestUiRender();
  }

  const projectRefresh = createProjectRefreshController({
    git,
    intervalMs: PROJECT_REFRESH_INTERVAL_MS,
    onChange: () => {
      requestUiRender();
    },
  });

  pi.on("session_start", (_event, ctx) => {
    refreshThinkingLevel(ctx);

    if (ctx.mode !== "tui") {
      hasPromptUi = false;
      return;
    }

    hasPromptUi = true;
    ctx.ui.setWorkingMessage();
    ctx.ui.setWorkingIndicator();
    ctx.ui.setWorkingVisible(false);
    projectRefresh.start(ctx.cwd);
    features.sessionStart(ctx);

    ctx.ui.setEditorComponent((tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager) => {
      activeTui = tui;

      return new PolishedInputEditor(
        tui,
        theme,
        keybindings,
        () => ({
          meta: buildEditorMeta(
            ctx,
            git.current(),
            cachedThinkingLevel ?? getThinkingLevel(ctx),
          ),
          chaseFrameIndex: borderChaseActive ? borderChaseFrameIndex : undefined,
          chaseFrameCount: BORDER_CHASE_FRAME_COUNT,
          workingMessage,
        }),
        ctx.ui.theme,
      );
    });

    ctx.ui.setFooter((tui: TUI, theme: Theme, footerData: ReadonlyFooterDataProvider) => {
      requestFooterRender = () => tui.requestRender();

      return {
        dispose() {
          requestFooterRender = undefined;
        },
        invalidate() {},
        render(width: number): string[] {
          return renderStatusFooter(ctx, footerData, width, theme, {
            rightSegments: features.footerRight(theme),
          });
        },
      };
    });
  });

  pi.on("session_shutdown", (_event, ctx) => {
    stopBorderChase(false);
    projectRefresh.stop();
    features.sessionShutdown(ctx);
    requestFooterRender = undefined;
    activeTui = undefined;
    hasPromptUi = false;
    workingMessage = undefined;
    cachedThinkingLevel = undefined;

    if (ctx.mode !== "tui") return;
    ctx.ui.setWorkingMessage();
    ctx.ui.setWorkingIndicator();
    ctx.ui.setWorkingVisible(true);
  });

  pi.on("turn_start", () => {
    workingMessage = pickWorkingMessage();
    requestUiRender();
  });

  pi.on("agent_start", () => {
    startBorderChase();
  });

  pi.on("agent_end", () => {
    stopBorderChase();
  });

  pi.on("turn_end", (_event, ctx) => {
    workingMessage = undefined;
    refreshThinkingLevel(ctx);
    projectRefresh.schedule();
    requestUiRender();
  });

  pi.on("message_end", () => {
    requestUiRender();
  });

  pi.on("session_tree", (_event, ctx) => {
    refreshThinkingLevel(ctx);
    requestUiRender();
  });

  pi.on("session_compact", (_event, ctx) => {
    refreshThinkingLevel(ctx);
    requestUiRender();
  });

  pi.on("model_select", (_event, ctx) => {
    features.modelSelect(ctx);
    refreshThinkingLevel(ctx);
    requestUiRender();
  });

  pi.on("thinking_level_select", (_event, ctx) => {
    refreshThinkingLevel(ctx);
    requestUiRender();
  });
}
