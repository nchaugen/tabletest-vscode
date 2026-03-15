import * as assert from "node:assert/strict";
import * as test from "node:test";
import { extractTripleQuotedTables } from "../src/parser";

function nthIndexOf(text: string, needle: string, occurrence: number): number {
  let index = -1;
  for (let i = 0; i < occurrence; i += 1) {
    index = text.indexOf(needle, index + 1);
    if (index < 0) return -1;
  }
  return index;
}

test("extracts implicit value table content and positions", () => {
  const text = [
    "@TableTest(",
    "    \"\"\"",
    "    a|b",
    "    1|2",
    "    \"\"\"",
    ")"
  ].join("\n");

  const tables = extractTripleQuotedTables(text);
  assert.strictEqual(tables.length, 1);

  const first = tables[0];
  assert.ok(first);
  assert.strictEqual(first.content, "\n    a|b\n    1|2\n    ");
  assert.strictEqual(first.indent, "    ");
  assert.strictEqual(first.openingQuoteOnOwnLine, true);

  const expectedStart = nthIndexOf(text, "\"\"\"", 1) + 3;
  const expectedEnd = nthIndexOf(text, "\"\"\"", 2);
  assert.strictEqual(first.start, expectedStart);
  assert.strictEqual(first.end, expectedEnd);
  assert.strictEqual(text.slice(first.start, first.end), first.content);
});

test("extracts fully-qualified Java annotation value tables", () => {
  const text = [
    "@org.tabletest.junit.TableTest(",
    "    \"\"\"",
    "    a|b",
    "    1|2",
    "    \"\"\"",
    ")"
  ].join("\n");

  const tables = extractTripleQuotedTables(text, "java");
  assert.strictEqual(tables.length, 1);

  const first = tables[0];
  assert.ok(first);
  assert.strictEqual(first.content, "\n    a|b\n    1|2\n    ");
  assert.strictEqual(first.openingQuoteOnOwnLine, true);
});

test("extracts named value table and ignores non-value arguments", () => {
  const text = [
    "@TableTest(",
    "    other = \"ignore\",",
    "    value = \"\"\"",
    "    a|b",
    "    1|2",
    "    \"\"\",",
    "    encoding = \"UTF-8\"",
    ")"
  ].join("\n");

  const tables = extractTripleQuotedTables(text);
  assert.strictEqual(tables.length, 1);

  const first = tables[0];
  assert.ok(first);
  assert.strictEqual(first.content, "\n    a|b\n    1|2\n    ");
  assert.strictEqual(first.indent, "    ");
  assert.strictEqual(first.openingQuoteOnOwnLine, false);
});

test("prefers named value when another triple-quoted argument appears first", () => {
  const text = [
    "@TableTest(",
    "    other = \"\"\"this is not a table\"\"\",",
    "    value = \"\"\"",
    "    a|b",
    "    1|2",
    "    \"\"\"",
    ")"
  ].join("\n");

  const tables = extractTripleQuotedTables(text);
  assert.strictEqual(tables.length, 1);

  const first = tables[0];
  assert.ok(first);
  assert.strictEqual(first.content, "\n    a|b\n    1|2\n    ");
  assert.strictEqual(first.openingQuoteOnOwnLine, false);
});

test("supports line comments before implicit value table", () => {
  const text = [
    "@TableTest(",
    "    // comment before implicit value",
    "    \"\"\"",
    "    a|b",
    "    1|2",
    "    \"\"\"",
    ")"
  ].join("\n");

  const tables = extractTripleQuotedTables(text);
  assert.strictEqual(tables.length, 1);

  const first = tables[0];
  assert.ok(first);
  assert.strictEqual(first.content, "\n    a|b\n    1|2\n    ");
  assert.strictEqual(first.openingQuoteOnOwnLine, true);
});

