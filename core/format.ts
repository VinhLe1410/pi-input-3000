export function formatResetTime(date: Date): string {
  const diffMs = date.getTime() - Date.now();
  if (diffMs < 0) return "now";

  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m`;

  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  if (hours < 24) return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d${remainingHours}h` : `${days}d`;
}

/** Clamp a percentage to [0, 100]. Does NOT auto-normalize 0-1 fractions. */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/** Normalize a value that might be 0-1 fraction OR 0-100 percent, then clamp. */
export function normalizePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const normalized = value <= 1 && value >= 0 ? value * 100 : value;
  return clampPercent(normalized);
}

export function roundedDisplayPercent(value: number, max = 999): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, Math.round(value)));
}

export function getWindowLabel(
  durationMs: number | undefined,
  fallback: string,
): string {
  if (!durationMs || !Number.isFinite(durationMs) || durationMs <= 0) {
    return fallback;
  }

  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;
  const weekMs = 7 * dayMs;

  // Keep standard labels when rolling windows are approximately equivalent.
  const isCloseToWeek = Math.abs(durationMs - weekMs) <= hourMs * 2;
  const isCloseToDay = Math.abs(durationMs - dayMs) <= hourMs * 2;
  const isCloseTo5h = Math.abs(durationMs - 5 * hourMs) <= hourMs * 2;

  if (isCloseToWeek || fallback === "Week") return "Week";
  if (isCloseToDay || fallback === "Day") return "Day";
  if (isCloseTo5h || fallback === "5h") return fallback;

  const hours = Math.round(durationMs / hourMs);
  if (hours >= 1 && hours < 48) return `${hours}h`;

  const days = Math.round(durationMs / dayMs);
  if (days >= 1) return `${days}d`;

  const mins = Math.max(1, Math.round(durationMs / 60000));
  return `${mins}m`;
}
