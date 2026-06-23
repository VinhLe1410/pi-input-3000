import { splitRenderedEditor } from "./editor-autocomplete";
import type { EditorFrameParts } from "./editor-types";
import { clampRenderedLines } from "./rendering";

interface FramedEditorRenderOptions {
  editor: unknown;
  width: number;
  minWidth: number;
  contentWidth(width: number): number;
  renderBase(width: number): string[];
  renderFrame(parts: EditorFrameParts, innerWidth: number): string[];
}

export function renderFramedEditor(options: FramedEditorRenderOptions): string[] {
  const { width, minWidth, renderBase } = options;
  if (width <= minWidth) return clampRenderedLines(renderBase(width), width);

  const innerWidth = options.contentWidth(width);
  const rendered = renderBase(innerWidth);
  const { editorFrame, autocompleteLines } = splitRenderedEditor(
    options.editor,
    rendered,
    innerWidth,
  );

  if (editorFrame.length < 2) {
    return clampRenderedLines(renderBase(width), width);
  }

  return options.renderFrame(
    {
      editorFrame: editorFrame.slice(1, -1),
      autocompleteLines,
    },
    innerWidth,
  );
}
