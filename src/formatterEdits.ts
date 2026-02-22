import { extractTripleQuotedTables } from "./parser";
import type { AnnotationHostLanguage } from "./parser";

export type OffsetRange = {
  start: number;
  end: number;
};

export type TableEdit = {
  start: number;
  end: number;
  formatted: string;
};

export type FormatTable = (content: string, indent: string) => string;

export function calculateTableEdits(
  text: string,
  formatTable: FormatTable,
  range?: OffsetRange,
  language: AnnotationHostLanguage = "java"
): TableEdit[] {
  const tables = extractTripleQuotedTables(text, language);
  if (tables.length === 0) return [];

  return tables.flatMap((table) => {
    if (range) {
      const withinRange = table.start >= range.start && table.end <= range.end;
      if (!withinRange) return [];
    }

    const formatted = formatTable(table.content, table.indent);
    if (formatted === table.content) return [];

    return [{ start: table.start, end: table.end, formatted }];
  });
}

export type Position = {
  line: number;
  character: number;
};

export type Range = {
  start: Position;
  end: Position;
};

export type DocumentAdapter = {
  getText(): string;
  offsetAt(position: Position): number;
  positionAt(offset: number): Position;
};

export type DocumentEdit = {
  range: Range;
  newText: string;
};

export function calculateDocumentEdits(
  document: DocumentAdapter,
  formatTable: FormatTable,
  range?: Range,
  language: AnnotationHostLanguage = "java"
): DocumentEdit[] {
  const text = document.getText();
  const offsetRange = range
    ? { start: document.offsetAt(range.start), end: document.offsetAt(range.end) }
    : undefined;

  return calculateTableEdits(text, formatTable, offsetRange, language).map((edit) => ({
    range: {
      start: document.positionAt(edit.start),
      end: document.positionAt(edit.end)
    },
    newText: edit.formatted
  }));
}
