import { CustomEditor } from "@earendil-works/pi-coding-agent";
import type { KeybindingsManager, Theme } from "@earendil-works/pi-coding-agent";
import { type EditorTheme, type TUI } from "@earendil-works/pi-tui";
import { BORDER_CHASE_FRAME_COUNT } from "./design-tokens";
import { splitRenderedEditor } from "./editor-autocomplete";
import { renderEditorMetadata } from "./editor-badges";
import type { EditorChrome } from "./editor-types";
import { PolishedInputFrameRenderer } from "./polished-frame";
import { clampRenderedLines } from "./rendering";

export type {
  EditorBranchMeta,
  EditorChrome,
  EditorContextMeter,
  EditorMeta,
} from "./editor-types";

export class PolishedInputEditor extends CustomEditor {
  private getChrome: () => EditorChrome;
  private labelTheme: Theme;
  private frameRenderer: PolishedInputFrameRenderer;

  constructor(
    tui: TUI,
    theme: EditorTheme,
    keybindings: KeybindingsManager,
    getChrome: () => EditorChrome,
    labelTheme: Theme,
  ) {
    super(tui, theme, keybindings, { paddingX: 0 });
    const borderColor = (text: string) => labelTheme.fg("border", text);
    this.borderColor = borderColor;
    this.getChrome = getChrome;
    this.labelTheme = labelTheme;
    this.frameRenderer = new PolishedInputFrameRenderer(labelTheme, borderColor);
  }

  override invalidate(): void {
    super.invalidate();
    this.frameRenderer.invalidate();
  }

  render(width: number): string[] {
    if (width <= 2) return clampRenderedLines(super.render(width), width);

    const chrome = this.getChrome();
    const innerWidth = this.frameRenderer.contentWidth(width);
    const rendered = super.render(innerWidth);

    if (rendered.length < 2) {
      return clampRenderedLines(super.render(width), width);
    }

    const { editorFrame, autocompleteLines } = splitRenderedEditor(
      this,
      rendered,
      innerWidth,
    );
    if (editorFrame.length < 2) return clampRenderedLines(rendered, width);

    return this.frameRenderer.render({
      width,
      editorLines: editorFrame.slice(1, -1),
      metadata: renderEditorMetadata(chrome.meta, innerWidth, this.labelTheme),
      thinkingLevel: chrome.meta.thinkingLevel,
      autocompleteLines,
      chaseFrameIndex: chrome.chaseFrameIndex,
      chaseFrameCount: chrome.chaseFrameCount ?? BORDER_CHASE_FRAME_COUNT,
      workingMessage: chrome.workingMessage,
    });
  }
}
