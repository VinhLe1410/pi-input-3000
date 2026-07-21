import type { Terminal } from "@earendil-works/pi-tui";

export const ENABLE_SGR_MOUSE = "\x1b[?1002h\x1b[?1006h";
export const DISABLE_SGR_MOUSE = "\x1b[?1006l\x1b[?1002l";

export class MouseModeController {
  private readonly terminal: Pick<Terminal, "write">;
  private enabled = false;
  private paused = false;
  private resumeTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly exitCleanup = (): void => { this.cleanupAfterFailure(); };

  constructor(terminal: Pick<Terminal, "write">) { this.terminal = terminal; }

  enable(): void {
    if (this.enabled) return;
    process.once("exit", this.exitCleanup);
    try {
      this.terminal.write(ENABLE_SGR_MOUSE);
      this.enabled = true;
      this.paused = false;
    } catch (error: unknown) {
      this.cleanupAfterFailure();
      throw error;
    }
  }

  pause(durationMs: number, onResume?: () => void): void {
    if (!this.enabled) return;
    if (!this.paused) {
      try { this.terminal.write(DISABLE_SGR_MOUSE); }
      catch (error: unknown) { this.cleanupAfterFailure(); throw error; }
      this.paused = true;
    }
    if (this.resumeTimer) clearTimeout(this.resumeTimer);
    this.resumeTimer = setTimeout(() => {
      this.resumeTimer = undefined;
      if (!this.enabled || !this.paused) return;
      try {
        this.terminal.write(ENABLE_SGR_MOUSE);
        this.paused = false;
        onResume?.();
      } catch (_error: unknown) {
        // Timer callbacks cannot report to their caller; fail closed and remove cleanup state.
        this.cleanupAfterFailure();
      }
    }, durationMs);
    this.resumeTimer.unref?.();
  }

  resume(): void {
    if (!this.enabled || !this.paused) return;
    if (this.resumeTimer) clearTimeout(this.resumeTimer);
    this.resumeTimer = undefined;
    try {
      this.terminal.write(ENABLE_SGR_MOUSE);
      this.paused = false;
    } catch (error: unknown) {
      this.cleanupAfterFailure();
      throw error;
    }
  }

  disable(): void {
    if (this.resumeTimer) clearTimeout(this.resumeTimer);
    this.resumeTimer = undefined;
    try {
      if (this.enabled && !this.paused) this.terminal.write(DISABLE_SGR_MOUSE);
    } finally {
      this.resetState();
    }
  }

  isEnabled(): boolean { return this.enabled; }
  isPaused(): boolean { return this.paused; }

  private cleanupAfterFailure(): void {
    if (this.resumeTimer) clearTimeout(this.resumeTimer);
    this.resumeTimer = undefined;
    try { this.terminal.write(DISABLE_SGR_MOUSE); } catch (_cleanupError: unknown) {
      // A failed/partial terminal write has no further recovery path; release local state.
    }
    this.resetState();
  }

  private resetState(): void {
    this.enabled = false;
    this.paused = false;
    process.removeListener("exit", this.exitCleanup);
  }
}
