import { CustomEditor } from "@earendil-works/pi-coding-agent";
import type {
  ExtensionContext,
  KeybindingsManager,
  Theme,
} from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";
import { renderFramedEditor } from "../framed-editor";
import { AmpInputFrameRenderer } from "./frame";
import {
  renderAmpBottomRightLabel,
  renderAmpTopRightLabel,
} from "./labels";

export class AmpInputEditor extends CustomEditor {
  private getThinkingLevel: () => string;
  private labelTheme: Theme;
  private ctx: ExtensionContext;
  private frameRenderer: AmpInputFrameRenderer;

  constructor(
    tui: TUI,
    theme: EditorTheme,
    keybindings: KeybindingsManager,
    ctx: ExtensionContext,
    getThinkingLevel: () => string,
    labelTheme: Theme,
  ) {
    super(tui, theme, keybindings, { paddingX: 0 });
    this.ctx = ctx;
    this.getThinkingLevel = getThinkingLevel;
    this.labelTheme = labelTheme;
    this.frameRenderer = new AmpInputFrameRenderer(labelTheme);
  }

  render(width: number): string[] {
    return renderFramedEditor({
      editor: this,
      width,
      minWidth: 4,
      contentWidth: (frameWidth) => this.frameRenderer.contentWidth(frameWidth),
      renderBase: (renderWidth) => super.render(renderWidth),
      renderFrame: ({ editorFrame, autocompleteLines }) => this.frameRenderer.render({
        width,
        editorLines: editorFrame,
        topRightLabel: renderAmpTopRightLabel(
          this.ctx,
          this.getThinkingLevel(),
          this.labelTheme,
        ),
        bottomRightLabel: renderAmpBottomRightLabel(this.ctx, this.labelTheme),
        autocompleteLines,
      }),
    });
  }
}
