import { Container, type Component, type TUI } from "@earendil-works/pi-tui";
import type { StickySlots } from "../pinned-cluster/sticky-slots";

function containerChildren(candidate: Component): Component[] {
  return candidate instanceof Container ? candidate.children : [];
}

function findContainerIndex(tui: TUI, renderable: Component): number {
  return tui.children.findIndex((candidate) => containerChildren(candidate).includes(renderable));
}

function looksLikeEditorRenderable(candidate: Component): boolean {
  return typeof candidate.handleInput === "function";
}

function findEditorContainerIndex(tui: TUI): number {
  return tui.children.findIndex((candidate) =>
    containerChildren(candidate).some((child) => looksLikeEditorRenderable(child)),
  );
}

function componentAt(children: Component[], index: number): Component | null {
  return children[index] ?? null;
}

export function discoverStickySlots(
  tui: TUI,
  capturedEditor: Component | null,
): StickySlots | null {
  const children = tui.children;
  const editorIndex = capturedEditor
    ? findContainerIndex(tui, capturedEditor)
    : findEditorContainerIndex(tui);

  if (editorIndex === -1) return null;

  const editor = componentAt(children, editorIndex);
  if (!editor) return null;

  return {
    status: editorIndex >= 2 ? componentAt(children, editorIndex - 2) : null,
    widgetAbove: editorIndex >= 1 ? componentAt(children, editorIndex - 1) : null,
    editor,
    widgetBelow: componentAt(children, editorIndex + 1),
    footer: componentAt(children, editorIndex + 2),
  };
}
