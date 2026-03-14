import * as fs from "node:fs";
import * as vscode from "vscode";
import { formatTableString } from "./parser";
import type { AnnotationHostLanguage } from "./parser";
import { calculateDocumentEdits } from "./formatterEdits";
import {
  hasExplicitConfigurationValue,
  indentStringForLevels,
  readFormatterSetting,
  resolveJavaFormatterSettingsPath
} from "./formatterSettings";

export class TableTestFormatter implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider {
  provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions): vscode.TextEdit[] {
    if (document.languageId === "tabletest") {
      return this.formatTableDocument(document, options);
    }
    return this.formatTablesInRange(document, options);
  }

  provideDocumentRangeFormattingEdits(
    document: vscode.TextDocument,
    range: vscode.Range,
    options: vscode.FormattingOptions
  ): vscode.TextEdit[] {
    if (document.languageId === "tabletest") {
      return this.formatTableDocumentRange(document, range, options);
    }
    return this.formatTablesInRange(document, options, range);
  }

  private formatTablesInRange(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions,
    range?: vscode.Range
  ): vscode.TextEdit[] {
    const extraIndent = this.resolveExtraIndent(document, options);
    const tabSize = this.resolveTabSize(document, options);
    const arrayExtraIndent = this.resolveArrayExtraIndent(document, options, extraIndent);
    const tableEdits = calculateDocumentEdits(
      document,
      (content, indent) => formatTableString(content, indent, tabSize),
      range,
      this.annotationHostLanguageFor(document.languageId),
      extraIndent,
      tabSize,
      arrayExtraIndent
    );
    return tableEdits.map((edit) => {
      const editRange = new vscode.Range(
        new vscode.Position(edit.range.start.line, edit.range.start.character),
        new vscode.Position(edit.range.end.line, edit.range.end.character)
      );
      return vscode.TextEdit.replace(editRange, edit.newText);
    });
  }

  private formatTableDocument(document: vscode.TextDocument, options: vscode.FormattingOptions): vscode.TextEdit[] {
    const original = document.getText();
    const formatted = formatTableString(original, "", this.resolveTabSize(document, options));
    if (formatted === original) return [];
    const lastLine = Math.max(document.lineCount - 1, 0);
    const lastCharacter = document.lineAt(lastLine).text.length;
    const fullRange = new vscode.Range(0, 0, lastLine, lastCharacter);
    return [vscode.TextEdit.replace(fullRange, formatted)];
  }

  private formatTableDocumentRange(
    document: vscode.TextDocument,
    range: vscode.Range,
    options: vscode.FormattingOptions
  ): vscode.TextEdit[] {
    const lineRange = this.rangeExpandedToFullLines(document, range);
    if (!lineRange) {
      return [];
    }

    const original = document.getText(lineRange);
    const formatted = formatTableString(original, "", this.resolveTabSize(document, options));
    if (formatted === original) {
      return [];
    }

    return [vscode.TextEdit.replace(lineRange, formatted)];
  }

  private annotationHostLanguageFor(languageId: string): AnnotationHostLanguage {
    if (languageId === "kotlin") {
      return "kotlin";
    }
    return "java";
  }

  private rangeExpandedToFullLines(document: vscode.TextDocument, range: vscode.Range): vscode.Range | null {
    const startLine = range.start.line;
    const resolvedEndLine =
      range.end.character === 0 && range.end.line > startLine
        ? range.end.line - 1
        : range.end.line;

    if (resolvedEndLine < startLine || resolvedEndLine >= document.lineCount) {
      return null;
    }

    return new vscode.Range(
      new vscode.Position(startLine, 0),
      new vscode.Position(resolvedEndLine, document.lineAt(resolvedEndLine).text.length)
    );
  }

  private resolveExtraIndent(document: vscode.TextDocument, options: vscode.FormattingOptions): string {
    const config = vscode.workspace.getConfiguration("tabletest", document.uri);
    const configuredLevels = this.resolveConfiguredExtraIndentLevels(config, document);
    const tabSize = this.resolveTabSize(document, options);
    return indentStringForLevels(configuredLevels, tabSize, options.insertSpaces);
  }

  private resolveTabSize(document: vscode.TextDocument, options: vscode.FormattingOptions): number {
    const editorConfig = vscode.workspace.getConfiguration("editor", document.uri);
    const configuredTabSize = editorConfig.get<unknown>("tabSize");
    if (typeof configuredTabSize === "number" && Number.isFinite(configuredTabSize)) {
      return Math.max(1, Math.floor(configuredTabSize));
    }
    return Number.isFinite(options.tabSize) ? Math.max(1, Math.floor(options.tabSize)) : 4;
  }

  private resolveConfiguredExtraIndentLevels(
    config: vscode.WorkspaceConfiguration,
    document: vscode.TextDocument
  ): number {
    const inspect = config.inspect<number>("format.extraIndentLevel");
    if (this.hasExplicitExtraIndentConfiguration(inspect)) {
      return config.get<number>("format.extraIndentLevel", 1);
    }
    return this.defaultExtraIndentLevelsFor(document);
  }

  private hasExplicitExtraIndentConfiguration(
    inspect: unknown
  ): boolean {
    return hasExplicitConfigurationValue(inspect);
  }

  private resolveArrayExtraIndent(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions,
    fallbackExtraIndent: string
  ): string {
    if (document.languageId !== "java") {
      return fallbackExtraIndent;
    }

    const tableTestConfig = vscode.workspace.getConfiguration("tabletest", document.uri);
    const explicitTableTestIndent = this.hasExplicitExtraIndentConfiguration(
      tableTestConfig.inspect<number>("format.extraIndentLevel")
    );
    if (explicitTableTestIndent) {
      return fallbackExtraIndent;
    }

    const formatterIndentLevels = this.resolveJavaFormatterArrayIndentLevels(document);
    const resolvedIndentLevels = formatterIndentLevels ?? this.defaultJavaArrayContinuationIndentLevels();

    const tabSize = this.resolveTabSize(document, options);
    return indentStringForLevels(resolvedIndentLevels, tabSize, options.insertSpaces);
  }

  private resolveJavaFormatterArrayIndentLevels(document: vscode.TextDocument): number | null {
    return this.resolveJavaFormatterIndentSetting(document, [
      "org.eclipse.jdt.core.formatter.continuation_indentation_for_array_initializer",
      "org.eclipse.jdt.core.formatter.continuation_indentation"
    ]);
  }

  private resolveJavaFormatterContinuationIndentLevels(document: vscode.TextDocument): number | null {
    return this.resolveJavaFormatterIndentSetting(document, [
      "org.eclipse.jdt.core.formatter.continuation_indentation"
    ]);
  }

  private resolveJavaFormatterIndentSetting(
    document: vscode.TextDocument,
    settingIds: string[]
  ): number | null {
    const javaConfig = vscode.workspace.getConfiguration("java", document.uri);
    const formatterSettings = javaConfig.get<string>("format.settings.url");
    if (typeof formatterSettings !== "string" || formatterSettings.trim() === "") {
      return null;
    }

    const settingsPath = this.resolveJavaFormatterSettingsPath(formatterSettings, document);
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
      const value = this.readFormatterSetting(formatterXml, settingId);
      if (value !== null) {
        return value;
      }
    }
    return null;
  }

  private resolveJavaFormatterSettingsPath(
    configuredUrl: string,
    document: vscode.TextDocument
  ): string | null {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri) ?? vscode.workspace.workspaceFolders?.[0];
    const workspaceRoot = workspaceFolder?.uri.fsPath ?? "";
    return resolveJavaFormatterSettingsPath(configuredUrl, workspaceRoot, process.env);
  }

  private readFormatterSetting(formatterXml: string, settingId: string): number | null {
    return readFormatterSetting(formatterXml, settingId);
  }

  private defaultJavaArrayContinuationIndentLevels(): number {
    return 2;
  }

  private defaultExtraIndentLevelsFor(document: vscode.TextDocument): number {
    if (document.languageId === "kotlin") {
      return 0;
    }

    if (document.languageId === "java") {
      return this.resolveJavaFormatterContinuationIndentLevels(document) ?? this.defaultJavaArrayContinuationIndentLevels();
    }

    return 1;
  }
}
