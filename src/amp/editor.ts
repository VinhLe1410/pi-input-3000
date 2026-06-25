import { CustomEditor } from "@earendil-works/pi-coding-agent";
import type {
  ExtensionContext,
  KeybindingsManager,
  Theme,
} from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";
import { renderFramedEditor } from "../shared/framed-editor";
import { AmpInputFrameRenderer } from "./frame";
import {
  ampBorderColor,
  detectBashMode,
  renderAmpBottomRightLabel,
  renderAmpTopLeftLabel,
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
    const bashMode = detectBashMode(this.getText());
    this.borderColor = ampBorderColor(bashMode, this.labelTheme);
    return renderFramedEditor({
      editor: this,
      width,
      minWidth: 4,
      contentWidth: (frameWidth) => this.frameRenderer.contentWidth(frameWidth),
      renderBase: (renderWidth) => super.render(renderWidth),
      renderFrame: ({ editorFrame, autocompleteLines }) => this.frameRenderer.render({
        width,
        editorLines: editorFrame,
        topLeftLabel: renderAmpTopLeftLabel(bashMode, this.labelTheme),
        topRightLabel: renderAmpTopRightLabel(
          this.ctx,
          this.getThinkingLevel(),
          this.labelTheme,
        ),
        bottomRightLabel: renderAmpBottomRightLabel(this.ctx, this.labelTheme),
        borderColor: this.borderColor,
        autocompleteLines,
      }),
    });
  }
}
