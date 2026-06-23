import type { Component, Terminal } from "@earendil-works/pi-tui";
import type { ExtendedKeyboardMode } from "./ansi";

export type PatchedRenderable = Pick<Component, "render">;

interface RenderPatch {
  target: PatchedRenderable;
  originalRender: (width: number) => string[];
}

type CompositeLineAt = (
  baseLine: string,
  overlayLine: string,
  startCol: number,
  overlayWidth: number,
  totalWidth: number,
) => string;

type InputHandler = (data: string) => { consume?: boolean; data?: string } | undefined;
type RestoreStep = () => void;

interface PiTuiPatchTarget {
  terminal: Terminal;
  render?: (width: number) => string[];
  doRender?: () => void;
  compositeLineAt?: CompositeLineAt;
  addInputListener?: (handler: InputHandler) => () => void;
  requestRender?: () => void;
  hasOverlay?: () => boolean;
  overlayStack?: Array<{ hidden?: boolean } | null | undefined>;
  hardwareCursorRow?: number;
  cursorRow?: number;
  previousViewportTop?: number;
}

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
    this.originalDoRender = typeof tui.doRender === "function" ? tui.doRender.bind(tui) : null;
    this.originalRender = typeof tui.render === "function" ? tui.render.bind(tui) : null;
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
        this.tui.doRender = () => callbacks.renderPass(originalDoRender);
        this.restoreSteps.push(() => {
          this.tui.doRender = originalDoRender;
        });
      }

      if (typeof this.tui.compositeLineAt === "function") {
        this.originalCompositeLineAt = this.tui.compositeLineAt.bind(this.tui);
        this.tui.compositeLineAt = (
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
        ) ?? "";
        this.restoreSteps.push(() => {
          this.tui.compositeLineAt = this.originalCompositeLineAt ?? undefined;
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
    if (this.tui.hasOverlay?.()) return true;
    return this.tui.overlayStack?.some((entry) => entry && entry.hidden !== true) ?? false;
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
    const hardwareCursorRow = typeof this.tui.hardwareCursorRow === "number"
      ? this.tui.hardwareCursorRow
      : typeof this.tui.cursorRow === "number"
        ? this.tui.cursorRow
        : 0;
    const viewportTop = typeof this.tui.previousViewportTop === "number" ? this.tui.previousViewportTop : 0;
    return Math.max(1, Math.min(scrollBottom, hardwareCursorRow - viewportTop + 1));
  }

  hideRenderable(target: PatchedRenderable): void {
    if (this.patchedRenders.some((patch) => patch.target === target)) return;
    const originalRender = target.render.bind(target);
    this.patchedRenders.push({ target, originalRender });
    target.render = () => [];
  }

  renderHidden(target: PatchedRenderable, width: number): string[] {
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
