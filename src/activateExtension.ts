import * as vscode from "vscode";
import { TableTestFormatter } from "./formatter";
import type { JavaFormatterProfileReader } from "./javaFormatterProfileReader";
import { registerTableHeaderDecorations } from "./tableHeaderDecorations";
import { TableHeaderSemanticTokensProvider, tableHeaderSemanticLegend } from "./tableHeaderSemanticTokens";
import { registerTableDiagnostics } from "./tableDiagnostics";

/**
 * Syntax highlighting is provided via a TextMate injection grammar (see syntaxes/)
 * plus semantic header tokens for cases that depend on parsed table structure.
 */
export function activateTableTestExtension(
  context: vscode.ExtensionContext,
  javaFormatterProfileReader: JavaFormatterProfileReader
) {
  const formatter = new TableTestFormatter(javaFormatterProfileReader);
  const semanticTokensProvider = new TableHeaderSemanticTokensProvider();
  const supportedLanguages = new Set(["java", "kotlin", "tabletest"]);
  registerTableDiagnostics(context);
  registerTableHeaderDecorations(context);

  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      [{ language: "java" }, { language: "kotlin" }, { language: "tabletest" }],
      semanticTokensProvider,
      tableHeaderSemanticLegend
    ),
    vscode.languages.registerDocumentFormattingEditProvider([{ language: "tabletest" }], formatter),
    vscode.languages.registerDocumentRangeFormattingEditProvider([{ language: "tabletest" }], formatter),
    vscode.commands.registerCommand("tabletest.formatAllTables", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        void vscode.window.showInformationMessage("No active editor to format TableTest tables.");
        return;
      }

      const document = editor.document;
      if (!supportedLanguages.has(document.languageId)) {
        void vscode.window.showInformationMessage("TableTest formatting is only available for Java, Kotlin, or .table files.");
        return;
      }

      const formattingOptions = resolveFormattingOptions(editor);
      const edits = formatter.provideDocumentFormattingEdits(document, formattingOptions);
      if (edits.length === 0) {
        return;
      }

      const workspaceEdit = new vscode.WorkspaceEdit();
      workspaceEdit.set(document.uri, edits);
      await vscode.workspace.applyEdit(workspaceEdit);
    })
  );
}

function resolveFormattingOptions(editor: vscode.TextEditor): vscode.FormattingOptions {
  const rawTabSize = editor.options.tabSize;
  const parsedTabSize = typeof rawTabSize === "number" ? rawTabSize : Number(rawTabSize);
  const tabSize = Number.isFinite(parsedTabSize) ? Math.max(1, Math.floor(parsedTabSize)) : 4;

  const rawInsertSpaces = editor.options.insertSpaces;
  const insertSpaces = typeof rawInsertSpaces === "boolean" ? rawInsertSpaces : true;

  return { tabSize, insertSpaces };
}
