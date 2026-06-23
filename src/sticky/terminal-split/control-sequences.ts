export type ExtendedKeyboardMode = "kitty" | "modifyOtherKeys";

export function stripOscSequences(line: string): string {
  return line.replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "");
}

export function stripAnsi(line: string): string {
  return stripOscSequences(line).replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

export function beginSynchronizedOutput(): string {
  return "\x1b[?2026h";
}

export function endSynchronizedOutput(): string {
  return "\x1b[?2026l";
}

export function setScrollRegion(top: number, bottom: number): string {
  return `\x1b[${top};${bottom}r`;
}

export function resetScrollRegion(): string {
  return "\x1b[r";
}

export function moveCursor(row: number, col: number): string {
  return `\x1b[${row};${col}H`;
}

export function clearLine(): string {
  return "\x1b[2K";
}

export function hideCursor(): string {
  return "\x1b[?25l";
}

export function showCursor(): string {
  return "\x1b[?25h";
}

export function enterAlternateScreen(): string {
  return "\x1b[?1049h";
}

export function exitAlternateScreen(): string {
  return "\x1b[?1049l";
}

export function enableAlternateScrollMode(): string {
  return "\x1b[?1007h";
}

export function disableAlternateScrollMode(): string {
  return "\x1b[?1007l";
}

export function enableMouseReporting(): string {
  return "\x1b[?1002h\x1b[?1006h";
}

export function disableMouseReporting(): string {
  return "\x1b[?1006l\x1b[?1002l\x1b[?1000l";
}

export function enableExtendedKeyboardMode(mode: ExtendedKeyboardMode): string {
  return mode === "kitty" ? "\x1b[>7u" : "\x1b[>4;2m";
}

export function disableExtendedKeyboardMode(mode: ExtendedKeyboardMode): string {
  return mode === "kitty" ? "\x1b[<u" : "\x1b[>4;0m";
}

export function resetExtendedKeyboardModes(): string {
  return "\x1b[<999u\x1b[>4;0m";
}

export function emergencyTerminalModeReset(): string {
  return beginSynchronizedOutput()
    + resetScrollRegion()
    + disableMouseReporting()
    + enableAlternateScrollMode()
    + exitAlternateScreen()
    + resetExtendedKeyboardModes()
    + endSynchronizedOutput();
}
