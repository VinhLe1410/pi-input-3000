import { CustomEditor } from "@earendil-works/pi-coding-agent";
import type { KeybindingsManager, Theme } from "@earendil-works/pi-coding-agent";
import { type EditorTheme, type TUI } from "@earendil-works/pi-tui";
import { renderFramedEditor } from "../../shared/framed-editor";
import { BORDER_CHASE_FRAME_COUNT } from "../constants";
import { renderEditorMetadata } from "../editor-metadata/render-badges";
import type { DefaultEditorChrome } from "../editor-metadata/types";
import { PolishedInputFrameRenderer } from "./frame-renderer";

export type {
  DefaultEditorBranchMeta,
  DefaultEditorChrome,
  DefaultEditorMeta,
  EditorContextMeter,
} from "../editor-metadata/types";

export class PolishedInputEditor extends CustomEditor {
  private getChrome: () => DefaultEditorChrome;
  private labelTheme: Theme;
  private frameRenderer: PolishedInputFrameRenderer;

  constructor(
    tui: TUI,
    theme: EditorTheme,
    keybindings: KeybindingsManager,
    getChrome: () => DefaultEditorChrome,
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
    return renderFramedEditor({
      editor: this,
      width,
      minWidth: 2,
      contentWidth: (frameWidth) => this.frameRenderer.contentWidth(frameWidth),
      renderBase: (renderWidth) => super.render(renderWidth),
      renderFrame: ({ editorFrame, autocompleteLines }, innerWidth) => {
        const chrome = this.getChrome();

        return this.frameRenderer.render({
          width,
          editorLines: editorFrame,
          metadata: renderEditorMetadata(chrome.meta, innerWidth, this.labelTheme),
          thinkingLevel: chrome.meta.thinkingLevel,
          autocompleteLines,
          chaseFrameIndex: chrome.chaseFrameIndex,
          chaseFrameCount: chrome.chaseFrameCount ?? BORDER_CHASE_FRAME_COUNT,
          workingMessage: chrome.workingMessage,
        });
      },
    });
  }
}
