export const CODEX_PROVIDER_KEY = "openai-codex";

export type CodexQuotaWindowId = "primary" | "secondary";

export interface CodexQuotaWindow {
  id: CodexQuotaWindowId;
  label: string;
  usedPercent: number;
  resetsIn?: string;
}

export interface CodexQuotaCredentials {
  token: string;
  accountId?: string;
}

export type QuotaState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; windows: CodexQuotaWindow[]; fetchedAt: number }
  | {
      kind: "stale";
      windows: CodexQuotaWindow[];
      fetchedAt: number;
      error: string;
    }
  | { kind: "error"; error: string }
  | { kind: "no-auth" };
