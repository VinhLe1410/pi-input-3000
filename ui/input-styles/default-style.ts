import type {
  ExtensionContext,
  ReadonlyFooterDataProvider,
  Theme,
} from "@earendil-works/pi-coding-agent";
import type { KeybindingsManager } from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";
import { BORDER_CHASE_FRAME_COUNT } from "../design-tokens";
import { renderEditorMetadata } from "../editor-badges";
import { buildEditorMeta, buildEditorPreviewMeta, getThinkingLevel } from "../editor-meta";
import { PolishedInputEditor } from "../editor";
import { PolishedInputFrameRenderer } from "../polished-frame";
import { renderStatusFooter } from "../status-footer";
import type { InputStyleAdapter, InputStyleRuntime } from "./types";

export const defaultStyle: InputStyleAdapter = {
  id: "default",
  label: "Default",
  description: "Current pi-input-3000 chrome with badges, footer, and border chase",
  capabilities: {
    projectRefresh: true,
    featureLifecycle: true,
    borderChase: true,
  },

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
          meta: buildEditorMeta(
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
          return renderStatusFooter(ctx, footerData, width, theme, {
            rightSegments: runtime.footerRightSegments(theme),
          });
        },
      };
    });
  },

  renderPreview(ctx: ExtensionContext, width: number, theme: Theme): string[] {
    const thinkingLevel = getThinkingLevel(ctx);
    const renderer = new PolishedInputFrameRenderer(theme);
    const innerWidth = renderer.contentWidth(width);
    const meta = buildEditorPreviewMeta(ctx, thinkingLevel);

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
