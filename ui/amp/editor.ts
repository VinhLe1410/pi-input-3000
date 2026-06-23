import { CustomEditor } from "@earendil-works/pi-coding-agent";
import type {
  ExtensionContext,
  KeybindingsManager,
  Theme,
} from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";
import { splitRenderedEditor } from "../editor-autocomplete";
import { clampRenderedLines } from "../rendering";
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
    if (width <= 4) return clampRenderedLines(super.render(width), width);

    const innerWidth = this.frameRenderer.contentWidth(width);
    const rendered = super.render(innerWidth);
    const { editorFrame, autocompleteLines } = splitRenderedEditor(
      this,
      rendered,
      innerWidth,
    );

    if (editorFrame.length < 2) return clampRenderedLines(super.render(width), width);

    return this.frameRenderer.render({
      width,
      editorLines: editorFrame.slice(1, -1),
      topRightLabel: renderAmpTopRightLabel(
        this.ctx,
        this.getThinkingLevel(),
        this.labelTheme,
      ),
      bottomRightLabel: renderAmpBottomRightLabel(this.ctx, this.labelTheme),
      autocompleteLines,
    });
  }
}
