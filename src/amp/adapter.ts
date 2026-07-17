import type {
  ExtensionContext,
  KeybindingsManager,
  Theme,
} from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";
import type { InputStyleAdapter, InputStyleRuntime } from "../input-styles";
import { EmptyComponent } from "../shared/empty-component";
import { getThinkingLevel } from "../shared/editor-meta";
import { AmpInputEditor } from "./editor";
import { AmpInputFrameRenderer } from "./frame";
import {
  renderAmpBottomRightLabel,
  renderAmpTopRightLabel,
} from "./labels";

export const ampStyle: InputStyleAdapter = {
  id: "amp",
  label: "Amp-inspired",
  description: "Minimal chrome with timer, Git, cost, model, thinking, context use, and cwd",

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
        () => runtime.getAgentTimer(),
        () => runtime.currentGit(),
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
