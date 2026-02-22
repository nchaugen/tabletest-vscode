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
