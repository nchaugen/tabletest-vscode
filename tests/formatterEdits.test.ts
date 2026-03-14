import * as assert from "node:assert/strict";
import * as test from "node:test";
import { calculateTableEdits, OffsetRange, TableEdit } from "../src/formatterEdits";
import { formatTableString } from "../src/parser";

function nthIndexOf(text: string, needle: string, occurrence: number): number {
  let index = -1;
  for (let i = 0; i < occurrence; i++) {
    index = text.indexOf(needle, index + 1);
    if (index < 0) return -1;
  }
  return index;
}

function applyEdits(text: string, edits: TableEdit[]): string {
  return edits
    .slice()
    .sort((a, b) => b.start - a.start)
    .reduce((current, edit) => current.slice(0, edit.start) + edit.formatted + current.slice(edit.end), text);
}

test("returns all table edits when no range is provided", () => {
  const text = [
    "@TableTest(\"\"\"",
    "a|b",
    "1|2",
    "\"\"\")",
    "@TableTest(\"\"\"",
    "x|y",
    "3|4",
    "\"\"\")"
  ].join("\n");

  const edits = calculateTableEdits(text, (content) => `<<${content}>>`);
  assert.strictEqual(edits.length, 2);
});

test("formats multiple tables without offset drift", () => {
  const text = [
    "@TableTest(\"\"\"a|b",
    "1|22\"\"\")",
    "",
    "@TableTest(\"\"\"x|y",
    "3|4\"\"\")"
  ].join("\n");

  const edits = calculateTableEdits(text, (content, indent) => formatTableString(content, indent));
  const updated = applyEdits(text, edits);

  const expected = [
    "@TableTest(\"\"\"a | b",
    "1 | 22\"\"\")",
    "",
    "@TableTest(\"\"\"x | y",
    "3 | 4\"\"\")"
  ].join("\n");

  assert.strictEqual(updated, expected);
});

test("formats fully-qualified Java TableTest annotations", () => {
  const text = [
    "@org.tabletest.junit.TableTest(\"\"\"",
    "a|b",
    "1|22",
    "\"\"\")"
  ].join("\n");

  const edits = calculateTableEdits(text, (content, indent) => formatTableString(content, indent), undefined, "java", "  ");
  assert.strictEqual(edits.length, 1);

  const updated = applyEdits(text, edits);
  const expected = [
    "@org.tabletest.junit.TableTest(\"\"\"",
    "  a | b",
    "  1 | 22",
    "  \"\"\")"
  ].join("\n");

  assert.strictEqual(updated, expected);
});

test("limits edits to tables fully contained in the range", () => {
  const text = [
    "prefix",
    "@TableTest(\"\"\"",
    "a|b",
    "1|2",
    "\"\"\")",
    "middle",
    "@TableTest(\"\"\"",
    "x|y",
    "3|4",
    "\"\"\")",
    "suffix"
  ].join("\n");

  const firstContentStart = nthIndexOf(text, "\"\"\"", 1) + 3;
  const firstContentEnd = nthIndexOf(text, "\"\"\"", 2);
  const secondContentStart = nthIndexOf(text, "\"\"\"", 3) + 3;
  const secondContentEnd = nthIndexOf(text, "\"\"\"", 4);

  const firstRange: OffsetRange = { start: firstContentStart, end: firstContentEnd };
  const secondRange: OffsetRange = { start: secondContentStart, end: secondContentEnd };

  const firstEdits = calculateTableEdits(text, (content) => `FIRST:${content}`, firstRange);
  assert.deepStrictEqual(firstEdits, [
    { start: firstContentStart, end: firstContentEnd, formatted: `FIRST:${text.slice(firstContentStart, firstContentEnd)}` }
  ]);

  const secondEdits = calculateTableEdits(text, (content) => `SECOND:${content}`, secondRange);
  assert.deepStrictEqual(secondEdits, [
    { start: secondContentStart, end: secondContentEnd, formatted: `SECOND:${text.slice(secondContentStart, secondContentEnd)}` }
  ]);
});

test("skips tables when the range only partially overlaps", () => {
  const text = [
    "@TableTest(\"\"\"",
    "a|b",
    "1|2",
    "\"\"\")"
  ].join("\n");

  const contentStart = nthIndexOf(text, "\"\"\"", 1) + 3;
  const contentEnd = nthIndexOf(text, "\"\"\"", 2);

  const partialRange: OffsetRange = { start: contentStart + 1, end: contentEnd };
  const edits = calculateTableEdits(text, (content) => `PART:${content}`, partialRange);
  assert.strictEqual(edits.length, 0);
});

test("passes indent into the formatter", () => {
  const text = [
    "  @TableTest(",
    "    \"\"\"",
    "    a|b",
    "    \"\"\"",
    "  )"
  ].join("\n");

  const edits = calculateTableEdits(text, (_content, indent) => `indent:${indent.length}`);
  assert.strictEqual(edits.length, 1);
  assert.strictEqual(edits[0]?.formatted, "indent:4");
});

