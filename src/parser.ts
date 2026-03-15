export function formatTableString(tableText: string, baseIndent: string = "", tabSize: number = 4): string {
  // Normalize CRLF -> LF
  const text = tableText.replace(/\r\n?/g, "\n");

  const lines = text.split("\n");
  const isBlankLine = (line: string): boolean => line.trim() === "";
  const isCommentLine = (line: string): boolean => line.trimStart().startsWith("//");

  const dataLines = lines.filter((line) => !isBlankLine(line) && !isCommentLine(line));
  if (dataLines.length === 0) return tableText;
  const hasPipe = dataLines.some((line) => splitRow(line).length > 1);
  if (!hasPipe) return tableText;

  const issues = findTableIssues(text);
  if (issues.length > 0) return tableText;

  const leadingSpaces = dataLines.map((line) => {
    const match = line.match(/^\s*/);
    return match ? match[0].length : 0;
  });
  const minIndent = Math.min(...leadingSpaces);

  const strippedLines = lines.map((line) => {
    const leadingWhitespace = line.match(/^\s*/)?.[0].length ?? 0;
    const stripCount = Math.min(minIndent, leadingWhitespace);
    return line.slice(stripCount);
  });

  const lineInfos = strippedLines.map((line) => {
    if (isBlankLine(line) || isCommentLine(line)) {
      return { kind: "raw" as const, text: line, isComment: isCommentLine(line) };
    }
    const cells = splitRow(line).map((p) => formatCellValue(p));
    return { kind: "data" as const, cells };
  });

  // Parse rows into cells
  const rows = lineInfos.flatMap((info) => (info.kind === "data" ? [info.cells] : []));

  const lineStartColumn = displayWidth(baseIndent, tabSize);
  const { widths, starts } = calculateColumnLayout(rows, tabSize, lineStartColumn);

  // Build padded lines
  const formattedRows = rows.map((r) => {
    const cells = [] as string[];
    for (let i = 0; i < r.length; i++) {
      const cell = r[i] ?? "";
      const pad = Math.max((widths[i] ?? 0) - displayWidth(cell, tabSize, starts[i] ?? lineStartColumn), 0);
      cells.push(cell + " ".repeat(pad));
    }
    return cells.join(" | ");
  });

  let rowIndex = 0;
  const trimTrailingWhitespace = (value: string): string => value.replace(/[ \t]+$/g, "");
  const normaliseCommentIndent = (value: string): string => trimTrailingWhitespace(value.trimStart());
  const outLines = lineInfos.map((info) => {
    if (info.kind === "raw") {
      if (!info.isComment) {
        return info.text;
      }
      return normaliseCommentIndent(info.text);
    }
    const formatted = formattedRows[rowIndex];
    rowIndex += 1;
    return trimTrailingWhitespace(formatted);
  });

  const hasTrailingBlankLine = lines.length > 0 && lines[lines.length - 1]?.trim() === "";

  // Reapply base indentation only to non-blank lines so repeated formatting
  // does not accumulate whitespace on blank separator lines.
  // Keep trailing indentation before a closing triple quote aligned with the table.
  return outLines
    .map((line, index) => {
      if (line.trim() === "") {
        const isTrailingAlignmentLine = hasTrailingBlankLine && index === outLines.length - 1 && baseIndent !== "";
        return isTrailingAlignmentLine ? baseIndent : "";
      }
      return baseIndent + line;
    })
    .join("\n");
}

type QuoteChar = "'" | "\"";
export type CellSpan = {
  text: string;
  start: number;
  end: number;
};

export type TableIssue = {
  start: number;
  end: number;
  message: string;
};

type TableIssueKind =
  | "invalidCollectionSyntax"
  | "invalidUnquotedValue"
  | "invalidUnquotedMapKey";

type ValidationRole = "cellValue" | "collectionItem" | "mapKey";

type ValidationResult = {
  formatted: string | null;
  issueKind: TableIssueKind | null;
};

const invalidCollectionSyntaxMessage = "Invalid collection syntax in table cell; formatting skipped.";
const invalidUnquotedValueMessage =
  "Invalid unquoted value in table cell; quote values that would be parsed as collections or contain '|'.";
const invalidUnquotedMapKeyMessage =
  "Invalid unquoted map key in table cell; quote keys containing whitespace or reserved characters.";

function splitRow(line: string): string[] {
  return splitRowWithSpans(line).map((cell) => cell.text);
}

export function splitRowWithSpans(line: string): CellSpan[] {
  const cells: CellSpan[] = [];
  let current = "";
  let cellStart = 0;
  let inQuotedCell: QuoteChar | null = null;
  let escaped = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i] ?? "";
    if (inQuotedCell) {
      current += char;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === inQuotedCell) {
        inQuotedCell = null;
      }
      continue;
    }

    if ((char === "'" || char === "\"") && canStartQuotedSegment(line, i) && hasClosingQuoteAhead(line, i, char)) {
      inQuotedCell = char;
      current += char;
      continue;
    }

    if (char === "|") {
      cells.push({ text: current, start: cellStart, end: i });
      current = "";
      cellStart = i + 1;
      continue;
    }

    current += char;
  }

  cells.push({ text: current, start: cellStart, end: line.length });
  return cells;
}

