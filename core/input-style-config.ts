import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

export type InputStyle = "default" | "amp";

export const INPUT_STYLES: readonly InputStyle[] = ["default", "amp"];

export interface InputStyleConfig {
  style: InputStyle;
}

type UnknownRecord = Record<string, unknown>;

const CONFIG_FILE_NAME = "pi-input-3000.json";
const DEFAULT_CONFIG: InputStyleConfig = { style: "default" };

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

export function isInputStyle(value: string): value is InputStyle {
  return INPUT_STYLES.some((style) => style === value);
}

export function getInputStyleConfigPath(): string {
  return join(getAgentDir(), CONFIG_FILE_NAME);
}

export function loadInputStyleConfig(): InputStyleConfig {
  try {
    const parsed: unknown = JSON.parse(readFileSync(getInputStyleConfigPath(), "utf-8"));
    if (!isRecord(parsed)) return DEFAULT_CONFIG;

    const style = parsed.style;
    return typeof style === "string" && isInputStyle(style)
      ? { style }
      : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveInputStyleConfig(config: InputStyleConfig): void {
  const agentDir = getAgentDir();
  mkdirSync(agentDir, { recursive: true });
  writeFileSync(
    getInputStyleConfigPath(),
    `${JSON.stringify({ style: config.style }, null, 2)}\n`,
    "utf-8",
  );
}
