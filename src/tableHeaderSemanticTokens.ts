import * as vscode from "vscode";
import { collectTableHeaderTokenSpans } from "./tableHeaderTokens";

const tokenTypes = ["tableHeader", "tableQuestionHeader"] as const;
export const tableHeaderSemanticLegend = new vscode.SemanticTokensLegend([...tokenTypes], []);

export class TableHeaderSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
  provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.SemanticTokens {
    const builder = new vscode.SemanticTokensBuilder(tableHeaderSemanticLegend);

    if (document.languageId !== "java" && document.languageId !== "kotlin" && document.languageId !== "tabletest") {
      return builder.build();
    }

    for (const span of collectTableHeaderTokenSpans(document.getText(), document.languageId)) {
      const start = document.positionAt(span.start);
      const end = document.positionAt(span.end);
      if (start.line !== end.line || start.isEqual(end)) {
        continue;
      }

      builder.push(start.line, start.character, end.character - start.character, tokenTypes.indexOf(span.tokenType), 0);
    }

    return builder.build();
  }
}