test("adds configured extra indent to extracted table indent", () => {
  const text = [
    "  @TableTest(",
    "    \"\"\"",
    "    a|b",
    "    \"\"\"",
    "  )"
  ].join("\n");

  const edits = calculateTableEdits(text, (_content, indent) => `indent:${indent.length}`, undefined, "java", "  ");
  assert.strictEqual(edits.length, 1);
  assert.strictEqual(edits[0]?.formatted, "indent:6");
});

test("supports Kotlin-specific triple-quote termination when extracting tables", () => {
  const escapedTerminator = String.raw`\"""`;
  const text = [
    "@TableTest(",
    "value = \"\"\"",
    "a|b",
    `1|2${escapedTerminator}`,
    ")"
  ].join("\n");

  const javaEdits = calculateTableEdits(text, (content) => content.toUpperCase(), undefined, "java");
  const kotlinEdits = calculateTableEdits(text, (content) => content.toUpperCase(), undefined, "kotlin");

  assert.strictEqual(javaEdits.length, 0);
  assert.strictEqual(kotlinEdits.length, 1);
});

test("formats Kotlin text-block table rows containing pipes in quoted map keys", () => {
  const text = [
    "@TableTest(\"\"\"a|b",
    "long|[\"suc|c e|s s\":3]\"\"\")"
  ].join("\n");

  const edits = calculateTableEdits(text, (content, indent) => formatTableString(content, indent), undefined, "kotlin");
  assert.strictEqual(edits.length, 1);

  const updated = applyEdits(text, edits);
  const expected = [
    "@TableTest(\"\"\"a    | b",
    "long | [\"suc|c e|s s\": 3]\"\"\")"
  ].join("\n");

  assert.strictEqual(updated, expected);
});

test("formats implicit Java string-array table into canonical multiline form", () => {
  const text = "@TableTest({\"name|age\",\"Alice|30\",\"Bob|7\"})";

  const edits = calculateTableEdits(text, (content, indent) => formatTableString(content, indent), undefined, "java", "  ");
  assert.strictEqual(edits.length, 1);

  const updated = applyEdits(text, edits);
  const expected = [
    "@TableTest({",
    "  \"name  | age\",",
    "  \"Alice | 30 \",",
    "  \"Bob   | 7  \"",
    "})"
  ].join("\n");

  assert.strictEqual(updated, expected);
});

test("formats named Java string-array value while preserving the named argument form", () => {
  const text = "@TableTest(value = {\"a|b\",\"1|22\"}, name = \"x\")";

  const edits = calculateTableEdits(text, (content, indent) => formatTableString(content, indent), undefined, "java", "  ");
  assert.strictEqual(edits.length, 1);

  const updated = applyEdits(text, edits);
  const expected = [
    "@TableTest(value = {",
    "  \"a | b \",",
    "  \"1 | 22\"",
    "}, name = \"x\")"
  ].join("\n");

  assert.strictEqual(updated, expected);
});

test("uses dedicated string-array indent when provided", () => {
  const text = "@TableTest({\"a|b\",\"1|22\"})";

  const edits = calculateTableEdits(
    text,
    (content, indent) => formatTableString(content, indent),
    undefined,
    "java",
    "  ",
    4,
    "    "
  );
  assert.strictEqual(edits.length, 1);

  const updated = applyEdits(text, edits);
  const expected = [
    "@TableTest({",
    "    \"a | b \",",
    "    \"1 | 22\"",
    "})"
  ].join("\n");

  assert.strictEqual(updated, expected);
});

test("formats Java string-array rows that contain escaped double quotes in collection values", () => {
  const text = "@TableTest({\"a|b\",\"[k:\\\"v\\\"]|ok\"})";

  const edits = calculateTableEdits(text, (content, indent) => formatTableString(content, indent), undefined, "java", "  ");
  assert.strictEqual(edits.length, 1);

  const updated = applyEdits(text, edits);
  const expected = [
    "@TableTest({",
    "  \"a        | b   \",",
    "  \"[k: \\\"v\\\"] | ok\"",
    "})"
  ].join("\n");

  assert.strictEqual(updated, expected);
});

test("keeps Java string-array closing quotes aligned when map keys use escaped double quotes", () => {
  const text = "@TableTest({\"Scenario|Collection literal\",\"Flat map|[a:1,b:2]\",\"Map with quoted keys|[':l e[f]t': [1,2], \\\" :r:i[g]h t\\\": [3,4]]\"})";

  const edits = calculateTableEdits(text, (content, indent) => formatTableString(content, indent), undefined, "java", "  ");
  assert.strictEqual(edits.length, 1);

  const updated = applyEdits(text, edits);
  const literalLines = updated
    .split("\n")
    .filter((line) => line.trimStart().startsWith("\""));
  assert.ok(literalLines.length >= 3);

  const firstClosingQuoteIndex = literalLines[0]?.lastIndexOf("\"");
  assert.ok(typeof firstClosingQuoteIndex === "number" && firstClosingQuoteIndex >= 0);
  assert.ok(literalLines.every((line) => line.lastIndexOf("\"") === firstClosingQuoteIndex));
  assert.ok(updated.includes("\"Map with quoted keys | [':l e[f]t': [1, 2], \\\" :r:i[g]h t\\\": [3, 4]]"));
});