function canStartQuotedSegment(line: string, index: number): boolean {
  for (let i = index - 1; i >= 0; i -= 1) {
    const char = line[i] ?? "";
    if (char === " " || char === "\t") continue;
    return char === "|" || char === "[" || char === "{" || char === "(" || char === "," || char === ":";
  }
  return true;
}

function hasClosingQuoteAhead(line: string, index: number, quote: QuoteChar): boolean {
  let escaped = false;
  for (let i = index + 1; i < line.length; i += 1) {
    const char = line[i] ?? "";
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === quote) {
      return true;
    }
  }
  return false;
}

export function findTableIssues(tableText: string): TableIssue[] {
  const lines = tableText.split("\n");
  const isBlankLine = (line: string): boolean => line.trim() === "";
  const isCommentLine = (line: string): boolean => line.trimStart().startsWith("//");
  const dataLines = lines.filter((line) => !isBlankLine(line) && !isCommentLine(line));
  if (dataLines.length === 0) return [];
  const hasPipe = dataLines.some((line) => splitRow(line).length > 1);
  if (!hasPipe) return [];

  const lineOffsets: number[] = [];
  let offset = 0;
  for (const line of lines) {
    lineOffsets.push(offset);
    offset += line.length + 1;
  }

  const issues: TableIssue[] = [];
  lines.forEach((line, lineIndex) => {
    if (isBlankLine(line) || isCommentLine(line)) return;

    const cells = splitRowWithSpans(line);
    cells.forEach((cell) => {
      const trimmed = cell.text.trim();
      if (trimmed === "") return;

      const validation = validateAndFormatValue(trimmed, "cellValue");
      if (validation.issueKind === null) return;

      const leadingWhitespace = cell.text.length - cell.text.trimStart().length;
      const trailingWhitespace = cell.text.length - cell.text.trimEnd().length;
      const startInLine = cell.start + leadingWhitespace;
      const endInLine = Math.max(startInLine + 1, cell.end - trailingWhitespace);

      issues.push({
        start: (lineOffsets[lineIndex] ?? 0) + startInLine,
        end: (lineOffsets[lineIndex] ?? 0) + endInLine,
        message: messageForIssueKind(validation.issueKind)
      });
    });
  });

  return issues;
}

function isCollectionValid(value: string): boolean {
  const formatted = formatCollection(value);
  return formatted !== null;
}

function formatCellValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  const validation = validateAndFormatValue(trimmed, "cellValue");
  return validation.formatted ?? trimmed;
}

function formatCollection(value: string): string | null {
  const validation = validateAndFormatCollection(value);
  return validation.formatted;
}

function validateAndFormatCollection(value: string): ValidationResult {
  if (value.length < 2) return invalidValidation("invalidCollectionSyntax");
  const first = value[0];
  const last = value[value.length - 1];
  if (first === "[" && last === "]") {
    return validateAndFormatBracketedCollection(value, "[", "]");
  }
  if (first === "{" && last === "}") {
    return validateAndFormatBracketedCollection(value, "{", "}");
  }
  return invalidValidation("invalidCollectionSyntax");
}

function validateAndFormatBracketedCollection(
  value: string,
  open: "[" | "{",
  close: "]" | "}"
): ValidationResult {
  const inner = value.slice(1, -1);
  const trimmedInner = inner.trim();
  if (open === "[" && inner === ":") {
    return validValidation("[:]");
  }
  if (trimmedInner === "") {
    return validValidation(`${open}${close}`);
  }
  const parts = splitTopLevel(inner, ",");
  if (!parts) return invalidValidation("invalidCollectionSyntax");
  const items = parts.map((part) => part.trim());

  const mapSplits = items.map((item) => splitTopLevel(item, ":"));
  const hasMapEntry = mapSplits.some((split) => split !== null && split.length === 2);

  if (!hasMapEntry) {
    if (items.some(hasAmbiguousBareColonValue)) return invalidValidation("invalidCollectionSyntax");
    if (items.some((item) => item === "")) return invalidValidation("invalidCollectionSyntax");

    const formattedItems: string[] = [];
    for (const item of items) {
      const validation = validateAndFormatValue(item, "collectionItem");
      if (validation.issueKind !== null || validation.formatted === null) {
        return invalidValidation(validation.issueKind ?? "invalidCollectionSyntax");
      }
      formattedItems.push(validation.formatted);
    }
    return validValidation(`${open}${formattedItems.join(", ")}${close}`);
  }

  if (mapSplits.some((split) => split === null || split.length !== 2)) {
    return invalidValidation("invalidCollectionSyntax");
  }

  const formattedEntries = mapSplits.map((split): ValidationResult => {
    const key = split?.[0]?.trim() ?? "";
    const valuePart = split?.[1]?.trim() ?? "";
    if (key === "" || valuePart === "") return invalidValidation("invalidCollectionSyntax");

    const formattedKey = validateAndFormatValue(key, "mapKey");
    if (formattedKey.issueKind !== null || formattedKey.formatted === null) {
      return invalidValidation(formattedKey.issueKind ?? "invalidUnquotedMapKey");
    }

    const formattedValue = validateAndFormatValue(valuePart, "collectionItem");
    if (formattedValue.issueKind !== null || formattedValue.formatted === null || formattedValue.formatted === "") {
      return invalidValidation(formattedValue.issueKind ?? "invalidCollectionSyntax");
    }

    return validValidation(`${formattedKey.formatted}: ${formattedValue.formatted}`);
  });

  const firstInvalidEntry = formattedEntries.find((entry) => entry.issueKind !== null);
  if (firstInvalidEntry) {
    return invalidValidation(firstInvalidEntry.issueKind ?? "invalidCollectionSyntax");
  }

  return validValidation(
    `${open}${formattedEntries
      .map((entry) => entry.formatted)
      .filter((entry): entry is string => entry !== null)
      .join(", ")}${close}`
  );
}

