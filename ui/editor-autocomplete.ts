import type { Component } from "@earendil-works/pi-tui";
import type { EditorFrameParts } from "./editor-types";

type UnknownRecord = Record<string, unknown>;
type RenderableComponent = Pick<Component, "render">;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function isRenderableComponent(value: unknown): value is RenderableComponent {
  return isRecord(value) && typeof value.render === "function";
}

export function splitRenderedEditor(
  editor: unknown,
  rendered: string[],
  innerWidth: number,
): EditorFrameParts {
  if (!isRecord(editor)) return { editorFrame: rendered, autocompleteLines: [] };

  const isShowingAutocomplete =
    typeof editor.isShowingAutocomplete === "function" &&
    editor.isShowingAutocomplete();
  const autocompleteList = editor.autocompleteList;
  const autocompleteCount =
    isShowingAutocomplete && isRenderableComponent(autocompleteList)
      ? autocompleteList.render(innerWidth).length
      : 0;

  if (autocompleteCount <= 0 || autocompleteCount >= rendered.length) {
    return { editorFrame: rendered, autocompleteLines: [] };
  }

  return {
    editorFrame: rendered.slice(0, -autocompleteCount),
    autocompleteLines: rendered.slice(-autocompleteCount),
  };
}
