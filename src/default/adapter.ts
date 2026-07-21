import type {
  ExtensionContext,
  KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";
import type { InputStyleAdapter, InputStyleRuntime } from "../input-styles";
import { DefaultInputEditor } from "./editor";

function restoreDefaultPromptUi(ctx: ExtensionContext, runtime: InputStyleRuntime): void {
  ctx.ui.setHeader(undefined);
  ctx.ui.setFooter(undefined);
  ctx.ui.setEditorComponent((tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager) => {
    const editor = new DefaultInputEditor(
      tui,
      theme,
      keybindings,
      () => runtime.getThinkingLevel(ctx),
      ctx.ui.theme,
    );
    runtime.registerActiveEditor(tui, editor);
    return editor;
  });
  ctx.ui.setWorkingMessage();
  ctx.ui.setWorkingIndicator();
  ctx.ui.setWorkingVisible(true);
}

export const defaultStyle: InputStyleAdapter = {
  id: "default",
  label: "Default",
  description: "Pi's standard input appearance",

  apply(ctx: ExtensionContext, runtime: InputStyleRuntime): void {
    restoreDefaultPromptUi(ctx, runtime);
  },
};