function validateAndFormatValue(value: string, role: ValidationRole): ValidationResult {
  const trimmed = value.trim();
  if (trimmed === "") {
    return role === "cellValue" ? validValidation("") : invalidValidation("invalidCollectionSyntax");
  }
  if (isQuotedString(trimmed)) {
    return validValidation(trimmed);
  }
  if (role === "mapKey") {
    return isValidUnquotedMapKey(trimmed)
      ? validValidation(trimmed)
      : invalidValidation("invalidUnquotedMapKey");
  }
  if (looksLikeBrokenQuotedString(trimmed)) {
    return invalidValidation("invalidUnquotedValue");
  }

  const collectionValidation = validateAndFormatCollection(trimmed);
  if (collectionValidation.formatted !== null) {
    return collectionValidation;
  }
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    return invalidValidation(collectionValidation.issueKind ?? "invalidCollectionSyntax");
  }

  return isValidUnquotedValue(trimmed, role)
    ? validValidation(trimmed)
    : invalidValidation("invalidUnquotedValue");
}

function isQuotedString(value: string): boolean {
  if (value.length < 2) return false;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first !== "'" && first !== "\"") || last !== first) return false;

  let escaped = false;
  for (let i = 1; i < value.length - 1; i += 1) {
    const char = value[i] ?? "";
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === first) {
      return false;
    }
  }

  return !escaped;
}

function isValidUnquotedValue(value: string, role: Exclude<ValidationRole, "mapKey">): boolean {
  if (role === "cellValue") {
    return !/\|/.test(value);
  }

  return !/[,\|]/.test(value) && !hasAmbiguousBareColonValue(value);
}

function isValidUnquotedMapKey(value: string): boolean {
  return value.trim() === value && !/[\s,:|\[\]\{\}'"]/.test(value);
}

function looksLikeBrokenQuotedString(value: string): boolean {
  if (value.length < 2) return false;
  const first = value[0];
  const last = value[value.length - 1];
  return (first === "'" || first === "\"") && last === first && !isQuotedString(value);
}

function hasAmbiguousBareColonValue(value: string): boolean {
  const openerToCloser = { "[": "]", "{": "}", "(": ")" } as const;
  const closers = new Set(Object.values(openerToCloser));
  const isOpener = (candidate: string): candidate is "[" | "{" | "(" =>
    Object.prototype.hasOwnProperty.call(openerToCloser, candidate);
  const isCloser = (candidate: string): candidate is "]" | "}" | ")" => closers.has(candidate as "]" | "}" | ")");

  const hasWhitespace = (candidate: string): boolean => candidate === " " || candidate === "\t";

  const stack: string[] = [];
  let quote: QuoteChar | null = null;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? "";

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }

    if (isOpener(char)) {
      stack.push(openerToCloser[char]);
      continue;
    }

    if (isCloser(char)) {
      const expected = stack[stack.length - 1];
      if (expected === char) {
        stack.pop();
      }
      continue;
    }

    if (char === ":" && stack.length === 0) {
      const previous = value[index - 1] ?? "";
      const next = value[index + 1] ?? "";
      if (hasWhitespace(previous) || hasWhitespace(next)) {
        return true;
      }
    }
  }

  return false;
}

function validValidation(formatted: string): ValidationResult {
  return {
    formatted,
    issueKind: null
  };
}

function invalidValidation(issueKind: TableIssueKind): ValidationResult {
  return {
    formatted: null,
    issueKind
  };
}

function messageForIssueKind(issueKind: TableIssueKind): string {
  switch (issueKind) {
    case "invalidUnquotedValue":
      return invalidUnquotedValueMessage;
    case "invalidUnquotedMapKey":
      return invalidUnquotedMapKeyMessage;
    case "invalidCollectionSyntax":
      return invalidCollectionSyntaxMessage;
  }
}

function splitTopLevel(text: string, separator: "," | ":"): string[] | null {
  const parts: string[] = [];
  let current = "";
  const stack: string[] = [];
  let quote: QuoteChar | null = null;
  let escaped = false;

  const openerToCloser = { "[": "]", "{": "}", "(": ")" } as const;
  const closers = new Set(Object.values(openerToCloser));
  const isOpener = (value: string): value is "[" | "{" | "(" => Object.prototype.hasOwnProperty.call(openerToCloser, value);
  const isCloser = (value: string): value is "]" | "}" | ")" => closers.has(value as "]" | "}" | ")");

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] ?? "";
    if (quote) {
      current += char;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "'" || char === "\"") {
      quote = char;
      current += char;
      continue;
    }

    if (isOpener(char)) {
      stack.push(openerToCloser[char]);
      current += char;
      continue;
    }

    if (isCloser(char)) {
      const expected = stack.pop();
      if (expected !== char) return null;
      current += char;
      continue;
    }

    if (char === separator && stack.length === 0) {
      parts.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (quote || stack.length > 0) return null;
  parts.push(current);
  return parts;
}

