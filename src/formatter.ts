import * as vscode from "vscode";
import { formatTableString } from "./parser";
import type { AnnotationHostLanguage } from "./parser";
import { calculateDocumentEdits } from "./formatterEdits";

export class TableTestFormatter implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider {
  provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions): vscode.TextEdit[] {
    if (document.languageId === "tabletest") {
      return this.formatTableDocument(document);
    }
    return this.formatTablesInRange(document, options);
  }

  provideDocumentRangeFormattingEdits(
    document: vscode.TextDocument,
    range: vscode.Range,
    options: vscode.FormattingOptions
  ): vscode.TextEdit[] {
    if (document.languageId === "tabletest") {
      return this.formatTableDocument(document);
    }
    return this.formatTablesInRange(document, options, range);
  }

  private formatTablesInRange(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions,
    range?: vscode.Range
  ): vscode.TextEdit[] {
    const extraIndent = this.resolveExtraIndent(document, options);
    const tableEdits = calculateDocumentEdits(
      document,
      formatTableString,
      range,
      this.annotationHostLanguageFor(document.languageId),
      extraIndent
    );
    return tableEdits.map((edit) => {
      const editRange = new vscode.Range(
        new vscode.Position(edit.range.start.line, edit.range.start.character),
        new vscode.Position(edit.range.end.line, edit.range.end.character)
      );
      return vscode.TextEdit.replace(editRange, edit.newText);
    });
  }

  private formatTableDocument(document: vscode.TextDocument): vscode.TextEdit[] {
    const original = document.getText();
    const formatted = formatTableString(original);
    if (formatted === original) return [];
    const lastLine = Math.max(document.lineCount - 1, 0);
    const lastCharacter = document.lineAt(lastLine).text.length;
    const fullRange = new vscode.Range(0, 0, lastLine, lastCharacter);
    return [vscode.TextEdit.replace(fullRange, formatted)];
  }

  private annotationHostLanguageFor(languageId: string): AnnotationHostLanguage {
    if (languageId === "kotlin") {
      return "kotlin";
    }
    return "java";
  }

  private resolveExtraIndent(document: vscode.TextDocument, options: vscode.FormattingOptions): string {
    const config = vscode.workspace.getConfiguration("tabletest", document.uri);
    const configuredLevels = this.resolveConfiguredExtraIndentLevels(config, document.languageId);
    const levels = Number.isFinite(configuredLevels) ? Math.max(0, Math.floor(configuredLevels)) : 0;
    if (levels === 0) {
      return "";
    }

    const tabSize = Number.isFinite(options.tabSize) ? Math.max(1, Math.floor(options.tabSize)) : 4;
    const unit = options.insertSpaces ? " ".repeat(tabSize) : "\t";
    return unit.repeat(levels);
  }

  private resolveConfiguredExtraIndentLevels(
    config: vscode.WorkspaceConfiguration,
    languageId: string
  ): number {
    const inspect = config.inspect<number>("format.extraIndentLevel");
    if (this.hasExplicitExtraIndentConfiguration(inspect)) {
      return config.get<number>("format.extraIndentLevel", 1);
    }
    return this.defaultExtraIndentLevelsFor(languageId);
  }

  private hasExplicitExtraIndentConfiguration(
    inspect: unknown
  ): boolean {
    if (!inspect || typeof inspect !== "object") {
      return false;
    }

    const values = inspect as Record<string, unknown>;

    const configuredValues = [
      values.globalValue,
      values.workspaceValue,
      values.workspaceFolderValue,
      values.globalLanguageValue,
      values.workspaceLanguageValue,
      values.workspaceFolderLanguageValue
    ];

    return configuredValues.some((value) => value !== undefined);
  }

  private defaultExtraIndentLevelsFor(languageId: string): number {
    if (languageId === "kotlin") {
      return 0;
    }
    return 1;
  }
}
