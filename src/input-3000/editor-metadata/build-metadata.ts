import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ProjectBranchStatus } from "../../input-styles";
import { buildSharedEditorMeta, getThinkingLevel } from "../../shared/editor-meta";
import type { DefaultEditorBranchMeta, DefaultEditorMeta } from "./types";

function buildBranchMeta(git: ProjectBranchStatus): DefaultEditorBranchMeta | undefined {
  if (!git.branch) return undefined;

  return {
    name: git.branch,
    dirty: git.dirty,
    ahead: git.ahead,
    behind: git.behind,
  };
}

export function buildDefaultEditorMeta(
  ctx: ExtensionContext,
  git: ProjectBranchStatus,
  thinkingLevel = getThinkingLevel(ctx),
): DefaultEditorMeta {
  return {
    ...buildSharedEditorMeta(ctx, thinkingLevel),
    branch: buildBranchMeta(git),
  };
}

export function buildDefaultEditorPreviewMeta(
  ctx: ExtensionContext,
  thinkingLevel = getThinkingLevel(ctx),
): DefaultEditorMeta {
  return buildSharedEditorMeta(ctx, thinkingLevel);
}
