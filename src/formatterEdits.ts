import { displayWidth, extractAnnotationTables, findTableIssues, splitRowWithSpans } from "./parser";
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

    const originalArray = text.slice(table.start, table.end);
    const formattedArray = formatStringArrayTable(table, formatTable, arrayExtraIndent, tabSize, originalArray);
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
  tabSize: number,
  originalArray: string
): string {
  const sourceRows = table.rows.map((row) => row.decodedContent);
  const sourceTable = sourceRows.join("\n");
  const dataRows = sourceRows.filter((row) => row.trim() !== "" && !row.trimStart().startsWith("//"));
  const hasPipe = dataRows.some((row) => splitRowWithSpans(row).length > 1);
  if (!hasPipe || findTableIssues(sourceTable).length > 0) {
    return originalArray;
  }

  const formattedTable = formatTable(sourceTable, "");
  const formattedRows = toEscapedJavaStringArrayRows(formattedTable, tabSize);
  if (formattedRows.length === 0) {
    return "{}";
  }

  const maxRowWidth = Math.max(...formattedRows.map((row) => displayWidth(row, tabSize)));
  const rowIndent = table.indent + extraIndent;
  const rowLines = formattedRows.map((escapedRow, rowIndex) => {
    const rowWidth = displayWidth(escapedRow, tabSize);
    const trailingSpaces = " ".repeat(Math.max(maxRowWidth - rowWidth, 0));
    const literal = escapedRow + trailingSpaces;
    const suffix = rowIndex < formattedRows.length - 1 ? "," : "";
    return `${rowIndent}"${literal}"${suffix}`;
  });

  return ["{", ...rowLines, `${table.indent}}`].join("\n");
}

type EscapedArrayLine = {
  kind: "raw";
  text: string;
} | {
  kind: "data";
  cells: string[];
};

function toEscapedJavaStringArrayRows(formattedTable: string, tabSize: number): string[] {
  const lines = formattedTable.split("\n");
  const lineInfos: EscapedArrayLine[] = lines.map((line) => {
    if (line.trim() === "" || line.trimStart().startsWith("//")) {
      return { kind: "raw", text: escapeJavaStringLiteral(line) };
    }

    return {
      kind: "data",
      cells: splitRowWithSpans(line).map((cell) => escapeJavaStringLiteral(cell.text.trim()))
    };
  });

  const dataLines = lineInfos.flatMap((lineInfo) => (lineInfo.kind === "data" ? [lineInfo.cells] : []));
  const widths = calculateEscapedColumnWidths(dataLines, tabSize);

  return lineInfos.map((lineInfo) => {
    if (lineInfo.kind === "raw") {
      return lineInfo.text;
    }

    const formattedLine = lineInfo.cells.map((cell, columnIndex) => {
      const width = widths[columnIndex] ?? 0;
      const padding = Math.max(width - displayWidth(cell, tabSize), 0);
      return cell + " ".repeat(padding);
    }).join(" | ");

    return formattedLine;
  });
}

function calculateEscapedColumnWidths(rows: string[][], tabSize: number): number[] {
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const widths = new Array<number>(columnCount).fill(0);

  for (const row of rows) {
    row.forEach((cell, columnIndex) => {
      widths[columnIndex] = Math.max(widths[columnIndex] ?? 0, displayWidth(cell, tabSize));
    });
  }

  return widths;
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
