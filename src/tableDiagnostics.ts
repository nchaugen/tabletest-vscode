import * as vscode from "vscode";
import { extractTripleQuotedTables, findTableIssues } from "./parser";
import type { AnnotationHostLanguage } from "./parser";

const diagnosticSource = "tabletest";
const diagnosticCode = "invalidCollectionSyntax";

export function registerTableDiagnostics(context: vscode.ExtensionContext): vscode.DiagnosticCollection {
  const collection = vscode.languages.createDiagnosticCollection(diagnosticSource);

  const refresh = (document: vscode.TextDocument): void => {
    if (!isSupportedLanguage(document.languageId)) {
      collection.delete(document.uri);
      return;
    }

    const diagnostics = collectDiagnostics(document);
    collection.set(document.uri, diagnostics);
  };

  context.subscriptions.push(
    collection,
    vscode.workspace.onDidOpenTextDocument(refresh),
    vscode.workspace.onDidChangeTextDocument((event) => refresh(event.document)),
    vscode.workspace.onDidCloseTextDocument((document) => collection.delete(document.uri))
  );

  vscode.workspace.textDocuments.forEach(refresh);
  return collection;
}

function collectDiagnostics(document: vscode.TextDocument): vscode.Diagnostic[] {
  if (document.languageId === "tabletest") {
    return diagnosticsForTableText(document, document.getText(), 0);
  }

  const language = annotationHostLanguageFor(document.languageId);
  const text = document.getText();
  const tables = extractTripleQuotedTables(text, language);
  return tables.flatMap((table) => diagnosticsForTableText(document, table.content, table.start));
}

function diagnosticsForTableText(
  document: vscode.TextDocument,
  tableText: string,
  baseOffset: number
): vscode.Diagnostic[] {
  return findTableIssues(tableText).map((issue) => {
    const start = document.positionAt(baseOffset + issue.start);
    const end = document.positionAt(baseOffset + issue.end);
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(start, end),
      issue.message,
      vscode.DiagnosticSeverity.Warning
    );
    diagnostic.source = diagnosticSource;
    diagnostic.code = diagnosticCode;
    return diagnostic;
  });
}

function annotationHostLanguageFor(languageId: string): AnnotationHostLanguage {
  if (languageId === "kotlin") {
    return "kotlin";
  }
  return "java";
}

function isSupportedLanguage(languageId: string): boolean {
  return languageId === "java" || languageId === "kotlin" || languageId === "tabletest";
}
