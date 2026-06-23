import type { TerminalInputHandler } from "@earendil-works/pi-coding-agent";
import type { Component, Terminal, TUI } from "@earendil-works/pi-tui";
import type { ExtendedKeyboardMode } from "./ansi";

interface RenderPatch {
  target: Component;
  originalRender: (width: number) => string[];
}

type CompositeLineAt = (
  baseLine: string,
  overlayLine: string,
  startCol: number,
  overlayWidth: number,
  totalWidth: number,
) => string;

type InputHandler = TerminalInputHandler;
type RestoreStep = () => void;

type PiTuiPatchTarget = Pick<
  TUI,
  "addInputListener" | "hasOverlay" | "render" | "requestRender" | "terminal"
>;

interface PiTuiAdapterOptions {
  getShowHardwareCursor?: () => boolean;
}

interface PiTuiInstallCallbacks {
  getRows(): number;
  renderRoot(width: number): string[];
  handleInput: InputHandler;
  write(data: string): void;
  renderPass(renderOriginal: () => void): void;
  normalizeCompositeLine(line: string): string;
}

function descriptorForRows(terminal: Terminal): PropertyDescriptor | undefined {
  let target: object | null = terminal;
  while (target) {
    const descriptor = Object.getOwnPropertyDescriptor(target, "rows");
    if (descriptor) return descriptor;
    target = Object.getPrototypeOf(target);
  }

  return undefined;
}

function readRows(terminal: Terminal, descriptor: PropertyDescriptor | undefined): number {
  if (descriptor?.get) {
    const value = descriptor.get.call(terminal);
    return typeof value === "number" && Number.isFinite(value) ? value : 24;
  }

  if (descriptor && "value" in descriptor) {
    const value = descriptor.value;
    return typeof value === "number" && Number.isFinite(value) ? value : 24;
  }

  const value = Reflect.get(terminal, "rows");
  return typeof value === "number" && Number.isFinite(value) ? value : 24;
}

export class PiTuiAdapter {
  readonly terminal: Terminal;

  private readonly tui: PiTuiPatchTarget;
  private readonly rowsDescriptor: PropertyDescriptor | undefined;
  private readonly originalWrite: (data: string) => void;
  private readonly originalDoRender: (() => void) | null;
  private readonly originalRender: ((width: number) => string[]) | null;
  private readonly getShowHardwareCursorFn: () => boolean;
  private originalCompositeLineAt: CompositeLineAt | null = null;
  private readonly patchedRenders: RenderPatch[] = [];
  private removeInputListener: (() => void) | null = null;
  private readonly restoreSteps: RestoreStep[] = [];

  constructor(tui: PiTuiPatchTarget, options: PiTuiAdapterOptions = {}) {
    this.tui = tui;
    this.terminal = tui.terminal;
    this.rowsDescriptor = descriptorForRows(this.terminal);
    this.originalWrite = this.terminal.write.bind(this.terminal);
    const doRender = Reflect.get(tui, "doRender");
    this.originalDoRender = typeof doRender === "function" ? doRender.bind(tui) : null;
    this.originalRender = tui.render.bind(tui);
    this.getShowHardwareCursorFn = options.getShowHardwareCursor ?? (() => false);
  }

  writeRaw(data: string): void {
    this.originalWrite(data);
  }

  readRawRows(): number {
    return readRows(this.terminal, this.rowsDescriptor);
  }

  hasRootRender(): boolean {
    return this.originalRender !== null;
  }

  renderRoot(width: number): string[] {
    return this.originalRender?.(width) ?? [];
  }

