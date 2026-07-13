export const BORDER_CHASE = {
  intervalMs: 50,
  cycleMs: 850,
  trailRatio: 0.5,
  heavyRatio: 0.5,
  headRatio: 0.2,
};

export const BORDER_CHASE_FRAME_COUNT = Math.max(
  1,
  Math.round(BORDER_CHASE.cycleMs / BORDER_CHASE.intervalMs),
);

export const EDITOR_LAYOUT = {
  railGap: " ",
  rightRailGap: " ",
  contextMeterWidth: 18,
};

export const FOOTER_LAYOUT = {
  separator: " | ",
  sidePadding: 1,
};

export const EDITOR_CHROME = {
  topCap: "▄",
  bottomCap: "▀",
  horizontal: "─",
  heavyHorizontal: "━",
  railCell: " ",
};

export const ICONS = {
  cwd: "󰝰",
  extensionStatus: "",
  gitBranch: "",
};
