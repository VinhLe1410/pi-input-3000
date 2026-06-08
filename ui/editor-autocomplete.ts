import type { Component } from "@earendil-works/pi-tui";
import type { EditorFrameParts } from "./editor-types";

type AutocompleteEditorInternals = {
  autocompleteList?: Pick<Component, "render">;
  isShowingAutocomplete?: () => boolean;
};

export function splitRenderedEditor(
  editor: unknown,
  rendered: string[],
  innerWidth: number,
): EditorFrameParts {
  const editorInternals = editor as AutocompleteEditorInternals;
  const isShowingAutocomplete =
    typeof editorInternals.isShowingAutocomplete === "function" &&
    editorInternals.isShowingAutocomplete();
  const autocompleteCount =
    isShowingAutocomplete && typeof editorInternals.autocompleteList?.render === "function"
      ? editorInternals.autocompleteList.render(innerWidth).length
      : 0;

  if (autocompleteCount <= 0 || autocompleteCount >= rendered.length) {
    return { editorFrame: rendered, autocompleteLines: [] };
  }

  return {
    editorFrame: rendered.slice(0, -autocompleteCount),
    autocompleteLines: rendered.slice(-autocompleteCount),
  };
}
