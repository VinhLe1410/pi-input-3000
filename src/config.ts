import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { INPUT_STYLE_CONFIG_FILE_NAME } from "./constants";
import { isInputStyle, type InputStyleConfig } from "./input-styles";
import { isRecord } from "./shared/unknown-record";

const DEFAULT_CONFIG: InputStyleConfig = {
  style: "default",
  stickyInput: true,
};

export function getInputStyleConfigPath(): string {
  return join(getAgentDir(), INPUT_STYLE_CONFIG_FILE_NAME);
}

export function loadInputStyleConfig(): InputStyleConfig {
  try {
    const parsed: unknown = JSON.parse(readFileSync(getInputStyleConfigPath(), "utf-8"));
    if (!isRecord(parsed)) return DEFAULT_CONFIG;

    const style = parsed.style;
    return {
      style: typeof style === "string" && isInputStyle(style)
        ? style
        : DEFAULT_CONFIG.style,
      stickyInput: typeof parsed.stickyInput === "boolean"
        ? parsed.stickyInput
        : DEFAULT_CONFIG.stickyInput,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveInputStyleConfig(config: InputStyleConfig): void {
  const agentDir = getAgentDir();
  mkdirSync(agentDir, { recursive: true });
  writeFileSync(
    getInputStyleConfigPath(),
    `${JSON.stringify({ style: config.style, stickyInput: config.stickyInput }, null, 2)}\n`,
    "utf-8",
  );
}
