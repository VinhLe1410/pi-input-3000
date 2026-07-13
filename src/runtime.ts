import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import { PROJECT_REFRESH_INTERVAL_MS } from "./constants";
import type {
  InputStyleAdapter,
  InputStyleCapabilities,
  InputStyleRuntime,
  ProjectBranchStatus,
} from "./input-styles";
import { createGitState, type GitState } from "./input-3000/repository-status/git-status";
import {
  createProjectRefreshController,
  type ProjectRefreshController,
} from "./input-3000/repository-status/refresh-controller";
import { BORDER_CHASE, BORDER_CHASE_FRAME_COUNT } from "./input-3000/constants";
import { getThinkingLevel } from "./shared/editor-meta";

export class InputStyleRuntimeController implements InputStyleRuntime {
  private readonly git: GitState;
  private readonly projectRefresh: ProjectRefreshController;

  private activeAdapter: InputStyleAdapter | undefined;
  private activeTui: TUI | undefined;
  private footerRender: (() => void) | undefined;
  private activeCapabilities: InputStyleCapabilities = {};
  private promptUiActive = false;
  private chaseEnabled = false;
  private chaseTimer: ReturnType<typeof setInterval> | undefined;
  private chaseActive = false;
  private chaseFrameIndex = 0;
  private workingMessage: string | undefined;
  private cachedThinkingLevel: string | undefined;

  constructor() {
    this.git = createGitState();
    this.projectRefresh = createProjectRefreshController({
      git: this.git,
      intervalMs: PROJECT_REFRESH_INTERVAL_MS,
      onChange: () => this.requestRender(),
    });
  }

  applyStyle(ctx: ExtensionContext, adapter: InputStyleAdapter): void {
    this.deactivateStyle(ctx);
    this.activeAdapter = adapter;
    this.activeCapabilities = adapter.capabilities ?? {};

    if (this.activeCapabilities.projectRefresh) this.projectRefresh.start(ctx.cwd);
    this.setChaseEnabled(this.activeCapabilities.borderChase === true);

    adapter.apply(ctx, this);
    this.requestRender();
  }

  deactivateStyle(_ctx: ExtensionContext): void {
    this.stopBorderChase(false);
    this.projectRefresh.stop();
    this.registerFooterRender(undefined);
    this.setChaseEnabled(false);
    this.activeAdapter = undefined;
    this.activeCapabilities = {};
  }

  handleTurnStart(): void {
    this.setWorkingMessage(this.activeAdapter?.createWorkingMessage?.());
    this.requestRender();
  }

  handleTurnEnd(ctx: ExtensionContext): void {
    this.setWorkingMessage(undefined);
    this.refreshThinkingLevel(ctx);
    if (this.activeCapabilities.projectRefresh) this.projectRefresh.schedule();
    this.requestRender();
  }

  handleModelSelect(ctx: ExtensionContext): void {
    this.refreshThinkingLevel(ctx);
    this.requestRender();
  }

  refreshThinkingLevelAndRender(ctx: ExtensionContext): void {
    this.refreshThinkingLevel(ctx);
    this.requestRender();
  }

  currentGit(): ProjectBranchStatus {
    return this.git.current();
  }

  getThinkingLevel(ctx: ExtensionContext): string {
    return this.cachedThinkingLevel ?? getThinkingLevel(ctx);
  }

  getWorkingMessage(): string | undefined {
    return this.workingMessage;
  }

  isBorderChaseActive(): boolean {
    return this.chaseActive;
  }

  getBorderChaseFrameIndex(): number {
    return this.chaseFrameIndex;
  }

  registerActiveTui(tui: TUI | undefined): void {
    this.activeTui = tui;
  }

  registerFooterRender(fn: (() => void) | undefined): void {
    this.footerRender = fn;
  }

  requestRender(): void {
    if (this.activeTui) {
      this.activeTui.requestRender();
      return;
    }
    this.footerRender?.();
  }

  stopBorderChase(render = true): void {
    const wasRunning = this.chaseActive || this.chaseTimer !== undefined;
    if (this.chaseTimer) {
      clearInterval(this.chaseTimer);
      this.chaseTimer = undefined;
    }
    this.chaseActive = false;
    this.chaseFrameIndex = 0;
    if (render && wasRunning) this.requestRender();
  }

  setChaseEnabled(enabled: boolean): void {
    this.chaseEnabled = enabled;
  }

  refreshThinkingLevel(ctx: ExtensionContext): void {
    this.cachedThinkingLevel = getThinkingLevel(ctx);
  }

  setWorkingMessage(msg: string | undefined): void {
    this.workingMessage = msg;
  }

  setPromptUiActive(active: boolean): void {
    this.promptUiActive = active;
  }

  startBorderChase(): void {
    if (!this.promptUiActive || !this.chaseEnabled) return;

    this.stopBorderChase(false);
    this.chaseActive = true;
    this.chaseFrameIndex = 0;
    this.chaseTimer = setInterval(() => {
      this.chaseFrameIndex = (this.chaseFrameIndex + 1) % BORDER_CHASE_FRAME_COUNT;
      this.requestRender();
    }, BORDER_CHASE.intervalMs);
    this.chaseTimer.unref?.();
    this.requestRender();
  }

  shutdown(): void {
    this.activeAdapter = undefined;
    this.activeTui = undefined;
    this.footerRender = undefined;
    this.workingMessage = undefined;
    this.cachedThinkingLevel = undefined;
    this.promptUiActive = false;
    this.chaseEnabled = false;
  }
}
