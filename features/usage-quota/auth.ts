import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { CODEX_PROVIDER_KEY, type CodexQuotaCredentials } from "./types";

type UnknownRecord = Record<string, unknown>;

interface CodexAuthFile {
  OPENAI_API_KEY?: string;
  tokens?: {
    access_token?: string;
    account_id?: string;
  };
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function stringField(record: UnknownRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function accountIdFromPiAuth(ctx: ExtensionContext): string | undefined {
  const credential = ctx.modelRegistry.authStorage.get(CODEX_PROVIDER_KEY);
  if (!isRecord(credential)) return undefined;

  return stringField(credential, "accountId") ?? stringField(credential, "account_id");
}

async function readCodexAuthFile(): Promise<CodexQuotaCredentials | undefined> {
  const codexPath = join(
    process.env.CODEX_HOME || join(homedir(), ".codex"),
    "auth.json",
  );

  try {
    const data = JSON.parse(await readFile(codexPath, "utf-8")) as CodexAuthFile;
    if (data.OPENAI_API_KEY) return { token: data.OPENAI_API_KEY };
    if (data.tokens?.access_token) {
      return {
        token: data.tokens.access_token,
        accountId: data.tokens.account_id,
      };
    }
  } catch {}

  return undefined;
}

export async function resolveCodexCredentials(
  ctx: ExtensionContext,
): Promise<CodexQuotaCredentials | undefined> {
  const accountId = accountIdFromPiAuth(ctx);
  const token = await ctx.modelRegistry
    .getApiKeyForProvider(CODEX_PROVIDER_KEY)
    .catch(() => undefined);

  if (token) {
    if (accountId) return { token, accountId };

    const fallback = await readCodexAuthFile();
    return { token, accountId: fallback?.accountId };
  }

  const fallback = await readCodexAuthFile();
  if (!fallback) return undefined;

  return {
    ...fallback,
    accountId: fallback.accountId ?? accountId,
  };
}
