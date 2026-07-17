import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import {
  emptyGitStatus,
  parseGitStatus,
  sameGitStatus,
  type GitStatusSummary,
} from "./amp/git-status";
import type {
  AgentTimerState,
  InputStyle,
  InputStyleAdapter,
  InputStyleRuntime,
} from "./input-styles";
import { getThinkingLevel } from "./shared/editor-meta";

const TIMER_INTERVAL_MS = 1_000;
const GIT_TIMEOUT_MS = 5_000;

export class InputStyleRuntimeController implements InputStyleRuntime {
  private readonly pi: ExtensionAPI;
  private activeStyle: InputStyle = "default";
  private activeTui: TUI | undefined;
  private cachedThinkingLevel: string | undefined;
  private gitStatus = emptyGitStatus();
  private gitRefreshGeneration = 0;
  private agentStartedAt: number | undefined;
  private lastAgentDurationSeconds: number | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(pi: ExtensionAPI) {
    this.pi = pi;
  }

  applyStyle(ctx: ExtensionContext, adapter: InputStyleAdapter): void {
    this.activeStyle = adapter.id;
    this.activeTui = undefined;

    if (adapter.id === "amp") {
      this.refreshGit(ctx.cwd);
    } else {
      this.clearGitStatus();
    }

    adapter.apply(ctx, this);
    this.requestRender();
  }

  currentGit(): GitStatusSummary {
    return this.gitStatus;
  }

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

  registerActiveTui(tui: TUI | undefined): void {
    this.activeTui = tui;
  }

  refreshThinkingLevel(ctx: ExtensionContext): void {
    this.cachedThinkingLevel = getThinkingLevel(ctx);
  }

  refreshThinkingLevelAndRender(ctx: ExtensionContext): void {
    this.refreshThinkingLevel(ctx);
    this.requestRender();
  }

  startAgentTimer(): void {
    if (this.activeStyle !== "amp" || this.agentStartedAt !== undefined) return;

    this.lastAgentDurationSeconds = undefined;
    this.agentStartedAt = Date.now();
    this.timer = setInterval(() => this.requestRender(), TIMER_INTERVAL_MS);
    this.timer.unref?.();
    this.requestRender();
  }

  handleAgentSettled(ctx: ExtensionContext): void {
    this.stopAgentTimer();
    if (this.activeStyle === "amp") this.refreshGit(ctx.cwd);
  }

  requestRender(): void {
    this.activeTui?.requestRender();
  }

  shutdown(): void {
    this.stopAgentTimer(false);
    this.gitRefreshGeneration += 1;
    this.gitStatus = emptyGitStatus();
    this.activeStyle = "default";
    this.activeTui = undefined;
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

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.agentStartedAt = undefined;
    if (render && wasRunning) this.requestRender();
  }

  private clearGitStatus(): void {
    this.gitRefreshGeneration += 1;
    this.gitStatus = emptyGitStatus();
  }

  private refreshGit(cwd: string): void {
    const generation = ++this.gitRefreshGeneration;

    this.pi.exec(
      "git",
      ["status", "--porcelain=2", "--branch"],
      { timeout: GIT_TIMEOUT_MS },
    ).then((result) => {
      if (generation !== this.gitRefreshGeneration || this.activeStyle !== "amp") return;

      const next = result.code === 0 ? parseGitStatus(result.stdout) : emptyGitStatus();
      if (sameGitStatus(this.gitStatus, next)) return;

      this.gitStatus = next;
      this.requestRender();
    }).catch(() => {
      if (generation !== this.gitRefreshGeneration || this.activeStyle !== "amp") return;
      if (sameGitStatus(this.gitStatus, emptyGitStatus())) return;

      this.gitStatus = emptyGitStatus();
      this.requestRender();
    });
  }
}
