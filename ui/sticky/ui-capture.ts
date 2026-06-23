import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";

interface StickyUiCaptureCallbacks {
  editorFactoryStarted(tui: TUI): void;
  editorCaptured(tui: TUI, editor: Component): void;
  footerFactoryStarted(tui: TUI): void;
  footerCaptured(tui: TUI): void;
  probeCaptured(tui: TUI): void;
}

type EditorFactory = NonNullable<Parameters<ExtensionUIContext["setEditorComponent"]>[0]>;
type FooterFactory = Parameters<ExtensionUIContext["setFooter"]>[0];

export interface StickyUiCapture {
  restore(): void;
}

function createProbeWidget(): Component {
  return {
    render: (_width: number): string[] => [],
    invalidate(): void {},
  };
}

export function installStickyUiCapture(
  ui: ExtensionUIContext,
  callbacks: StickyUiCaptureCallbacks,
): StickyUiCapture {
  const originalSetEditor = ui.setEditorComponent;
  const originalSetFooter = ui.setFooter;
  const originalSetWidget = ui.setWidget;
  let wrappedSetEditor: ExtensionUIContext["setEditorComponent"] | null = null;
  let wrappedSetFooter: ExtensionUIContext["setFooter"] | null = null;

  wrappedSetEditor = function setStickyEditorComponent(factory) {
    const wrapped: EditorFactory | undefined = typeof factory === "function"
      ? (tui, theme, keybindings) => {
          callbacks.editorFactoryStarted(tui);
          const editor = factory(tui, theme, keybindings);
          callbacks.editorCaptured(tui, editor);
          return editor;
        }
      : factory;

    return originalSetEditor.call(ui, wrapped);
  };
  ui.setEditorComponent = wrappedSetEditor;

  wrappedSetFooter = function setStickyFooter(factory) {
    const wrapped: FooterFactory = typeof factory === "function"
      ? (tui, theme, footerData) => {
          callbacks.footerFactoryStarted(tui);
          const footer = factory(tui, theme, footerData);
          callbacks.footerCaptured(tui);
          return footer;
        }
      : factory;

    return originalSetFooter.call(ui, wrapped);
  };
  ui.setFooter = wrappedSetFooter;

  originalSetWidget.call(
    ui,
    "pi-sticky:probe",
    (tui) => {
      callbacks.probeCaptured(tui);
      return createProbeWidget();
    },
    { placement: "aboveEditor" },
  );

  return {
    restore(): void {
      if (wrappedSetEditor && ui.setEditorComponent === wrappedSetEditor) {
        ui.setEditorComponent = originalSetEditor;
      }
      if (wrappedSetFooter && ui.setFooter === wrappedSetFooter) {
        ui.setFooter = originalSetFooter;
      }
      originalSetWidget.call(ui, "pi-sticky:probe", undefined, {
        placement: "aboveEditor",
      });
    },
  };
}