type ColumnLayout = {
  widths: number[];
  starts: number[];
};

function calculateColumnLayout(rows: string[][], tabSize: number, lineStartColumn: number): ColumnLayout {
  const colCount = Math.max(...rows.map((row) => row.length));
  const widths: number[] = new Array(colCount).fill(0);
  const starts: number[] = new Array(colCount).fill(lineStartColumn);

  let currentColumnStart = lineStartColumn;
  for (let columnIndex = 0; columnIndex < colCount; columnIndex += 1) {
    starts[columnIndex] = currentColumnStart;

    let maxWidth = 0;
    for (const row of rows) {
      const cell = row[columnIndex];
      if (cell === undefined) continue;
      maxWidth = Math.max(maxWidth, displayWidth(cell, tabSize, currentColumnStart));
    }

    widths[columnIndex] = maxWidth;
    currentColumnStart += maxWidth + 3;
  }

  return { widths, starts };
}

export function displayWidth(value: string, tabSize: number = 4, startColumn: number = 0): number {
  const resolvedTabSize = Number.isFinite(tabSize) ? Math.max(1, Math.floor(tabSize)) : 4;
  const resolvedStartColumn = Number.isFinite(startColumn) ? Math.max(0, Math.floor(startColumn)) : 0;
  const graphemes = splitGraphemes(value);
  let column = resolvedStartColumn;
  for (const grapheme of graphemes) {
    if (grapheme === "\t") {
      column += tabAdvance(column, resolvedTabSize);
      continue;
    }
    column += displayWidthForGrapheme(grapheme);
  }
  return column - resolvedStartColumn;
}

type GraphemeSegment = {
  segment: string;
};

type GraphemeSegmenter = {
  segment(value: string): Iterable<GraphemeSegment>;
};

const segmenterConstructor = (Intl as unknown as {
  Segmenter?: new (
    locales?: string | string[],
    options?: { granularity?: "grapheme" | "word" | "sentence" }
  ) => GraphemeSegmenter;
}).Segmenter;

const graphemeSegmenter: GraphemeSegmenter | null = segmenterConstructor
  ? new segmenterConstructor(undefined, { granularity: "grapheme" })
  : null;

function splitGraphemes(value: string): string[] {
  if (!graphemeSegmenter) {
    return Array.from(value);
  }

  const segments = graphemeSegmenter.segment(value);
  const graphemes: string[] = [];
  for (const segment of segments) {
    graphemes.push(segment.segment);
  }
  return graphemes;
}

function displayWidthForGrapheme(grapheme: string): number {
  const codePoints = Array.from(grapheme)
    .map((char) => char.codePointAt(0))
    .filter((codePoint): codePoint is number => codePoint !== undefined);

  if (codePoints.length === 0) return 0;
  if (isEmojiGrapheme(grapheme, codePoints)) {
    return 2;
  }

  let width = 0;
  for (const codePoint of codePoints) {
    if (isInvisibleCodePoint(codePoint)) continue;
    width += isFullWidthCodePoint(codePoint) ? 2 : 1;
  }

  return width;
}

function tabAdvance(column: number, tabSize: number): number {
  const remainder = column % tabSize;
  return remainder === 0 ? tabSize : tabSize - remainder;
}

function isEmojiGrapheme(grapheme: string, codePoints: number[]): boolean {
  if (isKeycapSequence(codePoints)) {
    return true;
  }
  if (codePoints.some((codePoint) => isRegionalIndicator(codePoint))) {
    return true;
  }
  if (grapheme.includes("\u200d") && containsEmojiCodePoint(grapheme)) {
    return true;
  }
  if (codePoints.some((codePoint) => isEmojiModifier(codePoint))) {
    return true;
  }
  if (containsEmojiPresentationCodePoint(grapheme)) {
    return true;
  }
  if (hasEmojiVariationSelector(codePoints) && containsExtendedPictographicCodePoint(grapheme)) {
    return true;
  }
  return false;
}

function containsEmojiCodePoint(value: string): boolean {
  return containsExtendedPictographicCodePoint(value) || containsEmojiPresentationCodePoint(value);
}

function containsExtendedPictographicCodePoint(value: string): boolean {
  return extendedPictographic.test(value);
}

function containsEmojiPresentationCodePoint(value: string): boolean {
  return emojiPresentation.test(value);
}

function hasEmojiVariationSelector(codePoints: number[]): boolean {
  return codePoints.includes(0xfe0f);
}

function isInvisibleCodePoint(codePoint: number): boolean {
  return (
    isControlCodePoint(codePoint) ||
    isZeroWidth(codePoint) ||
    isEmojiModifier(codePoint) ||
    isTagCodePoint(codePoint)
  );
}

function isControlCodePoint(codePoint: number): boolean {
  return (
    ((codePoint >= 0x0000 && codePoint <= 0x001f) && codePoint !== 0x0009) ||
    (codePoint >= 0x007f && codePoint <= 0x009f)
  );
}

