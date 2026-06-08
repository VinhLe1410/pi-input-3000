import type {
  ExtensionAPI,
  ExtensionContext,
  ReadonlyFooterDataProvider,
  Theme,
} from "@earendil-works/pi-coding-agent";
import type { KeybindingsManager } from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";
import {
  PROJECT_REFRESH_INTERVAL_MS,
  USAGE_REFRESH_INTERVAL,
} from "./core/constants";
import { usageProviderForPiProvider } from "./core/providers";
import type { UsageProviderKey } from "./core/providers";
import { createFetcherRegistry } from "./fetchers";
import { createAuthResolver } from "./seams/auth";
import { createGitState } from "./seams/git";
import { createUsageState } from "./seams/usage-state";
import { PolishedInputEditor, type EditorMeta } from "./ui/editor";
import { buildEditorMeta, getThinkingLevel } from "./ui/editor-meta";
import { renderStatusFooter } from "./ui/status-footer";
import { pickWorkingMessage } from "./whimsical/messages";

const BORDER_CHASE_INTERVAL_MS = 50;
const BORDER_CHASE_CYCLE_MS = 850;
const BORDER_CHASE_FRAME_COUNT = Math.max(
  1,
  Math.round(BORDER_CHASE_CYCLE_MS / BORDER_CHASE_INTERVAL_MS),
);

function detectProvider(modelProvider: string | undefined): UsageProviderKey | null {
  return usageProviderForPiProvider(modelProvider);
}

export default function (pi: ExtensionAPI) {
  const auth = createAuthResolver();
  const git = createGitState();
  const usage = createUsageState({
    registry: createFetcherRegistry(auth),
    intervalMs: USAGE_REFRESH_INTERVAL,
  });

  let sessionGeneration = 0;
  let activeContext: ExtensionContext | undefined;
  let activeTui: TUI | undefined;
  let activeCwd: string | undefined;
  let projectRefreshTimer: ReturnType<typeof setInterval> | undefined;
  let projectRefreshInFlight = false;
  let projectRefreshPending = false;
  let requestFooterRender: (() => void) | undefined;
  let cleanupUsageListener: (() => void) | undefined;
  let hasPromptUi = false;
  let borderChaseTimer: ReturnType<typeof setInterval> | undefined;
  let borderChaseActive = false;
  let borderChaseFrameIndex = 0;
  let workingMessage: string | undefined;
  let editorMeta: EditorMeta | undefined;

  function isCurrentSession(generation: number): boolean {
    return generation === sessionGeneration;
  }

  function isCurrentProjectRefresh(generation: number, cwd: string): boolean {
    return isCurrentSession(generation) && cwd === activeCwd;
  }

  function refreshEditorMeta(ctx = activeContext): void {
    if (!ctx) return;
    activeContext = ctx;
    const thinkingLevel = getThinkingLevel(ctx);
    editorMeta = buildEditorMeta(ctx, git.current(), thinkingLevel);
  }

  function currentEditorMeta(ctx: ExtensionContext): EditorMeta {
    if (!editorMeta) refreshEditorMeta(ctx);
    return editorMeta ?? buildEditorMeta(ctx, git.current(), "off");
  }

  function requestUiRender(): void {
    if (activeTui) {
      activeTui.requestRender();
      return;
    }
    requestFooterRender?.();
  }

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
    }, BORDER_CHASE_INTERVAL_MS);
    borderChaseTimer.unref?.();
    requestUiRender();
  }

  function scheduleProjectRefresh(cwd = activeCwd): void {
    if (!cwd) return;
    const generation = sessionGeneration;

    if (projectRefreshInFlight) {
      projectRefreshPending = true;
      return;
    }

    projectRefreshInFlight = true;
    git
      .refresh(cwd, () => isCurrentProjectRefresh(generation, cwd))
      .then((gitChanged) => {
        if (!isCurrentProjectRefresh(generation, cwd)) return;
        if (!gitChanged) return;

        refreshEditorMeta();
        requestUiRender();
      })
      .finally(() => {
        if (!isCurrentProjectRefresh(generation, cwd)) return;

        projectRefreshInFlight = false;
        if (projectRefreshPending) {
          projectRefreshPending = false;
          scheduleProjectRefresh(cwd);
        }
      });
  }

  function startProjectRefresh(cwd: string): void {
    activeCwd = cwd;
    if (projectRefreshTimer) clearInterval(projectRefreshTimer);
    scheduleProjectRefresh(cwd);
    projectRefreshTimer = setInterval(
      () => scheduleProjectRefresh(cwd),
      PROJECT_REFRESH_INTERVAL_MS,
    );
    projectRefreshTimer.unref?.();
  }

  function stopProjectRefresh(): void {
    if (projectRefreshTimer) {
      clearInterval(projectRefreshTimer);
      projectRefreshTimer = undefined;
    }
    projectRefreshInFlight = false;
    projectRefreshPending = false;
    activeCwd = undefined;
  }

  function startUsageForProvider(modelProvider: string | undefined): void {
    const provider = detectProvider(modelProvider);
    if (provider) {
      usage.start(provider);
    } else {
      usage.stop();
    }
  }

  pi.on("session_start", (_event, ctx) => {
    sessionGeneration += 1;
    activeContext = ctx;
    refreshEditorMeta(ctx);

    if (!ctx.hasUI) {
      hasPromptUi = false;
      return;
    }

    hasPromptUi = ctx.mode === "tui";
    ctx.ui.setWorkingMessage();
    ctx.ui.setWorkingIndicator();
    ctx.ui.setWorkingVisible(false);
    startProjectRefresh(ctx.cwd);
    startUsageForProvider(ctx.model?.provider);
    cleanupUsageListener?.();

    ctx.ui.setEditorComponent((tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager) => {
      cleanupUsageListener?.();
      activeTui = tui;
      cleanupUsageListener = usage.onChange(() => tui.requestRender());

      return new PolishedInputEditor(
        tui,
        theme,
        keybindings,
        () => ({
          meta: currentEditorMeta(ctx),
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
          return renderStatusFooter(
            ctx,
            footerData,
            usage.current(),
            width,
            theme,
          );
        },
      };
    });
  });

  pi.on("session_shutdown", (_event, ctx) => {
    sessionGeneration += 1;
    stopBorderChase(false);
    stopProjectRefresh();
    cleanupUsageListener?.();
    cleanupUsageListener = undefined;
    requestFooterRender = undefined;
    activeContext = undefined;
    activeTui = undefined;
    hasPromptUi = false;
    workingMessage = undefined;
    editorMeta = undefined;
    usage.stop();

    if (!ctx.hasUI) return;
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
    refreshEditorMeta(ctx);
    scheduleProjectRefresh();
    requestUiRender();
  });

  pi.on("model_select", (event, ctx) => {
    startUsageForProvider(event.model.provider);
    refreshEditorMeta(ctx);
    requestUiRender();
  });

  pi.on("thinking_level_select", (_event, ctx) => {
    refreshEditorMeta(ctx);
    requestUiRender();
  });
}
