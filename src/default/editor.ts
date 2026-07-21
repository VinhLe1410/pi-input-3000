import { CustomEditor } from "@earendil-works/pi-coding-agent";
import type { KeybindingsManager, Theme } from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";
import { defaultEditorBorderColor } from "../shared/editor-appearance";

/** Pi's standard editor appearance without reusing Pi's persistent editor instance. */
export class DefaultInputEditor extends CustomEditor {
  constructor(
    tui: TUI,
    theme: EditorTheme,
    keybindings: KeybindingsManager,
    private readonly getThinkingLevel: () => string,
    private readonly appearanceTheme: Theme,
  ) {
    super(tui, theme, keybindings);
  }

  render(width: number): string[] {
    // Pi copies appearance from its cached editor after the factory returns. Reasserting
    // the current state here prevents that cached value from surviving a style switch.
    this.borderColor = defaultEditorBorderColor(
      this.getText(),
      this.getThinkingLevel(),
      this.appearanceTheme,
    );
    return super.render(width);
  }
}
