import { displayWidth, extractAnnotationTables } from "./parser";
import type { AnnotationHostLanguage } from "./parser";
import type { ExtractedTableStringArray } from "./parser";

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
  language: AnnotationHostLanguage = "java",
  extraIndent: string = "",
  tabSize: number = 4,
  arrayExtraIndent: string = extraIndent
): TableEdit[] {
  const tables = extractAnnotationTables(text, language);
  if (tables.length === 0) return [];

  return tables.flatMap((table) => {
    if (range) {
      const withinRange = table.start >= range.start && table.end <= range.end;
      if (!withinRange) return [];
    }

    if (table.kind === "textBlock") {
      const formatted = formatTable(table.content, table.indent + extraIndent);
      if (formatted === table.content) return [];
      return [{ start: table.start, end: table.end, formatted }];
    }

    const formattedArray = formatStringArrayTable(table, formatTable, arrayExtraIndent, tabSize);
    const originalArray = text.slice(table.start, table.end);
    if (formattedArray === originalArray) return [];
    return [{ start: table.start, end: table.end, formatted: formattedArray }];
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
  language: AnnotationHostLanguage = "java",
  extraIndent: string = "",
  tabSize: number = 4,
  arrayExtraIndent: string = extraIndent
): DocumentEdit[] {
  const text = document.getText();
  const offsetRange = range
    ? { start: document.offsetAt(range.start), end: document.offsetAt(range.end) }
    : undefined;

  return calculateTableEdits(text, formatTable, offsetRange, language, extraIndent, tabSize, arrayExtraIndent).map((edit) => ({
    range: {
      start: document.positionAt(edit.start),
      end: document.positionAt(edit.end)
    },
    newText: edit.formatted
  }));
}

function formatStringArrayTable(
  table: ExtractedTableStringArray,
  formatTable: FormatTable,
  extraIndent: string,
  tabSize: number
): string {
  const sourceRows = table.rows.map((row) => row.decodedContent);
  const sourceTable = sourceRows.join("\n");
  const formattedTable = formatTable(sourceTable, "");
  const formattedRows = formattedTable.split("\n");
  if (formattedRows.length === 0) {
    return "{}";
  }

  const escapedRowLiterals = formattedRows.map((row) => escapeJavaStringLiteral(row));
  const maxRowWidth = Math.max(...escapedRowLiterals.map((row) => displayWidth(row, tabSize)));
  const rowIndent = table.indent + extraIndent;
  const rowLines = escapedRowLiterals.map((escapedRow, rowIndex) => {
    const rowWidth = displayWidth(escapedRow, tabSize);
    const trailingSpaces = " ".repeat(Math.max(maxRowWidth - rowWidth, 0));
    const literal = escapedRow + trailingSpaces;
    const suffix = rowIndex < formattedRows.length - 1 ? "," : "";
    return `${rowIndent}"${literal}"${suffix}`;
  });

  return ["{", ...rowLines, `${table.indent}}`].join("\n");
}

function escapeJavaStringLiteral(value: string): string {
  let escaped = "";
  for (const char of value) {
    switch (char) {
      case "\\":
        escaped += "\\\\";
        break;
      case "\"":
        escaped += "\\\"";
        break;
      case "\b":
        escaped += "\\b";
        break;
      case "\f":
        escaped += "\\f";
        break;
      case "\n":
        escaped += "\\n";
        break;
      case "\r":
        escaped += "\\r";
        break;
      case "\t":
        escaped += "\\t";
        break;
      default: {
        const codePoint = char.codePointAt(0);
        if (codePoint !== undefined && codePoint < 0x20) {
          escaped += `\\u${codePoint.toString(16).padStart(4, "0")}`;
        } else {
          escaped += char;
        }
      }
    }
  }
  return escaped;
}