function isZeroWidth(codePoint: number): boolean {
  return (
    isCombiningMark(codePoint) ||
    codePoint === 0x200b || // zero width space
    codePoint === 0x200c || // zero width non-joiner
    codePoint === 0x200d || // zero width joiner
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) || // variation selectors
    (codePoint >= 0xe0100 && codePoint <= 0xe01ef) // variation selectors supplement
  );
}

const nonSpacingMark = /\p{Nonspacing_Mark}/u;
const enclosingMark = /\p{Enclosing_Mark}/u;

function isCombiningMark(codePoint: number): boolean {
  const value = String.fromCodePoint(codePoint);
  return nonSpacingMark.test(value) || enclosingMark.test(value);
}

function isEmojiModifier(codePoint: number): boolean {
  return codePoint >= 0x1f3fb && codePoint <= 0x1f3ff;
}

function isTagCodePoint(codePoint: number): boolean {
  return codePoint >= 0xe0020 && codePoint <= 0xe007f;
}

function isRegionalIndicator(codePoint: number): boolean {
  return codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff;
}

function isKeycapSequence(codePoints: number[]): boolean {
  if (!codePoints.includes(0x20e3)) {
    return false;
  }

  const first = codePoints[0] ?? -1;
  return (first >= 0x30 && first <= 0x39) || first === 0x23 || first === 0x2a;
}

