export function formatTableString(tableText: string, baseIndent: string = ""): string {
  // Normalize CRLF -> LF
  const text = tableText.replace(/\r\n?/g, "\n");

  const leadingNewline = text.startsWith("\n");
  const trailingNewline = text.endsWith("\n");

  const lines = text.split("\n");
  const isBlankLine = (line: string): boolean => line.trim() === "";
  const isCommentLine = (line: string): boolean => line.trimStart().startsWith("//");

  const dataLines = lines.filter((line) => !isBlankLine(line) && !isCommentLine(line));
  if (dataLines.length === 0) return tableText;
  const hasPipe = dataLines.some((line) => splitRow(line).length > 1);
  if (!hasPipe) return tableText;
  if (!isTableValid(dataLines)) return tableText;

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
      return { kind: "raw" as const, text: line };
    }
    const cells = splitRow(line).map((p) => formatCellValue(p));
    return { kind: "data" as const, cells };
  });

  // Parse rows into cells
  const rows = lineInfos.flatMap((info) => (info.kind === "data" ? [info.cells] : []));

  // Compute column widths based on columns that exist in each row
  const colCount = Math.max(...rows.map((r) => r.length));
  const widths: number[] = new Array(colCount).fill(0);
  rows.forEach((r) => {
    for (let i = 0; i < r.length; i++) {
      const cell = r[i] ?? "";
      widths[i] = Math.max(widths[i] ?? 0, displayWidth(cell));
    }
  });

  // Build padded lines
  const formattedRows = rows.map((r) => {
    const cells = [] as string[];
    for (let i = 0; i < r.length; i++) {
      const cell = r[i] ?? "";
      const pad = Math.max(widths[i] - displayWidth(cell), 0);
      cells.push(cell + " ".repeat(pad));
    }
    return cells.join(" | ");
  });

  let rowIndex = 0;
  const trimTrailingWhitespace = (value: string): string => value.replace(/[ \t]+$/g, "");
  const outLines = lineInfos.map((info) => {
    if (info.kind === "raw") return info.text;
    const formatted = formattedRows[rowIndex];
    rowIndex += 1;
    return trimTrailingWhitespace(formatted);
  });

  // reapply base indentation and leading/trailing newlines
  const reindented = outLines.map((l) => baseIndent + l).join("\n");
  return (leadingNewline ? "\n" : "") + reindented + (trailingNewline ? "\n" : "");
}

type QuoteChar = "'" | "\"";

function splitRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotedCell: QuoteChar | null = null;
  let sawNonWhitespace = false;

  const isWhitespace = (value: string): boolean => value === " " || value === "\t";

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i] ?? "";
    if (inQuotedCell) {
      current += char;
      if (char === inQuotedCell) {
        inQuotedCell = null;
      }
      continue;
    }

    if (char === "|") {
      cells.push(current);
      current = "";
      sawNonWhitespace = false;
      continue;
    }

    if (!sawNonWhitespace && (char === "'" || char === "\"")) {
      if (line.indexOf(char, i + 1) !== -1) {
        inQuotedCell = char;
      }
      sawNonWhitespace = true;
      current += char;
      continue;
    }

    if (!sawNonWhitespace && !isWhitespace(char)) {
      sawNonWhitespace = true;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function isTableValid(lines: string[]): boolean {
  return lines.every((line) => isRowValid(line));
}

function isRowValid(line: string): boolean {
  const cells = splitRow(line);
  return cells.every((cell) => isCellValid(cell));
}

function isCellValid(cell: string): boolean {
  const trimmed = cell.trim();
  if (trimmed === "") return true;
  if (isQuotedString(trimmed)) return true;
  const first = trimmed[0];
  if (first === "[" || first === "{") {
    return isCollectionValid(trimmed);
  }
  return true;
}

function isCollectionValid(value: string): boolean {
  const formatted = formatCollection(value);
  return formatted !== null;
}

function formatCellValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  return formatValueRecursively(trimmed);
}

