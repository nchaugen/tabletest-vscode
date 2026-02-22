import * as vscode from "vscode";
import { formatTableString } from "./parser";
import { calculateDocumentEdits } from "./formatterEdits";

export class TableTestFormatter implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider {
  provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
    if (document.languageId === "tabletest") {
      return this.formatTableDocument(document);
    }
    return this.formatTablesInRange(document);
  }

  provideDocumentRangeFormattingEdits(document: vscode.TextDocument, range: vscode.Range): vscode.TextEdit[] {
    if (document.languageId === "tabletest") {
      return this.formatTableDocument(document);
    }
    return this.formatTablesInRange(document, range);
  }

  private formatTablesInRange(document: vscode.TextDocument, range?: vscode.Range): vscode.TextEdit[] {
    const tableEdits = calculateDocumentEdits(document, formatTableString, range);
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
}
