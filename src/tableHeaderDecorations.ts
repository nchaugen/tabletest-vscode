import * as vscode from "vscode";
import { collectTableHeaderTokenSpans } from "./tableHeaderTokens";

const headerDecoration = vscode.window.createTextEditorDecorationType({
  fontWeight: "bold"
});

export function registerTableHeaderDecorations(context: vscode.ExtensionContext) {
  const refreshVisibleEditors = () => {
    for (const editor of vscode.window.visibleTextEditors) {
      refreshEditor(editor);
    }
  };

  const refreshEditor = (editor: vscode.TextEditor) => {
    editor.setDecorations(headerDecoration, headerRanges(editor.document));
  };

  context.subscriptions.push(
    headerDecoration,
    vscode.window.onDidChangeVisibleTextEditors(refreshVisibleEditors),
    vscode.workspace.onDidChangeTextDocument((event) => {
      for (const editor of vscode.window.visibleTextEditors) {
        if (editor.document.uri.toString() === event.document.uri.toString()) {
          refreshEditor(editor);
        }
      }
    })
  );

  refreshVisibleEditors();
}

function headerRanges(document: vscode.TextDocument): vscode.Range[] {
  if (document.languageId !== "tabletest" && document.languageId !== "java" && document.languageId !== "kotlin") {
    return [];
  }

  return collectTableHeaderTokenSpans(document.getText(), document.languageId)
    .map((span) => new vscode.Range(document.positionAt(span.start), document.positionAt(span.end)));
}
