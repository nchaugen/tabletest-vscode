import {
  extractAnnotationTables,
  splitRowWithSpans
} from "./parser";
import type {
  AnnotationHostLanguage,
  CellSpan,
  ExtractedAnnotationTable,
  ExtractedTableStringArrayRow
} from "./parser";

type SupportedLanguage = "java" | "kotlin" | "tabletest";

export type AbsoluteSpan = {
  start: number;
  end: number;
};

export type TableHeaderTokenType = "tableHeader" | "tableQuestionHeader";

export type HeaderTokenSpan = AbsoluteSpan & {
  tokenType: TableHeaderTokenType;
};

type LineWithOffset = {
  text: string;
  startOffset: number;
};

export function collectTableHeaderTokenSpans(text: string, languageId: SupportedLanguage): HeaderTokenSpan[] {
  if (languageId === "tabletest") {
    return headerTokenSpansForTableText(text, 0);
  }

  const language: AnnotationHostLanguage = languageId === "kotlin" ? "kotlin" : "java";
  return extractAnnotationTables(text, language).flatMap((table) => headerTokenSpansForAnnotationTable(table));
}

function headerTokenSpansForAnnotationTable(table: ExtractedAnnotationTable): HeaderTokenSpan[] {
  if (table.kind === "textBlock") {
    return headerTokenSpansForTableText(table.content, table.start);
  }
  return headerTokenSpansForStringArray(table.rows);
}

function headerTokenSpansForTableText(tableText: string, baseOffset: number): HeaderTokenSpan[] {
  const lines = linesWithOffsets(tableText);
  const headerLine = firstHeaderLine(lines);
  if (!headerLine) {
    return [];
  }

  return headerCellSpans(headerLine.text)
    .map((span) => ({
      start: baseOffset + headerLine.startOffset + span.start,
      end: baseOffset + headerLine.startOffset + span.end,
      tokenType: span.tokenType
    }));
}

function headerTokenSpansForStringArray(rows: ExtractedTableStringArrayRow[]): HeaderTokenSpan[] {
  const headerRow = rows.find((row) => isHeaderCandidate(row.decodedContent));
  if (!headerRow) {
    return [];
  }

  return headerCellSpans(headerRow.decodedContent).flatMap((span) => {
    const start = headerRow.decodedContentSourceOffsets[span.start];
    const end = headerRow.decodedContentSourceOffsets[span.end];
    if (start === undefined || end === undefined || start >= end) {
      return [];
    }
    return [{ start, end, tokenType: span.tokenType }];
  });
}

function linesWithOffsets(text: string): LineWithOffset[] {
  const lines: LineWithOffset[] = [];
  let lineStart = 0;

  for (let index = 0; index <= text.length; index += 1) {
    const char = text[index];
    if (char !== "\n" && index !== text.length) {
      continue;
    }

    const rawLine = text.slice(lineStart, index);
    const textWithoutCr = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    lines.push({ text: textWithoutCr, startOffset: lineStart });
    lineStart = index + 1;
  }

  return lines;
}

function firstHeaderLine(lines: LineWithOffset[]): LineWithOffset | undefined {
  return lines.find((line) => isHeaderCandidate(line.text));
}

function isHeaderCandidate(line: string): boolean {
  if (line.trim() === "") {
    return false;
  }
  if (line.trimStart().startsWith("//")) {
    return false;
  }
  return splitRowWithSpans(line).length > 1;
}

function headerCellSpans(line: string): HeaderTokenSpan[] {
  return splitRowWithSpans(line).flatMap((cell) => {
    const span = trimmedCellSpan(cell);
    if (span === null) {
      return [];
    }
    return [{
      ...span,
      tokenType: cell.text.trimEnd().endsWith("?") ? "tableQuestionHeader" : "tableHeader"
    }];
  });
}

function trimmedCellSpan(cell: CellSpan): AbsoluteSpan | null {
  const leadingWhitespace = cell.text.length - cell.text.trimStart().length;
  const trailingWhitespace = cell.text.length - cell.text.trimEnd().length;
  const start = cell.start + leadingWhitespace;
  const end = cell.end - trailingWhitespace;

  if (start >= end) {
    return null;
  }

  return { start, end };
}
