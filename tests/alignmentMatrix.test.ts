import * as assert from "node:assert/strict";
import * as test from "node:test";
import { extractAnnotationTables, formatTableString } from "../src/parser";
import type { AnnotationHostLanguage } from "../src/parser";
import { calculateTableEdits, TableEdit } from "../src/formatterEdits";

type TestedLineKind = "comment" | "row";
type IndentVariant = "less" | "more";
type SurroundingContext = "row" | "comment" | "blank";

type AlignmentContext = {
  name: string;
  createHost(table: string): string;
  formatHost(host: string): string;
  extractFormattedTable(host: string): string;
};

const testedLineKinds: TestedLineKind[] = ["comment", "row"];
const indentVariants: IndentVariant[] = ["less", "more"];
const surroundingContexts: SurroundingContext[] = ["row", "comment", "blank"];

const alignmentContexts: AlignmentContext[] = [
  {
    name: "standalone",
    createHost: (table) => table,
    formatHost: (host) => formatTableString(host),
    extractFormattedTable: (host) => host
  },
  {
    name: "java text block",
    createHost: (table) => `@TableTest(\"\"\"${table}\"\"\")`,
    formatHost: (host) => formatAnnotationHost(host, "java"),
    extractFormattedTable: (host) => extractSingleFormattedTable(host, "java")
  },
  {
    name: "kotlin text block",
    createHost: (table) => `@TableTest(\"\"\"${table}\"\"\")`,
    formatHost: (host) => formatAnnotationHost(host, "kotlin"),
    extractFormattedTable: (host) => extractSingleFormattedTable(host, "kotlin")
  },
  {
    name: "java string array",
    createHost: (table) => renderJavaStringArrayHost(table),
    formatHost: (host) => formatAnnotationHost(host, "java"),
    extractFormattedTable: (host) => extractSingleFormattedTable(host, "java")
  }
];

function applyEdits(text: string, edits: TableEdit[]): string {
  return edits
    .slice()
    .sort((left, right) => right.start - left.start)
    .reduce((current, edit) => current.slice(0, edit.start) + edit.formatted + current.slice(edit.end), text);
}

function formatAnnotationHost(host: string, language: AnnotationHostLanguage): string {
  const edits = calculateTableEdits(host, (content, indent) => formatTableString(content, indent), undefined, language);
  return applyEdits(host, edits);
}

function extractSingleFormattedTable(host: string, language: AnnotationHostLanguage): string {
  const tables = extractAnnotationTables(host, language);
  assert.strictEqual(tables.length, 1, `Expected a single ${language} table`);

  const extracted = tables[0];
  assert.ok(extracted);

  if (extracted.kind === "textBlock") {
    return extracted.content;
  }

  return extracted.rows.map((row) => row.decodedContent).join("\n");
}

function renderJavaStringArrayHost(table: string): string {
  const rows = table.split("\n");
  const renderedRows = rows.map((row, index) => {
    const suffix = index < rows.length - 1 ? "," : "";
    return `"${escapeJavaStringLiteral(row)}"${suffix}`;
  });
  return ["@TableTest({", ...renderedRows, "})"].join("\n");
}

function escapeJavaStringLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function buildMatrixTable(
  testedLineKind: TestedLineKind,
  indentVariant: IndentVariant,
  above: SurroundingContext,
  below: SurroundingContext
): string {
  const alignedIndent = "    ";
  const extraIndent = "        ";
  const testedIndent = indentVariant === "less" ? "" : extraIndent;
  const targetLine =
    testedLineKind === "comment" ? `${testedIndent}// target comment` : `${testedIndent}target|333`;

  const lines = [`${alignedIndent}header1|header2`, `${alignedIndent}alpha|1`];

  if (above === "comment") {
    lines.push(`${alignedIndent}// above comment`);
  }
  if (above === "blank") {
    lines.push("");
  }

  lines.push(targetLine);

  if (below === "row") {
    lines.push(`${alignedIndent}omega|4444`);
  }
  if (below === "comment") {
    lines.push(`${alignedIndent}// below comment`, `${alignedIndent}omega|4444`);
  }
  if (below === "blank") {
    lines.push("", `${alignedIndent}omega|4444`);
  }

  return lines.join("\n");
}

function assertAlignedTable(table: string): void {
  const lines = table.split("\n");
  const nonBlankLines = lines.filter((line) => line.trim() !== "");
  const dataLines = nonBlankLines.filter((line) => !line.trimStart().startsWith("//"));
  const commentLines = nonBlankLines.filter((line) => line.trimStart().startsWith("//"));

  assert.ok(dataLines.length >= 3, "Expected header and at least two data rows");

  const expectedIndent = leadingWhitespace(dataLines[0] ?? "");
  for (const line of dataLines) {
    assert.strictEqual(leadingWhitespace(line), expectedIndent, "Data rows should share the same indent");
  }
  for (const line of commentLines) {
    assert.strictEqual(leadingWhitespace(line), expectedIndent, "Comment lines should align with the first column");
  }

  const expectedPipeColumns = pipeColumns(dataLines[0] ?? "");
  for (const line of dataLines) {
    assert.deepStrictEqual(pipeColumns(line), expectedPipeColumns, "Data rows should align pipe columns");
  }
}

function leadingWhitespace(line: string): string {
  return line.match(/^\s*/)?.[0] ?? "";
}

function pipeColumns(line: string): number[] {
  const columns: number[] = [];
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === "|") {
      columns.push(index);
    }
  }
  return columns;
}

for (const context of alignmentContexts) {
  for (const testedLineKind of testedLineKinds) {
    for (const indentVariant of indentVariants) {
      for (const above of surroundingContexts) {
        for (const below of surroundingContexts) {
          const testName =
            `${context.name}: ${testedLineKind} ${indentVariant} indent with ${above} above and ${below} below`;

          test(testName, () => {
            const sourceTable = buildMatrixTable(testedLineKind, indentVariant, above, below);
            const host = context.createHost(sourceTable);

            const formattedHost = context.formatHost(host);
            const formattedTable = context.extractFormattedTable(formattedHost);
            assertAlignedTable(formattedTable);

            const reformattedHost = context.formatHost(formattedHost);
            assert.strictEqual(reformattedHost, formattedHost, "Formatting should be idempotent");
            assert.strictEqual(
              context.extractFormattedTable(reformattedHost),
              formattedTable,
              "Extracted formatted table should remain stable"
            );
          });
        }
      }
    }
  }
}
