import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { roundedDisplayPercent } from "./format";

export function sessionCostTotal(ctx: ExtensionContext): number {
  let total = 0;

  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "message" && entry.message.role === "assistant") {
      total += entry.message.usage.cost.total;
    }
  }

  return total;
}

export function formatSessionCost(cost: number): string {
  const normalized = Number.isFinite(cost) && cost > 0 ? cost : 0;
  if (normalized >= 100) return `$${Math.round(normalized)}`;
  return `$${normalized.toFixed(2)}`;
}

export function contextPercent(ctx: ExtensionContext): number | undefined {
  const usage = ctx.getContextUsage();
  const percent = usage?.percent;
  if (percent === undefined || percent === null || !Number.isFinite(percent)) return undefined;

  return roundedDisplayPercent(percent);
}

export function formatCwd(cwd: string): string {
  const home = process.env.HOME;
  const normalized = cwd.replace(/\\/g, "/").replace(/\/+$/, "");
  if (home) {
    const normalizedHome = home.replace(/\\/g, "/").replace(/\/+$/, "");
    if (normalized === normalizedHome) return "~";
    if (normalized.startsWith(`${normalizedHome}/`)) {
      return `~${normalized.slice(normalizedHome.length)}`;
    }
  }

  return normalized || cwd;
}
