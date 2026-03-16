import * as fs from "node:fs";
import * as vscode from "vscode";
import type { JavaFormatterProfileReader } from "./javaFormatterProfileReader";
import { readFormatterSetting } from "./formatterSettings";
import { resolveJavaFormatterSettingsPath } from "./nodeFormatterSettings";

export class NodeJavaFormatterProfileReader implements JavaFormatterProfileReader {
  readIndentLevels(document: vscode.TextDocument, settingIds: readonly string[]): number | null {
    const javaConfig = vscode.workspace.getConfiguration("java", document.uri);
    const formatterSettings = javaConfig.get<string>("format.settings.url");
    if (typeof formatterSettings !== "string" || formatterSettings.trim() === "") {
      return null;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri) ?? vscode.workspace.workspaceFolders?.[0];
    const workspaceRoot = workspaceFolder?.uri.fsPath ?? "";
    const settingsPath = resolveJavaFormatterSettingsPath(formatterSettings, workspaceRoot, process.env);
    if (!settingsPath) {
      return null;
    }

    let formatterXml: string;
    try {
      formatterXml = fs.readFileSync(settingsPath, "utf8");
    } catch {
      return null;
    }

    for (const settingId of settingIds) {
      const value = readFormatterSetting(formatterXml, settingId);
      if (value !== null) {
        return value;
      }
    }
    return null;
  }
}
