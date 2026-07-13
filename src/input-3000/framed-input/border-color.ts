import { EDITOR_CHROME } from "../constants";

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const RESET_FG = "\x1b[39m";

function ansi256ToRgb(index: number): Rgb | undefined {
  if (index < 0 || index > 255) return undefined;

  const basic: Rgb[] = [
    { r: 0, g: 0, b: 0 },
    { r: 128, g: 0, b: 0 },
    { r: 0, g: 128, b: 0 },
    { r: 128, g: 128, b: 0 },
    { r: 0, g: 0, b: 128 },
    { r: 128, g: 0, b: 128 },
    { r: 0, g: 128, b: 128 },
    { r: 192, g: 192, b: 192 },
    { r: 128, g: 128, b: 128 },
    { r: 255, g: 0, b: 0 },
    { r: 0, g: 255, b: 0 },
    { r: 255, g: 255, b: 0 },
    { r: 0, g: 0, b: 255 },
    { r: 255, g: 0, b: 255 },
    { r: 0, g: 255, b: 255 },
    { r: 255, g: 255, b: 255 },
  ];
  if (index < 16) return basic[index];

  if (index < 232) {
    const cubeIndex = index - 16;
    const r = Math.floor(cubeIndex / 36);
    const g = Math.floor((cubeIndex % 36) / 6);
    const b = cubeIndex % 6;
    const channel = (value: number) => (value === 0 ? 0 : 55 + value * 40);
    return { r: channel(r), g: channel(g), b: channel(b) };
  }

  const gray = 8 + (index - 232) * 10;
  return { r: gray, g: gray, b: gray };
}

export function parseAnsiRgb(ansi: string): Rgb | undefined {
  const trueColor = ansi.match(/\x1b\[38;2;(\d+);(\d+);(\d+)m/);
  if (trueColor) {
    return {
      r: Number(trueColor[1]),
      g: Number(trueColor[2]),
      b: Number(trueColor[3]),
    };
  }

  const indexed = ansi.match(/\x1b\[38;5;(\d+)m/);
  return indexed ? ansi256ToRgb(Number(indexed[1])) : undefined;
}

export function blendRgb(from: Rgb, to: Rgb, amount: number): Rgb {
  const clamped = Math.max(0, Math.min(1, amount));
  return {
    r: Math.round(from.r + (to.r - from.r) * clamped),
    g: Math.round(from.g + (to.g - from.g) * clamped),
    b: Math.round(from.b + (to.b - from.b) * clamped),
  };
}

export function rgbFg(rgb: Rgb, text: string): string {
  return `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m${text}${RESET_FG}`;
}

export function rgbBg(rgb: Rgb, text: string): string {
  return `\x1b[48;2;${rgb.r};${rgb.g};${rgb.b}m${text}\x1b[49m`;
}

export function heavyBorderChar(char: string): string {
  return char === EDITOR_CHROME.horizontal ? EDITOR_CHROME.heavyHorizontal : char;
}

export type { Rgb };
