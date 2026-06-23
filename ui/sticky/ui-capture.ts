/* eslint-disable @typescript-eslint/consistent-type-assertions */

import type { StickyTuiLike } from "./types";

interface StickyUiCaptureCallbacks {
  editorFactoryStarted(tui: StickyTuiLike): void;
  editorCaptured(tui: StickyTuiLike, editor: unknown): void;
  footerFactoryStarted(tui: StickyTuiLike): void;
  footerCaptured(tui: StickyTuiLike): void;
  probeCaptured(tui: StickyTuiLike): void;
}

interface ProbeWidget {
  render(width: number): string[];
  invalidate(): void;
}

type EditorFactory = (tui: StickyTuiLike, theme: unknown, keybindings: unknown) => unknown;
type FooterFactory = (tui: StickyTuiLike, theme: unknown, footerData: unknown) => unknown;
type WidgetFactory = (tui: StickyTuiLike) => ProbeWidget;
type SetEditorComponent = (this: UiCaptureTarget, factory: EditorFactory | undefined) => unknown;
type SetFooter = (this: UiCaptureTarget, factory: FooterFactory | undefined) => unknown;
type SetWidget = (
  this: UiCaptureTarget,
  id: string,
  factory: WidgetFactory | undefined,
  options: { placement: "aboveEditor" },
) => unknown;

interface UiCaptureTarget {
  setEditorComponent?: SetEditorComponent;
  setFooter?: SetFooter;
  setWidget?: SetWidget;
}

export interface StickyUiCapture {
  restore(): void;
}

function asUiCaptureTarget(ui: unknown): UiCaptureTarget {
  return ui != null && typeof ui === "object" ? ui as UiCaptureTarget : {};
}

function createProbeWidget(): ProbeWidget {
  return {
    render: (_width: number): string[] => [],
    invalidate(): void {},
  };
}

export function installStickyUiCapture(
  ui: unknown,
  callbacks: StickyUiCaptureCallbacks,
): StickyUiCapture {
  const target = asUiCaptureTarget(ui);
  const originalSetEditor = target.setEditorComponent;
  const originalSetFooter = target.setFooter;
  const originalSetWidget = target.setWidget;
  let wrappedSetEditor: SetEditorComponent | null = null;
  let wrappedSetFooter: SetFooter | null = null;

  if (originalSetEditor) {
    wrappedSetEditor = function setStickyEditorComponent(factory) {
      const wrapped = typeof factory === "function"
        ? (tui: StickyTuiLike, theme: unknown, keybindings: unknown) => {
            callbacks.editorFactoryStarted(tui);
            const editor = factory(tui, theme, keybindings);
            callbacks.editorCaptured(tui, editor);
            return editor;
          }
        : factory;

      return originalSetEditor.call(target, wrapped);
    };
    target.setEditorComponent = wrappedSetEditor;
  }

  if (originalSetFooter) {
    wrappedSetFooter = function setStickyFooter(factory) {
      const wrapped = typeof factory === "function"
        ? (tui: StickyTuiLike, theme: unknown, footerData: unknown) => {
            callbacks.footerFactoryStarted(tui);
            const footer = factory(tui, theme, footerData);
            callbacks.footerCaptured(tui);
            return footer;
          }
        : factory;

      return originalSetFooter.call(target, wrapped);
    };
    target.setFooter = wrappedSetFooter;
  }

  target.setWidget?.call(
    target,
    "pi-sticky:probe",
    (tui: StickyTuiLike) => {
      callbacks.probeCaptured(tui);
      return createProbeWidget();
    },
    { placement: "aboveEditor" },
  );

  return {
    restore(): void {
      if (wrappedSetEditor && target.setEditorComponent === wrappedSetEditor) {
        target.setEditorComponent = originalSetEditor;
      }
      if (wrappedSetFooter && target.setFooter === wrappedSetFooter) {
        target.setFooter = originalSetFooter;
      }
      originalSetWidget?.call(target, "pi-sticky:probe", undefined, {
        placement: "aboveEditor",
      });
    },
  };
}
