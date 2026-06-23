import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import type { InputStyle } from "../core/input-style-config";
import { AmpInputFrameRenderer } from "./amp/frame";
import {
  renderAmpBottomRightLabel,
  renderAmpTopRightLabel,
} from "./amp/labels";
import { renderEditorMetadata } from "./editor-badges";
import { buildEditorPreviewMeta, getThinkingLevel } from "./editor-meta";
import { PolishedInputFrameRenderer } from "./polished-frame";

function renderDefaultStylePreview(
  ctx: ExtensionContext,
  width: number,
  theme: Theme,
  thinkingLevel: string,
): string[] {
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
}

function renderAmpStylePreview(
  ctx: ExtensionContext,
  width: number,
  theme: Theme,
  thinkingLevel: string,
): string[] {
  return new AmpInputFrameRenderer(theme).render({
    width,
    editorLines: [""],
    topRightLabel: renderAmpTopRightLabel(ctx, thinkingLevel, theme),
    bottomRightLabel: renderAmpBottomRightLabel(ctx, theme),
  });
}

export function renderInputStylePreview(
  ctx: ExtensionContext,
  style: InputStyle,
  width: number,
  theme: Theme,
): string[] {
  const thinkingLevel = getThinkingLevel(ctx);
  const title = theme.fg("dim", "Preview");
  const previewWidth = Math.max(0, width);
  const bodyWidth = Math.min(previewWidth, 92);
  const leftPad = Math.max(0, Math.floor((previewWidth - bodyWidth) / 2));
  const pad = " ".repeat(leftPad);
  const body = style === "amp"
    ? renderAmpStylePreview(ctx, bodyWidth, theme, thinkingLevel)
    : renderDefaultStylePreview(ctx, bodyWidth, theme, thinkingLevel);

  return [
    title,
    ...body.map((line) => `${pad}${truncateToWidth(line, bodyWidth, "")}`),
  ];
}
