import type { SharedEditorMeta } from "../../shared/editor-meta";
export type { EditorContextMeter } from "../../shared/editor-meta";

export interface DefaultEditorBranchMeta {
  name: string;
  dirty: boolean;
  ahead: number;
  behind: number;
}

export interface DefaultEditorMeta extends SharedEditorMeta {
  branch?: DefaultEditorBranchMeta;
}

export interface DefaultEditorChrome {
  meta: DefaultEditorMeta;
  chaseFrameIndex?: number;
  chaseFrameCount?: number;
  workingMessage?: string;
}
