import type { Component } from "@earendil-works/pi-tui";
import { isRecord } from "../core/unknown-record";
import type { EditorFrameParts } from "./editor-types";

interface EditorAutocompleteState {
  isShowingAutocomplete(): boolean;
  autocompleteList?: unknown;
}

function hasEditorAutocompleteState(editor: unknown): editor is EditorAutocompleteState {
  return isRecord(editor) && typeof editor.isShowingAutocomplete === "function";
}

function isComponent(value: unknown): value is Component {
  return isRecord(value)
    && typeof value.render === "function"
    && typeof value.invalidate === "function";
}

export function splitRenderedEditor(
  editor: unknown,
  rendered: string[],
  innerWidth: number,
): EditorFrameParts {
  if (!hasEditorAutocompleteState(editor)) {
    return { editorFrame: rendered, autocompleteLines: [] };
  }

  const isShowingAutocomplete = editor.isShowingAutocomplete();
  const autocompleteList = editor.autocompleteList;
  const autocompleteCount =
    isShowingAutocomplete && isComponent(autocompleteList)
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
