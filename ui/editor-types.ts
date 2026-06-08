export interface EditorContextMeter {
  percent: number;
  label: string;
}

export interface EditorBranchMeta {
  name: string;
  dirty: boolean;
  ahead: number;
  behind: number;
}

export interface EditorMeta {
  modelLabel: string;
  thinkingLevel: string;
  contextMeter?: EditorContextMeter;
  branch?: EditorBranchMeta;
}

export interface EditorChrome {
  meta: EditorMeta;
  chaseFrameIndex?: number;
  chaseFrameCount?: number;
  workingMessage?: string;
}

export interface EditorFrameParts {
  editorFrame: string[];
  autocompleteLines: string[];
}
