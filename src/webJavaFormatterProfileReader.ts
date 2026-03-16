import type * as vscode from "vscode";
import type { JavaFormatterProfileReader } from "./javaFormatterProfileReader";

export class WebJavaFormatterProfileReader implements JavaFormatterProfileReader {
  readIndentLevels(_document: vscode.TextDocument, _settingIds: readonly string[]): number | null {
    return null;
  }
}
