import type * as vscode from "vscode";

export interface JavaFormatterProfileReader {
  readIndentLevels(document: vscode.TextDocument, settingIds: readonly string[]): number | null;
}
