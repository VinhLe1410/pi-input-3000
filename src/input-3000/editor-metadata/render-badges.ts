import type { Theme } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import { contextColor, thinkingColor } from "../../shared/theme";
import { EDITOR_CHROME, EDITOR_LAYOUT, ICONS } from "../constants";
import type { DefaultEditorBranchMeta, DefaultEditorMeta, EditorContextMeter } from "./types";

interface MetadataVariant {
  text: string;
  score: number;
}

interface MetadataCandidate {
  text: string;
  score: number;
  width: number;
}

const METADATA_SCORE = {
  model: 500,
  effort: 60,
  branch: 45,
  contextFull: 30,
  contextMedium: 22,
  contextCompact: 14,
  contextText: 8,
  contextLabel: 4,
  hidden: 0,
};

export function renderEditorMetadata(
  meta: DefaultEditorMeta,
  width: number,
  theme: Theme,
): string {
  if (width <= 0) return "";

  const identities = renderIdentityVariants(meta, theme);
  if (!meta.contextMeter) return pickBestFittingVariant(identities, width)?.text ?? "";

  const contexts = renderContextVariants(meta.contextMeter, theme);
  let best: MetadataCandidate | undefined;

  for (const identity of identities) {
    for (const context of contexts) {
      const text = composeMetadataRow(identity.text, context.text, width);
      if (!text) continue;

      const candidate = {
        text,
        score: identity.score + context.score,
        width: visibleWidth(text),
      };
      if (isBetterCandidate(candidate, best)) best = candidate;
    }
  }

  return best?.text ?? pickBestFittingVariant(contexts, width)?.text ?? "";
}

function composeMetadataRow(
  left: string,
  right: string,
  width: number,
): string | undefined {
  const leftWidth = visibleWidth(left);
  const rightWidth = visibleWidth(right);

  if (!left) return rightWidth <= width ? right : undefined;
  if (!right) return leftWidth <= width ? left : undefined;
  if (leftWidth + rightWidth + 1 > width) return undefined;

  return `${left}${" ".repeat(width - leftWidth - rightWidth)}${right}`;
}

function isBetterCandidate(
  candidate: MetadataCandidate,
  current: MetadataCandidate | undefined,
): boolean {
  if (!current) return true;
  if (candidate.score !== current.score) return candidate.score > current.score;
  return candidate.width > current.width;
}

function pickBestFittingVariant(
  variants: readonly MetadataVariant[],
  width: number,
): MetadataVariant | undefined {
  let best: MetadataVariant | undefined;
  for (const variant of variants) {
    const variantWidth = visibleWidth(variant.text);
    if (variantWidth > width) continue;
    if (!best || variant.score > best.score) best = variant;
  }
  return best;
}

function dedupeVariants(variants: readonly MetadataVariant[]): MetadataVariant[] {
  const byText = new Map<string, MetadataVariant>();
  for (const variant of variants) {
    const existing = byText.get(variant.text);
    if (!existing || variant.score > existing.score) byText.set(variant.text, variant);
  }

  return Array.from(byText.values()).sort((a, b) => b.score - a.score);
}

function renderIdentityVariants(meta: DefaultEditorMeta, theme: Theme): MetadataVariant[] {
  const model = renderModelBadge(meta.modelLabel, theme);
  const effortVariants = renderEffortVariants(meta.thinkingLevel, theme);
  const branchVariants = renderBranchVariants(meta.branch, theme);
  const variants: MetadataVariant[] = [{ text: "", score: METADATA_SCORE.hidden }];

  for (const effort of effortVariants) {
    for (const branch of branchVariants) {
      variants.push({
        text: `${model}${effort.text}${branch.text ? `  ${branch.text}` : ""}`,
        score: METADATA_SCORE.model + effort.score + branch.score,
      });
    }
  }

  return dedupeVariants(variants);
}

function renderModelBadge(modelLabel: string, theme: Theme): string {
  return theme.bg(
    "toolPendingBg",
    theme.bold(theme.fg("text", ` ${modelLabel} `)),
  );
}

function renderEffortVariants(thinkingLevel: string, theme: Theme): MetadataVariant[] {
  if (!thinkingLevel || thinkingLevel === "off") {
    return [{ text: "", score: METADATA_SCORE.hidden }];
  }

  return [
    {
      text: theme.inverse(
        theme.bold(
          theme.fg(thinkingColor(thinkingLevel), ` ${thinkingLevel.toUpperCase()} `),
        ),
      ),
      score: METADATA_SCORE.effort,
    },
    { text: "", score: METADATA_SCORE.hidden },
  ];
}

function renderBranchVariants(
  branch: DefaultEditorBranchMeta | undefined,
  theme: Theme,
): MetadataVariant[] {
  if (!branch) return [{ text: "", score: METADATA_SCORE.hidden }];

  return [
    { text: renderBranchBadge(branch, theme), score: METADATA_SCORE.branch },
    { text: "", score: METADATA_SCORE.hidden },
  ];
}

function renderBranchBadge(branch: DefaultEditorBranchMeta, theme: Theme): string {
  const color = branch.dirty ? "warning" : "success";
  const ahead = branch.ahead > 0 ? theme.fg("success", ` ↑${branch.ahead}`) : "";
  const behind = branch.behind > 0 ? theme.fg("error", ` ↓${branch.behind}`) : "";
  const dirty = branch.dirty ? theme.fg("warning", " *") : "";

  return [
    theme.fg(color, `${ICONS.gitBranch} `),
    theme.bold(theme.fg(color, branch.name)),
    dirty,
    ahead,
    behind,
  ].join("");
}

function renderContextVariants(meter: EditorContextMeter, theme: Theme): MetadataVariant[] {
  return dedupeVariants([
    {
      text: renderContextMeter(meter, theme, EDITOR_LAYOUT.contextMeterWidth),
      score: METADATA_SCORE.contextFull,
    },
    { text: renderContextMeter(meter, theme, 12), score: METADATA_SCORE.contextMedium },
    { text: renderContextMeter(meter, theme, 6), score: METADATA_SCORE.contextCompact },
    { text: renderContextMeter(meter, theme, 0), score: METADATA_SCORE.contextText },
    { text: renderContextLabel(meter, theme), score: METADATA_SCORE.contextLabel },
  ]);
}

function renderContextMeter(
  meter: EditorContextMeter,
  theme: Theme,
  barWidth: number,
): string {
  return [
    theme.fg("muted", "CTX"),
    barWidth > 0
      ? `${theme.fg("borderMuted", " ")}${renderContextBar(meter, theme, barWidth)}`
      : "",
    theme.fg("borderMuted", " "),
    renderContextLabel(meter, theme),
  ].join("");
}

function renderContextLabel(meter: EditorContextMeter, theme: Theme): string {
  return theme.bold(theme.fg("text", meter.label));
}

function renderContextBar(
  meter: EditorContextMeter,
  theme: Theme,
  barWidth: number,
): string {
  const clampedPercent = Math.max(0, Math.min(100, meter.percent));
  const filledCells = Math.round((barWidth * clampedPercent) / 100);
  const color = contextColor(meter.percent);

  return Array.from({ length: barWidth }, (_, index) => {
    const isFilled = index < filledCells;
    return theme.fg(
      isFilled ? color : "borderMuted",
      isFilled ? EDITOR_CHROME.heavyHorizontal : EDITOR_CHROME.horizontal,
    );
  }).join("");
}