function isFullWidthCodePoint(codePoint: number): boolean {
  if (codePoint >= 0x2500 && codePoint <= 0x259f) {
    return false;
  }
  return (
    codePoint >= 0x1100 &&
    (codePoint <= 0x115f ||
      codePoint === 0x2329 ||
      codePoint === 0x232a ||
      (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
      (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
      (codePoint >= 0xff00 && codePoint <= 0xff60) ||
      (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
      (codePoint >= 0x1f300 && codePoint <= 0x1f64f) ||
      (codePoint >= 0x1f900 && codePoint <= 0x1f9ff) ||
      (codePoint >= 0x20000 && codePoint <= 0x3fffd))
  );
}

const extendedPictographic = /\p{Extended_Pictographic}/u;
const emojiPresentation = /\p{Emoji_Presentation}/u;

type ExtractedTripleQuotedTable = {
  start: number;
  end: number;
  content: string;
  indent: string;
};

export type ExtractedTableTextBlock = {
  kind: "textBlock";
  start: number;
  end: number;
  content: string;
  indent: string;
};

export type ExtractedTableStringArrayRow = {
  content: string;
  start: number;
  end: number;
  decodedContent: string;
  decodedContentSourceOffsets: number[];
};

export type ExtractedTableStringArray = {
  kind: "stringArray";
  start: number;
  end: number;
  indent: string;
  rows: ExtractedTableStringArrayRow[];
};

export type ExtractedAnnotationTable = ExtractedTableTextBlock | ExtractedTableStringArray;

type Range = {
  start: number;
  end: number;
};

const tripleQuote = "\"\"\"";
export type AnnotationHostLanguage = "java" | "kotlin";

export function extractAnnotationTables(
  text: string,
  language: AnnotationHostLanguage = "java"
): ExtractedAnnotationTable[] {
  const results: ExtractedAnnotationTable[] = [];
  let searchIndex = 0;

  while (searchIndex < text.length) {
    const annotation = findNextTableTestAnnotation(text, searchIndex, language);
    if (!annotation) break;

    const annotationStart = annotation.start;
    const annotationNameEnd = annotation.end;

    const openParenIndex = skipWhitespaceAndComments(text, annotationNameEnd, text.length);
    if ((text[openParenIndex] ?? "") !== "(") {
      searchIndex = annotationNameEnd;
      continue;
    }

    const closeParenIndex = findMatchingParenthesis(text, openParenIndex, language);
    if (closeParenIndex < 0) {
      searchIndex = annotationNameEnd;
      continue;
    }

    const argumentStart = openParenIndex + 1;
    const argumentEnd = closeParenIndex;
    const table = extractTableFromArguments(text, argumentStart, argumentEnd, language);
    if (table) {
      results.push(table);
    }

    searchIndex = closeParenIndex + 1;
  }

  return results;
}

function findNextTableTestAnnotation(
  text: string,
  searchIndex: number,
  language: AnnotationHostLanguage
): { start: number; end: number } | null {
  const pattern =
    language === "java"
      ? /@(?:[\w$]+\.)*TableTest(?![\w$])/g
      : /@TableTest(?![\w$])/g;

  pattern.lastIndex = searchIndex;
  const match = pattern.exec(text);
  if (!match) {
    return null;
  }

  const start = match.index;
  return {
    start,
    end: start + match[0].length
  };
}

export function extractTripleQuotedTables(
  text: string,
  language: AnnotationHostLanguage = "java"
): ExtractedTripleQuotedTable[] {
  return extractAnnotationTables(text, language).flatMap((table) => {
    if (table.kind !== "textBlock") {
      return [];
    }
    return [{ start: table.start, end: table.end, content: table.content, indent: table.indent }];
  });
}

function extractTableFromArguments(
  text: string,
  start: number,
  end: number,
  language: AnnotationHostLanguage
): ExtractedAnnotationTable | null {
  const argumentsRanges = splitTopLevelArguments(text, start, end, language);
  let implicitValue: ExtractedAnnotationTable | null = null;
  let namedArgumentSeen = false;
  let positionalArgumentCount = 0;

  for (const range of argumentsRanges) {
    const expressionStart = skipWhitespaceAndComments(text, range.start, range.end);
    if (expressionStart >= range.end) {
      continue;
    }

    const equalsIndex = findTopLevelEquals(text, expressionStart, range.end, language);
    if (equalsIndex >= 0) {
      namedArgumentSeen = true;
      const leftHandSide = text.slice(expressionStart, equalsIndex).trim();
      if (leftHandSide === "value") {
        const valueStart = skipWhitespaceAndComments(text, equalsIndex + 1, range.end);
        const namedValue = parseDirectTableValue(text, valueStart, range.end, language);
        if (namedValue) {
          return namedValue;
        }
      }
      continue;
    }

    positionalArgumentCount += 1;
    if (!implicitValue) {
      const positionalValue = parseDirectTableValue(text, expressionStart, range.end, language);
      if (positionalValue && positionalValue.kind === "stringArray") {
        implicitValue = { ...positionalValue, start: range.start, end: range.end };
      } else {
        implicitValue = positionalValue;
      }
    }
  }

  // In Java/Kotlin annotation usage, implicit value is only reliable when it is
  // the sole positional argument and no named arguments are present.
  if (namedArgumentSeen || positionalArgumentCount !== 1) {
    return null;
  }

  return implicitValue;
}

function parseDirectTableValue(
  text: string,
  valueStart: number,
  limit: number,
  language: AnnotationHostLanguage
): ExtractedAnnotationTable | null {
  const textBlock = parseTripleQuotedValue(text, valueStart, limit, language);
  if (textBlock) {
    return textBlock;
  }
  return parseStaticStringArrayValue(text, valueStart, limit, language);
}

function parseTripleQuotedValue(
  text: string,
  quoteStart: number,
  limit: number,
  language: AnnotationHostLanguage
): ExtractedTableTextBlock | null {
  if (!text.startsWith(tripleQuote, quoteStart)) return null;
  const quoteEnd = findClosingTripleQuote(text, quoteStart, limit, language);
  if (quoteEnd < 0 || quoteEnd > limit) return null;
  const trailingStart = quoteEnd + tripleQuote.length;
  if (skipWhitespaceAndComments(text, trailingStart, limit) !== limit) return null;

  const contentStart = quoteStart + tripleQuote.length;
  const content = text.slice(contentStart, quoteEnd);
  const lineStart = text.lastIndexOf("\n", quoteStart) + 1;
  const indent = text.slice(lineStart, quoteStart).match(/^\s*/)?.[0] ?? "";
  return { kind: "textBlock", start: contentStart, end: quoteEnd, content, indent };
}

function parseStaticStringArrayValue(
  text: string,
  arrayStart: number,
  limit: number,
  language: AnnotationHostLanguage
): ExtractedTableStringArray | null {
  if (language !== "java") {
    return null;
  }
  if ((text[arrayStart] ?? "") !== "{") {
    return null;
  }

  const closeBraceIndex = findMatchingBrace(text, arrayStart, limit, language);
  if (closeBraceIndex < 0 || closeBraceIndex >= limit) {
    return null;
  }
  if (skipWhitespaceAndComments(text, closeBraceIndex + 1, limit) !== limit) {
    return null;
  }

  const rows: ExtractedTableStringArrayRow[] = [];
  let index = arrayStart + 1;
  while (index < closeBraceIndex) {
    index = skipWhitespaceAndComments(text, index, closeBraceIndex);
    if (index >= closeBraceIndex) {
      break;
    }

    if ((text[index] ?? "") !== "\"") {
      return null;
    }

    const literalEnd = skipQuotedString(text, index, "\"", closeBraceIndex + 1);
    if (literalEnd > closeBraceIndex + 1) {
      return null;
    }
    const closingQuoteIndex = literalEnd - 1;
    if (closingQuoteIndex <= index || (text[closingQuoteIndex] ?? "") !== "\"") {
      return null;
    }

    rows.push({
      content: text.slice(index + 1, closingQuoteIndex),
      start: index + 1,
      end: closingQuoteIndex,
      ...decodeJavaStringLiteralContent(text.slice(index + 1, closingQuoteIndex), index + 1)
    });

    index = skipWhitespaceAndComments(text, literalEnd, closeBraceIndex);
    if (index >= closeBraceIndex) {
      break;
    }
    if ((text[index] ?? "") !== ",") {
      return null;
    }
    index += 1;
  }

  if (rows.length === 0) {
    return null;
  }

  return {
    kind: "stringArray",
    start: arrayStart,
    end: closeBraceIndex + 1,
    indent: lineLeadingIndentAt(text, arrayStart),
    rows
  };
}

function decodeJavaStringLiteralContent(
  rawContent: string,
  sourceStartOffset: number
): {
  decodedContent: string;
  decodedContentSourceOffsets: number[];
} {
  let decodedContent = "";
  const decodedContentSourceOffsets: number[] = [sourceStartOffset];
  let index = 0;

  while (index < rawContent.length) {
    const char = rawContent[index] ?? "";
    if (char !== "\\") {
      decodedContent += char;
      index += 1;
      decodedContentSourceOffsets.push(sourceStartOffset + index);
      continue;
    }

    const escaped = decodeEscapedJavaCharacter(rawContent, index);
    if (!escaped) {
      decodedContent += "\\";
      index += 1;
      decodedContentSourceOffsets.push(sourceStartOffset + index);
      continue;
    }

    decodedContent += escaped.value;
    index = escaped.nextIndex;
    decodedContentSourceOffsets.push(sourceStartOffset + index);
  }

  return { decodedContent, decodedContentSourceOffsets };
}

type DecodedJavaEscape = {
  value: string;
  nextIndex: number;
};

function decodeEscapedJavaCharacter(rawContent: string, backslashIndex: number): DecodedJavaEscape | null {
  const nextChar = rawContent[backslashIndex + 1] ?? "";
  if (nextChar === "") {
    return null;
  }

  switch (nextChar) {
    case "b":
      return { value: "\b", nextIndex: backslashIndex + 2 };
    case "f":
      return { value: "\f", nextIndex: backslashIndex + 2 };
    case "n":
      return { value: "\n", nextIndex: backslashIndex + 2 };
    case "r":
      return { value: "\r", nextIndex: backslashIndex + 2 };
    case "t":
      return { value: "\t", nextIndex: backslashIndex + 2 };
    case "\"":
      return { value: "\"", nextIndex: backslashIndex + 2 };
    case "'":
      return { value: "'", nextIndex: backslashIndex + 2 };
    case "\\":
      return { value: "\\", nextIndex: backslashIndex + 2 };
    default:
      break;
  }

  if (nextChar === "u") {
    const decodedUnicode = decodeUnicodeJavaEscape(rawContent, backslashIndex);
    if (decodedUnicode) {
      return decodedUnicode;
    }
  }

  if (isOctalDigit(nextChar)) {
    const decodedOctal = decodeOctalJavaEscape(rawContent, backslashIndex);
    if (decodedOctal) {
      return decodedOctal;
    }
  }

  return null;
}

function decodeUnicodeJavaEscape(rawContent: string, backslashIndex: number): DecodedJavaEscape | null {
  let cursor = backslashIndex + 1;
  while ((rawContent[cursor] ?? "") === "u") {
    cursor += 1;
  }

  const hexDigits = rawContent.slice(cursor, cursor + 4);
  if (!/^[0-9a-fA-F]{4}$/.test(hexDigits)) {
    return null;
  }

  const codeUnit = Number.parseInt(hexDigits, 16);
  return {
    value: String.fromCharCode(codeUnit),
    nextIndex: cursor + 4
  };
}

function decodeOctalJavaEscape(rawContent: string, backslashIndex: number): DecodedJavaEscape | null {
  const firstDigit = rawContent[backslashIndex + 1] ?? "";
  if (!isOctalDigit(firstDigit)) {
    return null;
  }

  let cursor = backslashIndex + 2;
  const maxDigits = firstDigit <= "3" ? 3 : 2;
  while (cursor < rawContent.length) {
    const currentChar = rawContent[cursor] ?? "";
    const digitsConsumed = cursor - (backslashIndex + 1);
    if (digitsConsumed >= maxDigits || !isOctalDigit(currentChar)) {
      break;
    }
    cursor += 1;
  }

  const octalDigits = rawContent.slice(backslashIndex + 1, cursor);
  const codeUnit = Number.parseInt(octalDigits, 8);
  if (!Number.isFinite(codeUnit)) {
    return null;
  }

  return {
    value: String.fromCharCode(codeUnit),
    nextIndex: cursor
  };
}

function isOctalDigit(char: string): boolean {
  return char >= "0" && char <= "7";
}

function lineLeadingIndentAt(text: string, offset: number): string {
  const lineStart = text.lastIndexOf("\n", offset) + 1;
  return text.slice(lineStart, offset).match(/^\s*/)?.[0] ?? "";
}

function findMatchingBrace(
  text: string,
  openBraceIndex: number,
  limit: number,
  language: AnnotationHostLanguage
): number {
  let depth = 1;
  let index = openBraceIndex + 1;

  while (index < limit) {
    if (text.startsWith(tripleQuote, index)) {
      index = skipTripleQuotedString(text, index, limit, language);
      continue;
    }
    if (text.startsWith("//", index)) {
      index = skipLineComment(text, index + 2, limit);
      continue;
    }

    const char = text[index] ?? "";
    if (char === "\"" || char === "'") {
      index = skipQuotedString(text, index, char as QuoteChar, limit);
      continue;
    }
    if (char === "{") {
      depth += 1;
      index += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
      index += 1;
      continue;
    }

    index += 1;
  }

  return -1;
}

function splitTopLevelArguments(text: string, start: number, end: number, language: AnnotationHostLanguage): Range[] {
  const ranges: Range[] = [];
  let argumentStart = start;

  const stack: string[] = [];
  let index = start;
  while (index < end) {
    if (text.startsWith(tripleQuote, index)) {
      index = skipTripleQuotedString(text, index, end, language);
      continue;
    }
    if (text.startsWith("//", index)) {
      index = skipLineComment(text, index + 2, end);
      continue;
    }

    const char = text[index] ?? "";
    if (char === "\"" || char === "'") {
      index = skipQuotedString(text, index, char as QuoteChar, end);
      continue;
    }
    if (char === "(" || char === "[" || char === "{") {
      stack.push(char);
      index += 1;
      continue;
    }
    if (char === ")" || char === "]" || char === "}") {
      if (stack.length > 0) {
        stack.pop();
      }
      index += 1;
      continue;
    }
    if (char === "," && stack.length === 0) {
      ranges.push({ start: argumentStart, end: index });
      argumentStart = index + 1;
      index += 1;
      continue;
    }
    index += 1;
  }

  if (argumentStart < end) {
    ranges.push({ start: argumentStart, end });
  }

  return ranges;
}

function findTopLevelEquals(text: string, start: number, end: number, language: AnnotationHostLanguage): number {
  const stack: string[] = [];
  let index = start;

  while (index < end) {
    if (text.startsWith(tripleQuote, index)) {
      index = skipTripleQuotedString(text, index, end, language);
      continue;
    }
    if (text.startsWith("//", index)) {
      index = skipLineComment(text, index + 2, end);
      continue;
    }

    const char = text[index] ?? "";
    if (char === "\"" || char === "'") {
      index = skipQuotedString(text, index, char as QuoteChar, end);
      continue;
    }
    if (char === "(" || char === "[" || char === "{") {
      stack.push(char);
      index += 1;
      continue;
    }
    if (char === ")" || char === "]" || char === "}") {
      if (stack.length > 0) {
        stack.pop();
      }
      index += 1;
      continue;
    }
    if (char === "=" && stack.length === 0) {
      return index;
    }
    index += 1;
  }

  return -1;
}

function findMatchingParenthesis(text: string, openParenIndex: number, language: AnnotationHostLanguage): number {
  let depth = 1;
  let index = openParenIndex + 1;

  while (index < text.length) {
    if (text.startsWith(tripleQuote, index)) {
      index = skipTripleQuotedString(text, index, text.length, language);
      continue;
    }
    if (text.startsWith("//", index)) {
      index = skipLineComment(text, index + 2, text.length);
      continue;
    }

    const char = text[index] ?? "";
    if (char === "\"" || char === "'") {
      index = skipQuotedString(text, index, char as QuoteChar, text.length);
      continue;
    }
    if (char === "(") {
      depth += 1;
      index += 1;
      continue;
    }
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
      index += 1;
      continue;
    }
    index += 1;
  }

  return -1;
}

function skipWhitespaceAndComments(text: string, start: number, end: number): number {
  let index = start;
  while (index < end) {
    const char = text[index] ?? "";
    if (char === " " || char === "\t" || char === "\n" || char === "\r") {
      index += 1;
      continue;
    }
    if (text.startsWith("//", index)) {
      index = skipLineComment(text, index + 2, end);
      continue;
    }
    break;
  }
  return index;
}

function skipLineComment(text: string, start: number, end: number): number {
  let index = start;
  while (index < end && (text[index] ?? "") !== "\n") {
    index += 1;
  }
  return index;
}

function skipQuotedString(text: string, start: number, quote: QuoteChar, end: number): number {
  let index = start + 1;
  while (index < end) {
    const char = text[index] ?? "";
    if (char === "\\") {
      index += 2;
      continue;
    }
    if (char === quote) {
      return index + 1;
    }
    index += 1;
  }
  return end;
}

function skipTripleQuotedString(text: string, start: number, end: number, language: AnnotationHostLanguage): number {
  const closeIndex = findClosingTripleQuote(text, start, end, language);
  if (closeIndex < 0 || closeIndex + tripleQuote.length > end) return end;
  return closeIndex + tripleQuote.length;
}

function findClosingTripleQuote(
  text: string,
  quoteStart: number,
  limit: number,
  language: AnnotationHostLanguage
): number {
  let searchIndex = quoteStart + tripleQuote.length;
  while (searchIndex < limit) {
    const closeIndex = text.indexOf(tripleQuote, searchIndex);
    if (closeIndex < 0 || closeIndex + tripleQuote.length > limit) {
      return -1;
    }
    if (isTripleQuoteTerminator(text, closeIndex, language)) {
      return closeIndex;
    }
    searchIndex = closeIndex + 1;
  }
  return -1;
}

function isTripleQuoteTerminator(text: string, quoteStart: number, language: AnnotationHostLanguage): boolean {
  if (language === "kotlin") {
    return true;
  }
  return !hasOddTrailingBackslashCount(text, quoteStart);
}

function hasOddTrailingBackslashCount(text: string, index: number): boolean {
  let backslashCount = 0;
  let cursor = index - 1;
  while (cursor >= 0 && (text[cursor] ?? "") === "\\") {
    backslashCount += 1;
    cursor -= 1;
  }
  return backslashCount % 2 === 1;
}

function isIdentifierCharacter(value: string): boolean {
  if (value === "") return false;
  const codePoint = value.charCodeAt(0);
  return (
    (codePoint >= 48 && codePoint <= 57) ||
    (codePoint >= 65 && codePoint <= 90) ||
    (codePoint >= 97 && codePoint <= 122) ||
    codePoint === 95
  );
}
