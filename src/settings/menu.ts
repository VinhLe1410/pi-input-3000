import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { type SelectItem, SelectList } from "@earendil-works/pi-tui";
import {
  findInputStyleAdapter,
  inputStyleAdapters,
  isInputStyle,
  type InputStyle,
  type InputStyleConfig,
} from "../input-styles";
import { renderSettingsFocusFrame } from "./frame";

function selectListTheme(theme: Theme) {
  return {
    selectedPrefix: (text: string) => theme.fg("accent", text),
    selectedText: (text: string) => theme.fg("accent", theme.bold(text)),
    description: (text: string) => theme.fg("muted", text),
    scrollInfo: (text: string) => theme.fg("dim", text),
    noMatch: (text: string) => theme.fg("warning", text),
  };
}

function styleItems(currentStyle: InputStyle): SelectItem[] {
  return inputStyleAdapters.map((adapter) => ({
    value: adapter.id,
    label: adapter.id === currentStyle ? `${adapter.label} (current)` : adapter.label,
    description: adapter.description,
  }));
}

function renderStickyInputToggle(stickyInput: boolean, theme: Theme): string {
  const marker = stickyInput
    ? theme.fg("success", "●")
    : theme.fg("muted", "○");
  const state = stickyInput
    ? theme.bold(theme.fg("success", "enabled"))
    : theme.fg("muted", "disabled");

  return `${marker} ${theme.bold("Sticky input")} ${state} ${theme.fg("dim", "(press s)")}`;
}

function isStickyToggleInput(data: string): boolean {
  return data === "s" || data === "S";
}

export async function showInputStyleMenu(
  ctx: ExtensionContext,
  currentConfig: InputStyleConfig,
): Promise<InputStyleConfig | undefined> {
  return ctx.ui.custom<InputStyleConfig | undefined>((tui, theme, _keybindings, done) => {
    let selectedStyle = currentConfig.style;
    let stickyInput = currentConfig.stickyInput;
    const selectList = new SelectList(
      styleItems(currentConfig.style),
      inputStyleAdapters.length,
      selectListTheme(theme),
      { minPrimaryColumnWidth: 18, maxPrimaryColumnWidth: 28 },
    );

    const initialIndex = inputStyleAdapters.findIndex((adapter) => adapter.id === currentConfig.style);
    selectList.setSelectedIndex(initialIndex >= 0 ? initialIndex : 0);
    selectList.onSelectionChange = (item) => {
      if (isInputStyle(item.value)) selectedStyle = item.value;
      tui.requestRender();
    };
    selectList.onSelect = (item) => {
      done(isInputStyle(item.value) ? { style: item.value, stickyInput } : undefined);
    };
    selectList.onCancel = () => done(undefined);

    return {
      render(width: number): string[] {
        const adapter = findInputStyleAdapter(selectedStyle);
        const preview = adapter?.renderPreview?.(ctx, width, theme) ?? [];
        const lines = [
          theme.fg("accent", theme.bold("Pi Input 3000 Settings")),
          "",
          theme.fg("muted", "Input style"),
          ...selectList.render(width),
          "",
          renderStickyInputToggle(stickyInput, theme),
          ...(preview.length > 0 ? ["", ...preview] : []),
          "",
          theme.fg("dim", "↑↓ select • s sticky • enter save • esc cancel"),
        ];
        return renderSettingsFocusFrame(lines, width, theme);
      },
      invalidate(): void {
        selectList.invalidate();
      },
      handleInput(data: string): void {
        if (isStickyToggleInput(data)) {
          stickyInput = !stickyInput;
          tui.requestRender();
          return;
        }

        selectList.handleInput(data);
        tui.requestRender();
      },
    };
  });
}
