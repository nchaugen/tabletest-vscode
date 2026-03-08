import * as vscode from "vscode";
import { extractAnnotationTables, findTableIssues } from "./parser";
import type { AnnotationHostLanguage } from "./parser";
import type { ExtractedTableStringArrayRow } from "./parser";

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
  const tables = extractAnnotationTables(text, language);
  return tables.flatMap((table) => {
    if (table.kind === "textBlock") {
      return diagnosticsForTableText(document, table.content, table.start);
    }
    return diagnosticsForStringArrayRows(document, table.rows);
  });
}

function diagnosticsForTableText(
  document: vscode.TextDocument,
  tableText: string,
  baseOffset: number
): vscode.Diagnostic[] {
  return findTableIssues(tableText).map((issue) => {
    const start = document.positionAt(baseOffset + issue.start);
    const end = document.positionAt(baseOffset + issue.end);
    return createDiagnostic(start, end, issue.message);
  });
}

function diagnosticsForStringArrayRows(
  document: vscode.TextDocument,
  rows: ExtractedTableStringArrayRow[]
): vscode.Diagnostic[] {
  const tableText = rows.map((row) => row.decodedContent).join("\n");
  const rowOffsets = arrayRowOffsets(rows);

  return findTableIssues(tableText).flatMap((issue) => {
    const startOffset = mapJoinedOffsetToSourceOffset(issue.start, rowOffsets);
    const endOffset = mapJoinedOffsetToSourceOffset(issue.end, rowOffsets);
    if (startOffset === null || endOffset === null) {
      return [];
    }

    return [
      createDiagnostic(
        document.positionAt(startOffset),
        document.positionAt(endOffset),
        issue.message
      )
    ];
  });
}

type ArrayRowOffset = {
  joinedStart: number;
  joinedEnd: number;
  row: ExtractedTableStringArrayRow;
};

function arrayRowOffsets(rows: ExtractedTableStringArrayRow[]): ArrayRowOffset[] {
  const offsets: ArrayRowOffset[] = [];
  let cursor = 0;
  for (const row of rows) {
    const joinedStart = cursor;
    const joinedEnd = joinedStart + row.decodedContent.length;
    offsets.push({
      joinedStart,
      joinedEnd,
      row
    });
    cursor = joinedEnd + 1;
  }
  return offsets;
}

function mapJoinedOffsetToSourceOffset(offset: number, rowOffsets: ArrayRowOffset[]): number | null {
  for (const rowOffset of rowOffsets) {
    if (offset < rowOffset.joinedStart) {
      continue;
    }
    if (offset <= rowOffset.joinedEnd) {
      const relative = offset - rowOffset.joinedStart;
      return rowOffset.row.decodedContentSourceOffsets[relative] ?? rowOffset.row.end;
    }
    if (offset === rowOffset.joinedEnd + 1) {
      return rowOffset.row.end;
    }
  }
  return null;
}

function createDiagnostic(start: vscode.Position, end: vscode.Position, message: string): vscode.Diagnostic {
  const diagnostic = new vscode.Diagnostic(
    new vscode.Range(start, end),
    message,
    vscode.DiagnosticSeverity.Warning
  );
  diagnostic.source = diagnosticSource;
  diagnostic.code = diagnosticCode;
  return diagnostic;
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
