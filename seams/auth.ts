import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  providerAuthKey,
  providerEnvVar,
  providerUsesAccountId,
  type AccountIdProviderKey,
  type ProviderAuthKey,
  type UsageProviderKey,
} from "../core/providers";
import type { AuthJson } from "../core/types";

const AUTH_COMMAND_TIMEOUT_MS = 2000;
const AUTH_COMMAND_MAX_BUFFER = 64 * 1024;
const AUTH_JSON_CACHE_TTL_MS = 2000;

interface CodexCredentials {
  token: string;
  accountId?: string;
}

interface ClaudeKeychainData {
  claudeAiOauth?: {
    accessToken?: string;
  };
}

interface CodexAuthFile {
  OPENAI_API_KEY?: string;
  tokens?: {
    access_token?: string;
    account_id?: string;
  };
}

interface GeminiOAuthFile {
  access_token?: string;
}

let authJsonCache: { loadedAt: number; value: AuthJson } | undefined;

export interface AuthResolver {
  tokenFor(providerKey: UsageProviderKey): string | undefined;
  accountIdFor?(providerKey: UsageProviderKey): string | undefined;
}

function loadAuthJson(): AuthJson {
  const now = Date.now();
  if (authJsonCache && now - authJsonCache.loadedAt < AUTH_JSON_CACHE_TTL_MS) {
    return authJsonCache.value;
  }

  const authPath = join(homedir(), ".pi", "agent", "auth.json");
  let value: AuthJson = {};
  try {
    if (existsSync(authPath)) {
      value = JSON.parse(readFileSync(authPath, "utf-8")) as AuthJson;
    }
  } catch {}

  authJsonCache = { loadedAt: now, value };
  return value;
}

function resolveAuthValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith("!")) {
    try {
      const output = execSync(trimmed.slice(1), {
        encoding: "utf-8",
        maxBuffer: AUTH_COMMAND_MAX_BUFFER,
        stdio: ["pipe", "pipe", "pipe"],
        timeout: AUTH_COMMAND_TIMEOUT_MS,
      }).trim();
      return output || undefined;
    } catch {
      return undefined;
    }
  }

  if (/^[A-Z][A-Z0-9_]*$/.test(trimmed) && process.env[trimmed]) {
    return process.env[trimmed];
  }

  return trimmed;
}

function getApiKey(providerKey: ProviderAuthKey, envVar: string): string | undefined {
  if (process.env[envVar]) return process.env[envVar];

  const auth = loadAuthJson();
  const entry = auth[providerKey];
  if (!entry) return undefined;

  if (typeof entry === "string") {
    return resolveAuthValue(entry);
  }

  return resolveAuthValue(entry.key ?? entry.access ?? entry.refresh);
}

function getClaudeToken(): string | undefined {
  const auth = loadAuthJson();
  const entry = auth[providerAuthKey("claude")];
  if (entry?.access) return entry.access;

  try {
    const keychainData = execSync(
      'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null',
      {
        encoding: "utf-8",
        maxBuffer: AUTH_COMMAND_MAX_BUFFER,
        stdio: ["pipe", "pipe", "pipe"],
        timeout: AUTH_COMMAND_TIMEOUT_MS,
      },
    ).trim();
    if (keychainData) {
      const parsed = JSON.parse(keychainData) as ClaudeKeychainData;
      if (parsed.claudeAiOauth?.accessToken) {
        return parsed.claudeAiOauth.accessToken;
      }
    }
  } catch {}

  return undefined;
}

function getCopilotToken(): string | undefined {
  const auth = loadAuthJson();
  return auth[providerAuthKey("copilot")]?.refresh;
}

function getCodexCredentials(): CodexCredentials | undefined {
  const auth = loadAuthJson();
  const entry = auth[providerAuthKey("codex")];
  if (entry?.access) {
    return {
      token: entry.access,
      accountId: entry.accountId,
    };
  }

  // Fallback: ~/.codex/auth.json
  const codexPath = join(
    process.env.CODEX_HOME || join(homedir(), ".codex"),
    "auth.json",
  );
  try {
    if (existsSync(codexPath)) {
      const data = JSON.parse(
        readFileSync(codexPath, "utf-8"),
      ) as CodexAuthFile;
      if (data.OPENAI_API_KEY) {
        return { token: data.OPENAI_API_KEY };
      }
      if (data.tokens?.access_token) {
        return {
          token: data.tokens.access_token,
          accountId: data.tokens.account_id,
        };
      }
    }
  } catch {}

  return undefined;
}

function getGeminiToken(): string | undefined {
  const auth = loadAuthJson();
  const entry = auth[providerAuthKey("gemini")];
  if (entry?.access) {
    return entry.access;
  }

  // Fallback: ~/.gemini/oauth_creds.json
  const geminiPath = join(homedir(), ".gemini", "oauth_creds.json");
  try {
    if (existsSync(geminiPath)) {
      const data = JSON.parse(
        readFileSync(geminiPath, "utf-8"),
      ) as GeminiOAuthFile;
      return data.access_token;
    }
  } catch {}

  return undefined;
}

type MinimaxProviderKey = Extract<UsageProviderKey, "minimax" | "minimax-cn">;

type TokenResolver = () => string | undefined;

type AccountIdResolver = () => string | undefined;

function getMinimaxToken(provider: MinimaxProviderKey): string | undefined {
  const envVar = providerEnvVar(provider);
  return envVar ? getApiKey(providerAuthKey(provider), envVar) : undefined;
}

function getKimiToken(): string | undefined {
  const envVar = providerEnvVar("kimi-coding");
  return envVar
    ? getApiKey(providerAuthKey("kimi-coding"), envVar)
    : undefined;
}

const TOKEN_RESOLVERS: Record<UsageProviderKey, TokenResolver> = {
  claude: getClaudeToken,
  copilot: getCopilotToken,
  codex: () => getCodexCredentials()?.token,
  gemini: getGeminiToken,
  minimax: () => getMinimaxToken("minimax"),
  "minimax-cn": () => getMinimaxToken("minimax-cn"),
  "kimi-coding": getKimiToken,
};

const ACCOUNT_ID_RESOLVERS: Record<AccountIdProviderKey, AccountIdResolver> = {
  codex: () => getCodexCredentials()?.accountId,
};

export function createAuthResolver(): AuthResolver {
  return {
    tokenFor(providerKey: UsageProviderKey): string | undefined {
      return TOKEN_RESOLVERS[providerKey]();
    },
    accountIdFor(providerKey: UsageProviderKey): string | undefined {
      if (!providerUsesAccountId(providerKey)) return undefined;
      return ACCOUNT_ID_RESOLVERS[providerKey]();
    },
  };
}
