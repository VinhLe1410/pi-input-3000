import type {
  ExtensionContext,
  ReadonlyFooterDataProvider,
  Theme,
} from "@earendil-works/pi-coding-agent";
import type { KeybindingsManager } from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";
import type { InputStyleAdapter, InputStyleRuntime } from "../input-styles";
import { getThinkingLevel } from "../shared/editor-meta";
import { pickWorkingMessage } from "./agent-working-message/messages";
import { BORDER_CHASE_FRAME_COUNT } from "./constants";
import { buildDefaultEditorMeta, buildDefaultEditorPreviewMeta } from "./editor-metadata/build-metadata";
import { renderEditorMetadata } from "./editor-metadata/render-badges";
import { PolishedInputEditor } from "./framed-input/editor";
import { PolishedInputFrameRenderer } from "./framed-input/frame-renderer";
import { renderStatusFooter } from "./status-footer/render-footer";

export const input3000Style: InputStyleAdapter = {
  id: "input-3000",
  label: "Input 3000",
  description: "Polished chrome with badges, footer, and border chase",
  capabilities: {
    projectRefresh: true,
    borderChase: true,
  },
  createWorkingMessage: pickWorkingMessage,

  apply(ctx: ExtensionContext, runtime: InputStyleRuntime): void {
    ctx.ui.setHeader(undefined);
    ctx.ui.setWorkingMessage();
    ctx.ui.setWorkingIndicator();
    ctx.ui.setWorkingVisible(false);

    ctx.ui.setEditorComponent((tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager) => {
      runtime.registerActiveTui(tui);

      return new PolishedInputEditor(
        tui,
        theme,
        keybindings,
        () => ({
          meta: buildDefaultEditorMeta(
            ctx,
            runtime.currentGit(),
            runtime.getThinkingLevel(ctx),
          ),
          chaseFrameIndex: runtime.isBorderChaseActive()
            ? runtime.getBorderChaseFrameIndex()
            : undefined,
          chaseFrameCount: BORDER_CHASE_FRAME_COUNT,
          workingMessage: runtime.getWorkingMessage(),
        }),
        ctx.ui.theme,
      );
    });

    ctx.ui.setFooter((tui: TUI, theme: Theme, footerData: ReadonlyFooterDataProvider) => {
      runtime.registerFooterRender(() => tui.requestRender());

      return {
        dispose() {
          runtime.registerFooterRender(undefined);
        },
        invalidate() {},
        render(width: number): string[] {
          return renderStatusFooter(ctx, footerData, width, theme);
        },
      };
    });
  },

  renderPreview(ctx: ExtensionContext, width: number, theme: Theme): string[] {
    const thinkingLevel = getThinkingLevel(ctx);
    const renderer = new PolishedInputFrameRenderer(theme);
    const innerWidth = renderer.contentWidth(width);
    const meta = buildDefaultEditorPreviewMeta(ctx, thinkingLevel);

    return renderer.render({
      width,
      editorLines: [
        theme.fg("dim", "current design keeps the full status footer and animated border"),
      ],
      metadata: renderEditorMetadata(meta, innerWidth, theme),
      thinkingLevel,
    });
  },
};
