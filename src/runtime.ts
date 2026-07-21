import { copyToClipboard, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import {
  emptyGitStatus,
  parseGitStatus,
  sameGitStatus,
  type GitStatusSummary,
} from "./amp/git-status";
import { loadInputStyleConfig, saveInputStyleConfig } from "./config";
import {
  findInputStyleAdapter,
  type AgentTimerState,
  type InputStyle,
  type InputStyleConfig,
  type InputStyleRuntime,
} from "./input-styles";
import { showInputStyleMenu } from "./settings/menu";
import { getThinkingLevel } from "./shared/editor-meta";
import {
  installStickyRootAdapter,
  type StickyInstallation,
} from "./sticky/root-render-adapter";

const TIMER_INTERVAL_MS = 1_000;
const GIT_TIMEOUT_MS = 5_000;

export class InputFlowController implements InputStyleRuntime {
  private desiredConfig: InputStyleConfig = loadInputStyleConfig();
  private appliedStyle: InputStyle | undefined;
  private stickyApplied = false;
  private activeContext: ExtensionContext | undefined;
  private activeTui: TUI | undefined;
  private activeEditor: Component | undefined;
  private stickyInstallation: StickyInstallation | undefined;
  private stickyUnavailableNotified = false;
  private sessionGeneration = 0;
  private cachedThinkingLevel: string | undefined;
  private gitStatus = emptyGitStatus();
  private gitRefreshGeneration = 0;
  private agentStartedAt: number | undefined;
  private lastAgentDurationSeconds: number | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly pi: ExtensionAPI) {}

  register(): void {
    this.pi.registerCommand("input-style", {
      description: "Select a Pi Custom Input style",
      handler: async (_args, ctx) => this.showSettings(ctx),
    });

    this.pi.on("session_start", (_event, ctx) => this.startSession(ctx));
    this.pi.on("session_shutdown", () => this.shutdown());
    this.pi.on("agent_start", () => this.startAgentTimer());
    this.pi.on("agent_settled", (_event, ctx) => this.handleAgentSettled(ctx));
    this.pi.on("message_end", () => this.requestRender());
    this.pi.on("session_tree", (_event, ctx) => this.refreshThinkingLevelAndRender(ctx));
    this.pi.on("session_compact", (_event, ctx) => this.refreshThinkingLevelAndRender(ctx));
    this.pi.on("model_select", (_event, ctx) => this.refreshThinkingLevelAndRender(ctx));
    this.pi.on("thinking_level_select", (_event, ctx) => this.refreshThinkingLevelAndRender(ctx));
  }

  currentGit(): GitStatusSummary { return this.gitStatus; }

  getAgentTimer(): AgentTimerState | undefined {
    if (this.agentStartedAt !== undefined) {
      return { seconds: this.activeAgentElapsedSeconds(), active: true };
    }
    return this.lastAgentDurationSeconds === undefined
      ? undefined
      : { seconds: this.lastAgentDurationSeconds, active: false };
  }

  getThinkingLevel(ctx: ExtensionContext): string {
    return this.cachedThinkingLevel ?? getThinkingLevel(ctx);
  }

  registerActiveEditor(tui: TUI, editor: Component): void {
    if (tui === this.activeTui && editor === this.activeEditor && this.stickyInstallation) return;
    this.disposeSticky();
    this.activeTui = tui;
    this.activeEditor = editor;
    this.applyStickyCapability(editor);
  }

  requestRender(): void { this.activeTui?.requestRender(); }

  private startSession(ctx: ExtensionContext): void {
    this.shutdownSessionState();
    this.sessionGeneration += 1;
    this.activeContext = ctx;
    this.stickyUnavailableNotified = false;
    this.cachedThinkingLevel = getThinkingLevel(ctx);
    this.desiredConfig = loadInputStyleConfig();
    if (ctx.mode === "tui") this.applyDesiredConfig(ctx);
  }

  private applyDesiredConfig(ctx: ExtensionContext): void {
    const adapter = findInputStyleAdapter(this.desiredConfig.style);
    this.appliedStyle = undefined;
    this.disposeSticky();
    this.activeTui = undefined;
    this.activeEditor = undefined;
    this.stickyApplied = false;

    if (adapter.id === "amp") this.refreshGit(ctx.cwd);
    else this.clearGitStatus();

    // Style installation is synchronous. The editor factory later supplies the
    // active TUI, at which point optional layout capabilities are evaluated.
    adapter.apply(ctx, this);
    this.appliedStyle = adapter.id;
    this.requestRender();
  }

  private applyStickyCapability(editor: Component): void {
    this.stickyApplied = false;
    if (!this.desiredConfig.stickyInput || !this.activeTui || !this.activeContext) return;

    const installation = installStickyRootAdapter(this.activeTui, editor, copyToClipboard);
    if (!installation.applied) {
      this.notifyStickyUnavailable(installation.reason ?? "unsupported Pi root layout");
      return;
    }
    this.stickyInstallation = installation;
    this.stickyApplied = true;
  }

  private disposeSticky(): void {
    this.stickyInstallation?.dispose();
    this.stickyInstallation = undefined;
    this.stickyApplied = false;
  }

  private notifyStickyUnavailable(reason: string): void {
    if (this.stickyUnavailableNotified || !this.activeContext) return;
    this.stickyUnavailableNotified = true;
    this.activeContext.ui.notify(`Sticky input disabled: ${reason}`, "warning");
  }

  private async showSettings(ctx: ExtensionContext): Promise<void> {
    if (ctx.mode !== "tui") {
      ctx.ui.notify("/input-style requires TUI mode", "error");
      return;
    }

    const generation = this.sessionGeneration;
    const selected = await showInputStyleMenu(ctx, this.desiredConfig);
    if (!selected || generation !== this.sessionGeneration) return;

    try {
      saveInputStyleConfig(selected);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(`Failed to save input settings: ${message}`, "error");
      return;
    }

    this.desiredConfig = selected;
    this.applyDesiredConfig(ctx);
    const stickyLabel = selected.stickyInput && !this.stickyApplied
      ? "unavailable"
      : selected.stickyInput ? "on" : "off";
    ctx.ui.notify(
      `Input style: ${findInputStyleAdapter(selected.style).label}; sticky input: ${stickyLabel}`,
      "info",
    );
  }

  private refreshThinkingLevelAndRender(ctx: ExtensionContext): void {
    this.cachedThinkingLevel = getThinkingLevel(ctx);
    this.requestRender();
  }

  private startAgentTimer(): void {
    if (this.appliedStyle !== "amp" || this.agentStartedAt !== undefined) return;
    this.lastAgentDurationSeconds = undefined;
    this.agentStartedAt = Date.now();
    this.timer = setInterval(() => this.requestRender(), TIMER_INTERVAL_MS);
    this.timer.unref?.();
    this.requestRender();
  }

  private handleAgentSettled(ctx: ExtensionContext): void {
    this.stopAgentTimer();
    if (this.appliedStyle === "amp") this.refreshGit(ctx.cwd);
  }

  private shutdown(): void {
    this.sessionGeneration += 1;
    this.shutdownSessionState();
  }

  private shutdownSessionState(): void {
    this.stopAgentTimer(false);
    this.gitRefreshGeneration += 1;
    this.disposeSticky();
    this.gitStatus = emptyGitStatus();
    this.activeContext = undefined;
    this.activeTui = undefined;
    this.activeEditor = undefined;
    this.appliedStyle = undefined;
    this.cachedThinkingLevel = undefined;
    this.lastAgentDurationSeconds = undefined;
  }

  private activeAgentElapsedSeconds(): number {
    if (this.agentStartedAt === undefined) return 0;
    return Math.max(0, Math.floor((Date.now() - this.agentStartedAt) / TIMER_INTERVAL_MS));
  }

  private stopAgentTimer(render = true): void {
    const wasRunning = this.agentStartedAt !== undefined;
    if (wasRunning) this.lastAgentDurationSeconds = this.activeAgentElapsedSeconds();
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.agentStartedAt = undefined;
    if (render && wasRunning) this.requestRender();
  }

  private clearGitStatus(): void {
    this.gitRefreshGeneration += 1;
    this.gitStatus = emptyGitStatus();
  }

  private refreshGit(cwd: string): void {
    const generation = ++this.gitRefreshGeneration;
    this.pi.exec("git", ["status", "--porcelain=2", "--branch"], { timeout: GIT_TIMEOUT_MS })
      .then((result) => {
        if (generation !== this.gitRefreshGeneration || this.appliedStyle !== "amp") return;
        const next = result.code === 0 ? parseGitStatus(result.stdout) : emptyGitStatus();
        if (sameGitStatus(this.gitStatus, next)) return;
        this.gitStatus = next;
        this.requestRender();
      })
      .catch(() => {
        if (generation !== this.gitRefreshGeneration || this.appliedStyle !== "amp") return;
        const empty = emptyGitStatus();
        if (sameGitStatus(this.gitStatus, empty)) return;
        this.gitStatus = empty;
        this.requestRender();
      });
  }
}