function formatCollection(value: string): string | null {
  if (value.length < 2) return null;
  const first = value[0];
  const last = value[value.length - 1];
  if (first === "[" && last === "]") {
    return formatBracketedCollection(value, "[", "]");
  }
  if (first === "{" && last === "}") {
    return formatBracketedCollection(value, "{", "}");
  }
  return null;
}

function formatBracketedCollection(value: string, open: "[" | "{", close: "]" | "}"): string | null {
  const inner = value.slice(1, -1);
  if (open === "[" && inner.trim() === ":") {
    return "[:]";
  }
  const parts = splitTopLevel(inner, ",");
  if (!parts) return null;
  const items = parts.map((part) => part.trim());

  const mapSplits = items.map((item) => splitTopLevel(item, ":"));
  const hasMapEntry = mapSplits.some((split) => split !== null && split.length === 2);

  if (!hasMapEntry) {
    const formattedItems = items.map((item) => formatValueRecursively(item));
    return `${open}${formattedItems.join(", ")}${close}`;
  }

  if (mapSplits.some((split) => split === null || split.length !== 2)) {
    return null;
  }

  const formattedEntries = mapSplits.map((split) => {
    const key = split?.[0]?.trim() ?? "";
    const valuePart = split?.[1]?.trim() ?? "";
    if (key === "" || isQuotedString(key)) return null;
    const formattedValue = valuePart === "" ? "" : formatValueRecursively(valuePart);
    if (formattedValue === "") return `${key}:`;
    return `${key}: ${formattedValue}`;
  });

  if (formattedEntries.some((entry) => entry === null)) return null;
  return `${open}${formattedEntries.join(", ")}${close}`;
}

function formatValueRecursively(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (isQuotedString(trimmed)) return trimmed;
  const formattedCollection = formatCollection(trimmed);
  return formattedCollection ?? trimmed;
}

function isQuotedString(value: string): boolean {
  if (value.length < 2) return false;
  const first = value[0];
  const last = value[value.length - 1];
  return (first === "'" || first === "\"") && last === first;
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

export function displayWidth(value: string): number {
  let width = 0;
  for (const char of value) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) continue;
    if (isZeroWidth(codePoint)) continue;
    if (isExtendedPictographic(char) || isFullWidthCodePoint(codePoint)) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

function isZeroWidth(codePoint: number): boolean {
  return (
    isCombiningMark(codePoint) ||
    codePoint === 0x200b || // zero width space
    codePoint === 0x200c || // zero width non-joiner
    codePoint === 0x200d || // zero width joiner
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) // variation selectors
  );
}

