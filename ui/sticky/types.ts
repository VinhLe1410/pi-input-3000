import type { Component } from "@earendil-works/pi-tui";

export interface StickySlots {
  status: Component | null;
  widgetAbove: Component | null;
  editor: Component;
  widgetBelow: Component | null;
  footer: Component | null;
}
