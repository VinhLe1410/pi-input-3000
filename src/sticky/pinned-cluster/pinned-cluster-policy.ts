import type { Component } from "@earendil-works/pi-tui";
import type { TerminalSplitCompositor } from "../terminal-split/compositor";
import { renderFixedEditorCluster, type FixedEditorClusterRender } from "./fixed-editor-cluster";
import type { StickySlots } from "./sticky-slots";

export interface PinnedClusterPolicy {
  includeStatus: boolean;
}

export const DEFAULT_PINNED_CLUSTER_POLICY: PinnedClusterPolicy = {
  includeStatus: true,
};

interface RenderPinnedClusterInput {
  compositor: TerminalSplitCompositor;
  slots: StickySlots;
  width: number;
  terminalRows: number;
  policy?: PinnedClusterPolicy;
}

function renderSlot(
  compositor: TerminalSplitCompositor,
  slot: Component | null,
  width: number,
): string[] {
  return slot ? compositor.renderHidden(slot, width) : [];
}

export function hidePinnedSlots(
  compositor: TerminalSplitCompositor,
  slots: StickySlots,
  policy: PinnedClusterPolicy = DEFAULT_PINNED_CLUSTER_POLICY,
): void {
  if (policy.includeStatus && slots.status) compositor.hideRenderable(slots.status);
  if (slots.widgetAbove) compositor.hideRenderable(slots.widgetAbove);
  compositor.hideRenderable(slots.editor);
  if (slots.widgetBelow) compositor.hideRenderable(slots.widgetBelow);
  if (slots.footer) compositor.hideRenderable(slots.footer);
}

export function renderPinnedCluster(input: RenderPinnedClusterInput): FixedEditorClusterRender {
  const policy = input.policy ?? DEFAULT_PINNED_CLUSTER_POLICY;

  return renderFixedEditorCluster({
    width: input.width,
    terminalRows: input.terminalRows,
    statusLines: policy.includeStatus
      ? renderSlot(input.compositor, input.slots.status, input.width)
      : [],
    topLines: renderSlot(input.compositor, input.slots.widgetAbove, input.width),
    editorLines: input.compositor.renderHidden(input.slots.editor, input.width),
    secondaryLines: renderSlot(input.compositor, input.slots.widgetBelow, input.width),
    transcriptLines: renderSlot(input.compositor, input.slots.footer, input.width),
  });
}
