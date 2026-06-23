import type { Component, Terminal } from "@earendil-works/pi-tui";

export type StickyRenderable = Pick<Component, "render">;

export interface StickyTuiLike {
  terminal: Terminal;
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
