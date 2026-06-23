import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { type SelectItem, SelectList } from "@earendil-works/pi-tui";
import { isInputStyle, type InputStyle } from "../core/input-style-config";
import { renderInputStylePreview } from "./input-style-preview";
import { renderSettingsFocusFrame } from "./settings-frame";

function selectListTheme(theme: Theme) {
  return {
    selectedPrefix: (text: string) => theme.fg("accent", text),
    selectedText: (text: string) => theme.fg("accent", theme.bold(text)),
    description: (text: string) => theme.fg("muted", text),
    scrollInfo: (text: string) => theme.fg("dim", text),
    noMatch: (text: string) => theme.fg("warning", text),
  };
}

function itemLabel(label: string, style: InputStyle, currentStyle: InputStyle): string {
  return style === currentStyle ? `${label} (current)` : label;
}

function styleItems(currentStyle: InputStyle): SelectItem[] {
  return [
    {
      value: "default",
      label: itemLabel("Default", "default", currentStyle),
      description: "Current pi-input-3000 chrome with badges, footer, and border chase",
    },
    {
      value: "amp",
      label: itemLabel("Amp-inspired", "amp", currentStyle),
      description: "Minimal chrome: cost, thinking, context %, and cwd only",
    },
  ];
}

export async function showInputStyleMenu(
  ctx: ExtensionContext,
  currentStyle: InputStyle,
): Promise<InputStyle | undefined> {
  return ctx.ui.custom<InputStyle | undefined>((tui, theme, _keybindings, done) => {
    let previewStyle = currentStyle;
    const selectList = new SelectList(
      styleItems(currentStyle),
      2,
      selectListTheme(theme),
      { minPrimaryColumnWidth: 18, maxPrimaryColumnWidth: 28 },
    );

    selectList.setSelectedIndex(currentStyle === "amp" ? 1 : 0);
    selectList.onSelectionChange = (item) => {
      if (isInputStyle(item.value)) previewStyle = item.value;
      tui.requestRender();
    };
    selectList.onSelect = (item) => {
      done(isInputStyle(item.value) ? item.value : undefined);
    };
    selectList.onCancel = () => done(undefined);

    return {
      render(width: number): string[] {
        const lines = [
          theme.fg("accent", theme.bold("Input Style")),
          "",
          ...selectList.render(width),
          "",
          ...renderInputStylePreview(ctx, previewStyle, width, theme),
          "",
          theme.fg("dim", "↑↓ preview • enter select • esc cancel"),
        ];
        return renderSettingsFocusFrame(lines, width, theme);
      },
      invalidate(): void {
        selectList.invalidate();
      },
      handleInput(data: string): void {
        selectList.handleInput(data);
        tui.requestRender();
      },
    };
  });
}