test("handles valid Java annotation argument forms around value", () => {
  const text = [
    "@TableTest(",
    "    name = \"example\",",
    "    flags = {true, false},",
    "    status = Status.ACTIVE,",
    "    metadata = @Meta(level = 2, note = \"x\"),",
    "    value = \"\"\"",
    "    a|b",
    "    1|2",
    "    \"\"\",",
    "    types = {String.class, Integer.class}",
    ")"
  ].join("\n");

  const tables = extractTripleQuotedTables(text);
  assert.strictEqual(tables.length, 1);

  const first = tables[0];
  assert.ok(first);
  assert.strictEqual(first.content, "\n    a|b\n    1|2\n    ");
  assert.strictEqual(first.openingQuoteOnOwnLine, false);
});

test("handles valid Kotlin annotation argument forms around value", () => {
  const text = [
    "@TableTest(",
    "    name = \"example\",",
    "    flags = [true, false],",
    "    metadata = Meta(level = 2, note = \"x\"),",
    "    value = \"\"\"",
    "    x|y",
    "    3|4",
    "    \"\"\",",
    "    type = String::class",
    ")"
  ].join("\n");

  const tables = extractTripleQuotedTables(text);
  assert.strictEqual(tables.length, 1);

  const first = tables[0];
  assert.ok(first);
  assert.strictEqual(first.content, "\n    x|y\n    3|4\n    ");
  assert.strictEqual(first.openingQuoteOnOwnLine, false);
});

test("treats escaped triple quote as content in Java text blocks", () => {
  const escapedTerminator = String.raw`\"""`;
  const text = [
    "@TableTest(",
    "    value = \"\"\"",
    "    a|b",
    `    1|2${escapedTerminator}|3`,
    "    4|5",
    "    \"\"\"",
    ")"
  ].join("\n");

  const tables = extractTripleQuotedTables(text, "java");
  assert.strictEqual(tables.length, 1);

  const first = tables[0];
  assert.ok(first);
  assert.strictEqual(first.content, `\n    a|b\n    1|2${escapedTerminator}|3\n    4|5\n    `);
  assert.strictEqual(first.openingQuoteOnOwnLine, false);
});

test("treats backslash triple quote as terminator in Kotlin raw strings", () => {
  const escapedTerminator = String.raw`\"""`;
  const text = [
    "@TableTest(",
    "    value = \"\"\"",
    "    a|b",
    `    1|2${escapedTerminator}`,
    ")"
  ].join("\n");

  const tables = extractTripleQuotedTables(text, "kotlin");
  assert.strictEqual(tables.length, 1);

  const first = tables[0];
  assert.ok(first);
  assert.strictEqual(first.content, "\n    a|b\n    1|2\\");
  assert.strictEqual(first.openingQuoteOnOwnLine, false);
});

test("does not use implicit triple-quoted value when named arguments are present", () => {
  const text = [
    "@TableTest(",
    "    encoding = \"UTF-8\",",
    "    \"\"\"",
    "    a|b",
    "    1|2",
    "    \"\"\"",
    ")"
  ].join("\n");

  const tables = extractTripleQuotedTables(text);
  assert.strictEqual(tables.length, 0);
});

test("skips named value when expression is not a direct triple-quoted literal", () => {
  const text = [
    "@TableTest(",
    "    value = \"\"\"",
    "    a|b",
    "    1|2",
    "    \"\"\" + \"suffix\"",
    ")"
  ].join("\n");

  const tables = extractTripleQuotedTables(text);
  assert.strictEqual(tables.length, 0);
});

test("extracts multiple TableTest annotations and ignores other annotations", () => {
  const text = [
    "@OtherAnnotation(\"\"\"not a table\"\"\")",
    "@TableTest(\"\"\"",
    "a|b",
    "1|2",
    "\"\"\")",
    "",
    "@TableTest(value = \"\"\"",
    "x|y",
    "3|4",
    "\"\"\")"
  ].join("\n");

  const tables = extractTripleQuotedTables(text);
  assert.strictEqual(tables.length, 2);

  const first = tables[0];
  const second = tables[1];
  assert.ok(first);
  assert.ok(second);
  assert.strictEqual(first.content, "\na|b\n1|2\n");
  assert.strictEqual(second.content, "\nx|y\n3|4\n");
  assert.strictEqual(first.openingQuoteOnOwnLine, false);
  assert.strictEqual(second.openingQuoteOnOwnLine, false);
});