  install(callbacks: PiTuiInstallCallbacks): void {
    try {
      Object.defineProperty(this.terminal, "rows", {
        configurable: true,
        get: callbacks.getRows,
      });
      this.restoreSteps.push(() => this.restoreRows());

      if (this.originalRender) {
        const originalRender = this.originalRender;
        this.tui.render = callbacks.renderRoot;
        this.restoreSteps.push(() => {
          this.tui.render = originalRender;
        });
      }

      if (typeof this.tui.addInputListener === "function") {
        this.removeInputListener = this.tui.addInputListener(callbacks.handleInput);
        this.restoreSteps.push(() => {
          this.removeInputListener?.();
          this.removeInputListener = null;
        });
      }

      this.terminal.write = callbacks.write;
      this.restoreSteps.push(() => {
        this.terminal.write = this.originalWrite;
      });

      if (this.originalDoRender) {
        const originalDoRender = this.originalDoRender;
        Reflect.set(this.tui, "doRender", () => callbacks.renderPass(originalDoRender));
        this.restoreSteps.push(() => {
          Reflect.set(this.tui, "doRender", originalDoRender);
        });
      }

      const compositeLineAt = Reflect.get(this.tui, "compositeLineAt");
      if (typeof compositeLineAt === "function") {
        this.originalCompositeLineAt = compositeLineAt.bind(this.tui);
        Reflect.set(
          this.tui,
          "compositeLineAt",
          (
            baseLine: string,
            overlayLine: string,
            startCol: number,
            overlayWidth: number,
            totalWidth: number,
          ) => this.originalCompositeLineAt?.(
            callbacks.normalizeCompositeLine(baseLine),
            callbacks.normalizeCompositeLine(overlayLine),
            startCol,
            overlayWidth,
            totalWidth,
          ) ?? "",
        );
        this.restoreSteps.push(() => {
          Reflect.set(this.tui, "compositeLineAt", this.originalCompositeLineAt ?? undefined);
          this.originalCompositeLineAt = null;
        });
      }
    } catch (error: unknown) {
      this.restore();
      throw error;
    }
  }

  requestRender(): void {
    this.tui.requestRender?.();
  }

  hasVisibleOverlay(): boolean {
    if (this.tui.hasOverlay()) return true;
    const overlayStack = Reflect.get(this.tui, "overlayStack");
    return Array.isArray(overlayStack)
      && overlayStack.some((entry: { hidden?: boolean } | null | undefined) => entry && entry.hidden !== true);
  }

  getShowHardwareCursor(): boolean {
    return this.getShowHardwareCursorFn();
  }

  activeExtendedKeyboardMode(): ExtendedKeyboardMode | null {
    if (this.terminal.kittyProtocolActive === true) return "kitty";
    if (Reflect.get(this.terminal, "_modifyOtherKeysActive") === true) return "modifyOtherKeys";
    return null;
  }

  getCursorScreenRow(scrollBottom: number): number {
    const hardwareCursorRowValue = Reflect.get(this.tui, "hardwareCursorRow");
    const cursorRowValue = Reflect.get(this.tui, "cursorRow");
    const viewportTopValue = Reflect.get(this.tui, "previousViewportTop");
    const hardwareCursorRow = typeof hardwareCursorRowValue === "number"
      ? hardwareCursorRowValue
      : typeof cursorRowValue === "number"
        ? cursorRowValue
        : 0;
    const viewportTop = typeof viewportTopValue === "number" ? viewportTopValue : 0;
    return Math.max(1, Math.min(scrollBottom, hardwareCursorRow - viewportTop + 1));
  }

  hideRenderable(target: Component): void {
    if (this.patchedRenders.some((patch) => patch.target === target)) return;
    const originalRender = target.render.bind(target);
    this.patchedRenders.push({ target, originalRender });
    target.render = () => [];
  }

  renderHidden(target: Component, width: number): string[] {
    const patch = this.patchedRenders.find((candidate) => candidate.target === target);
    const render = patch?.originalRender ?? target.render.bind(target);
    return render(width);
  }

  restore(): void {
    for (const patch of this.patchedRenders.splice(0)) {
      patch.target.render = patch.originalRender;
    }

    for (const step of this.restoreSteps.splice(0).reverse()) step();
  }

  private restoreRows(): void {
    if (this.rowsDescriptor) {
      Object.defineProperty(this.terminal, "rows", this.rowsDescriptor);
    } else {
      Reflect.deleteProperty(this.terminal, "rows");
    }
  }
}
