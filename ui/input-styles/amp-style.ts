import type {
  ExtensionContext,
  KeybindingsManager,
  Theme,
} from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";
import { AmpInputFrameRenderer } from "../amp/frame";
import { AmpInputEditor } from "../amp/editor";
import {
  renderAmpBottomRightLabel,
  renderAmpTopRightLabel,
} from "../amp/labels";
import { EmptyComponent } from "../empty-component";
import { getThinkingLevel } from "../editor-meta";
import type { InputStyleAdapter, InputStyleRuntime } from "./types";

export const ampStyle: InputStyleAdapter = {
  id: "amp",
  label: "Amp-inspired",
  description: "Minimal chrome: cost, thinking, context %, and cwd only",

  apply(ctx: ExtensionContext, runtime: InputStyleRuntime): void {
    ctx.ui.setHeader(() => new EmptyComponent());
    ctx.ui.setWorkingMessage();
    ctx.ui.setWorkingIndicator();
    ctx.ui.setWorkingVisible(true);

    ctx.ui.setEditorComponent((tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager) => {
      runtime.registerActiveTui(tui);
      return new AmpInputEditor(
        tui,
        theme,
        keybindings,
        ctx,
        () => runtime.getThinkingLevel(ctx),
        ctx.ui.theme,
      );
    });

    ctx.ui.setFooter(() => new EmptyComponent());
  },

  renderPreview(ctx: ExtensionContext, width: number, theme: Theme): string[] {
    const thinkingLevel = getThinkingLevel(ctx);
    return new AmpInputFrameRenderer(theme).render({
      width,
      editorLines: [""],
      topRightLabel: renderAmpTopRightLabel(ctx, thinkingLevel, theme),
      bottomRightLabel: renderAmpBottomRightLabel(ctx, theme),
    });
  },
};
