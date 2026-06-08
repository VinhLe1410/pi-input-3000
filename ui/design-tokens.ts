export const BORDER_CHASE = {
  intervalMs: 50,
  cycleMs: 850,
  trailRatio: 0.5,
  heavyRatio: 0.5,
  headRatio: 0.2,
} as const;

export const BORDER_CHASE_FRAME_COUNT = Math.max(
  1,
  Math.round(BORDER_CHASE.cycleMs / BORDER_CHASE.intervalMs),
);

export const EDITOR_LAYOUT = {
  railGap: " ",
  rightRailGap: " ",
  contextMeterWidth: 18,
} as const;

export const FOOTER_LAYOUT = {
  separator: " | ",
  sidePadding: 1,
} as const;

export const ICONS = {
  reset: "",
} as const;

export const USAGE_PERCENT_THRESHOLDS = {
  warning: 60,
  error: 85,
} as const;

export const CONTEXT_PERCENT_THRESHOLDS = {
  warning: 40,
  error: 60,
} as const;