function isCombiningMark(codePoint: number): boolean {
  return (
    (codePoint >= 0x0300 && codePoint <= 0x036f) ||
    (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
    (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
    (codePoint >= 0x20d0 && codePoint <= 0x20ff) ||
    (codePoint >= 0xfe20 && codePoint <= 0xfe2f)
  );
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

function isExtendedPictographic(value: string): boolean {
  return extendedPictographic.test(value);
}

type ExtractedTable = {
  start: number;
  end: number;
  content: string;
  indent: string;
};

type Range = {
  start: number;
  end: number;
};

const tripleQuote = "\"\"\"";
const tableTestMarker = "@TableTest";

export function extractTripleQuotedTables(text: string): ExtractedTable[] {
  const results: ExtractedTable[] = [];
  let searchIndex = 0;

  while (searchIndex < text.length) {
    const annotationStart = text.indexOf(tableTestMarker, searchIndex);
    if (annotationStart < 0) break;

    const annotationNameEnd = annotationStart + tableTestMarker.length;
    const previousChar = annotationStart > 0 ? text[annotationStart - 1] ?? "" : "";
    const nextChar = text[annotationNameEnd] ?? "";
    if (isIdentifierCharacter(previousChar) || isIdentifierCharacter(nextChar)) {
      searchIndex = annotationNameEnd;
      continue;
    }

    const openParenIndex = skipWhitespaceAndComments(text, annotationNameEnd, text.length);
    if ((text[openParenIndex] ?? "") !== "(") {
      searchIndex = annotationNameEnd;
      continue;
    }

    const closeParenIndex = findMatchingParenthesis(text, openParenIndex);
    if (closeParenIndex < 0) {
      searchIndex = annotationNameEnd;
      continue;
    }

    const argumentStart = openParenIndex + 1;
    const argumentEnd = closeParenIndex;
    const table = extractTableFromArguments(text, argumentStart, argumentEnd);
    if (table) {
      results.push(table);
    }

    searchIndex = closeParenIndex + 1;
  }

  return results;
}

function extractTableFromArguments(text: string, start: number, end: number): ExtractedTable | null {
  const argumentsRanges = splitTopLevelArguments(text, start, end);
  let implicitValue: ExtractedTable | null = null;
  let namedArgumentSeen = false;
  let positionalArgumentCount = 0;

  for (const range of argumentsRanges) {
    const expressionStart = skipWhitespaceAndComments(text, range.start, range.end);
    if (expressionStart >= range.end) {
      continue;
    }

    const equalsIndex = findTopLevelEquals(text, expressionStart, range.end);
    if (equalsIndex >= 0) {
      namedArgumentSeen = true;
      const leftHandSide = text.slice(expressionStart, equalsIndex).trim();
      if (leftHandSide === "value") {
        const valueStart = skipWhitespaceAndComments(text, equalsIndex + 1, range.end);
        const namedValue = parseTripleQuotedValue(text, valueStart, range.end);
        if (namedValue) {
          return namedValue;
        }
      }
      continue;
    }

    positionalArgumentCount += 1;
    if (!implicitValue) {
      implicitValue = parseTripleQuotedValue(text, expressionStart, range.end);
    }
  }

  // In Java/Kotlin annotation usage, implicit value is only reliable when it is
  // the sole positional argument and no named arguments are present.
  if (namedArgumentSeen || positionalArgumentCount !== 1) {
    return null;
  }

  return implicitValue;
}

function parseTripleQuotedValue(text: string, quoteStart: number, limit: number): ExtractedTable | null {
  if (!text.startsWith(tripleQuote, quoteStart)) return null;
  const quoteEnd = text.indexOf(tripleQuote, quoteStart + tripleQuote.length);
  if (quoteEnd < 0 || quoteEnd > limit) return null;
  const trailingStart = quoteEnd + tripleQuote.length;
  if (skipWhitespaceAndComments(text, trailingStart, limit) !== limit) return null;

  const contentStart = quoteStart + tripleQuote.length;
  const content = text.slice(contentStart, quoteEnd);
  const lineStart = text.lastIndexOf("\n", quoteStart) + 1;
  const indent = text.slice(lineStart, quoteStart).match(/^\s*/)?.[0] ?? "";
  return { start: contentStart, end: quoteEnd, content, indent };
}

function splitTopLevelArguments(text: string, start: number, end: number): Range[] {
  const ranges: Range[] = [];
  let argumentStart = start;

  const stack: string[] = [];
  let index = start;
  while (index < end) {
    if (text.startsWith(tripleQuote, index)) {
      index = skipTripleQuotedString(text, index, end);
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

function findTopLevelEquals(text: string, start: number, end: number): number {
  const stack: string[] = [];
  let index = start;

  while (index < end) {
    if (text.startsWith(tripleQuote, index)) {
      index = skipTripleQuotedString(text, index, end);
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

function findMatchingParenthesis(text: string, openParenIndex: number): number {
  let depth = 1;
  let index = openParenIndex + 1;

  while (index < text.length) {
    if (text.startsWith(tripleQuote, index)) {
      index = skipTripleQuotedString(text, index, text.length);
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

function skipTripleQuotedString(text: string, start: number, end: number): number {
  const closeIndex = text.indexOf(tripleQuote, start + tripleQuote.length);
  if (closeIndex < 0 || closeIndex + tripleQuote.length > end) return end;
  return closeIndex + tripleQuote.length;
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
