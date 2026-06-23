export interface StickyRenderable {
  render(width: number): string[];
}

export interface TerminalLike {
  columns: number;
  rows: number;
  kittyProtocolActive?: boolean;
  write(data: string): void;
}

export interface StickyTuiLike {
  terminal: TerminalLike;
  children?: unknown[];
  requestRender?: () => void;
  getShowHardwareCursor?: () => boolean;
}

export interface StickySlots {
  status: StickyRenderable | null;
  widgetAbove: StickyRenderable | null;
  editor: StickyRenderable;
  widgetBelow: StickyRenderable | null;
  footer: StickyRenderable | null;
}

export function isStickyRenderable(value: unknown): value is StickyRenderable {
  return value != null
    && typeof value === "object"
    && "render" in value
    && typeof value.render === "function";
}
