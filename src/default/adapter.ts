import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { InputStyleAdapter, InputStyleRuntime } from "../input-styles";

function restoreDefaultPromptUi(ctx: ExtensionContext): void {
  ctx.ui.setHeader(undefined);
  ctx.ui.setFooter(undefined);
  ctx.ui.setEditorComponent(undefined);
  ctx.ui.setWorkingMessage();
  ctx.ui.setWorkingIndicator();
  ctx.ui.setWorkingVisible(true);
}
export const defaultStyle: InputStyleAdapter = {
  id: "default",
  label: "Default",
  description: "Pi's built-in input with no custom styling",

  apply(ctx: ExtensionContext, runtime: InputStyleRuntime): void {
    runtime.registerActiveTui(undefined);
    restoreDefaultPromptUi(ctx);
  },
};
