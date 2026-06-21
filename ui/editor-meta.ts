import {
  buildSessionContext,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { GitStatusSummary } from "../seams/git";
import type { EditorBranchMeta, EditorContextMeter, EditorMeta } from "./editor-types";

function formatContextWindow(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    const rounded =
      millions < 10 ? millions.toFixed(1).replace(/\.0$/, "") : `${Math.round(millions)}`;
    return `${rounded}M`;
  }

  if (value >= 1_000) {
    const thousands = value / 1_000;
    const rounded =
      thousands < 10 ? thousands.toFixed(1).replace(/\.0$/, "") : `${Math.round(thousands)}`;
    return `${rounded}K`;
  }

  return `${Math.round(value)}`;
}

function buildContextMeter(ctx: ExtensionContext): EditorContextMeter | undefined {
  const usage = ctx.getContextUsage();
  const contextWindow = usage?.contextWindow ?? ctx.model?.contextWindow;
  if (!contextWindow || contextWindow <= 0) return undefined;

  if (usage && (usage.tokens === null || usage.percent === null)) {
    return {
      percent: 0,
      label: `?/${formatContextWindow(contextWindow)}`,
    };
  }

  const tokens = usage?.tokens ?? 0;
  const percent = usage?.percent ?? (tokens / contextWindow) * 100;
  const roundedPercent = Math.max(0, Math.min(999, Math.round(percent)));

  return {
    percent: roundedPercent,
    label: `${roundedPercent}%/${formatContextWindow(contextWindow)}`,
  };
}

export function getThinkingLevel(ctx: ExtensionContext): string {
  if (!ctx.model?.reasoning) return "off";

  const entries = ctx.sessionManager.getEntries();
  const leafId = ctx.sessionManager.getLeafId();
  return buildSessionContext(entries, leafId).thinkingLevel || "off";
}

function buildBranchMeta(git: GitStatusSummary): EditorBranchMeta | undefined {
  if (!git.branch) return undefined;

  return {
    name: git.branch,
    dirty: git.dirty,
    ahead: git.ahead,
    behind: git.behind,
  };
}

export function buildEditorMeta(
  ctx: ExtensionContext,
  git: GitStatusSummary,
  thinkingLevel = getThinkingLevel(ctx),
): EditorMeta {
  const modelLabel = ctx.model?.name ?? ctx.model?.id ?? "no-model";

  return {
    modelLabel,
    thinkingLevel,
    contextMeter: buildContextMeter(ctx),
    branch: buildBranchMeta(git),
  };
}
