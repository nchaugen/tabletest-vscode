import * as assert from "node:assert/strict";
import * as test from "node:test";
import { extractAnnotationTables } from "../src/parser";

test("extracts implicit Java string-array table and exposes argument replacement range", () => {
  const text = [
    "@TableTest(",
    "    {\"name|age\", \"Alice|30\", \"Bob|7\"}",
    ")"
  ].join("\n");

  const tables = extractAnnotationTables(text, "java");
  assert.strictEqual(tables.length, 1);

  const first = tables[0];
  assert.ok(first);
  assert.strictEqual(first.kind, "stringArray");
  assert.strictEqual(first.rows.map((row: { content: string }) => row.content).join("\n"), "name|age\nAlice|30\nBob|7");

  const expectedStart = text.indexOf("(") + 1;
  const expectedEnd = text.lastIndexOf(")");
  assert.strictEqual(first.start, expectedStart);
  assert.strictEqual(first.end, expectedEnd);
  assert.strictEqual(text.slice(first.start, first.end).trim(), "{\"name|age\", \"Alice|30\", \"Bob|7\"}");
});

test("extracts fully-qualified Java string-array table", () => {
  const text = "@org.tabletest.junit.TableTest({\"a|b\", \"1|2\"})";

  const tables = extractAnnotationTables(text, "java");
  assert.strictEqual(tables.length, 1);

  const first = tables[0];
  assert.ok(first);
  assert.strictEqual(first.kind, "stringArray");
  assert.strictEqual(first.rows.map((row: { content: string }) => row.content).join("\n"), "a|b\n1|2");
});

test("extracts named Java value array and keeps replacement range on the literal only", () => {
  const text = [
    "@TableTest(",
    "    name = \"example\",",
    "    value = {\"a|b\", \"1|2\"},",
    "    encoding = \"UTF-8\"",
    ")"
  ].join("\n");

  const tables = extractAnnotationTables(text, "java");
  assert.strictEqual(tables.length, 1);

  const first = tables[0];
  assert.ok(first);
  assert.strictEqual(first.kind, "stringArray");
  assert.strictEqual(first.rows.map((row: { content: string }) => row.content).join("\n"), "a|b\n1|2");

  const expectedStart = text.indexOf("{\"a|b\", \"1|2\"}");
  const expectedEnd = expectedStart + "{\"a|b\", \"1|2\"}".length;
  assert.strictEqual(first.start, expectedStart);
  assert.strictEqual(first.end, expectedEnd);
});

test("rejects non-static Java string-array expressions", () => {
  const dynamicCases = [
    "@TableTest({\"a|b\", SOME_CONST})",
    "@TableTest({\"a|b\", createRow()})",
    "@TableTest({\"a|b\" + suffix})",
    "@TableTest(value = {\"a|b\", 42})"
  ];

  dynamicCases.forEach((text) => {
    const tables = extractAnnotationTables(text, "java");
    assert.strictEqual(tables.length, 0, `Expected no table extraction for: ${text}`);
  });
});

test("does not extract Kotlin string arrays", () => {
  const text = "@TableTest({\"a|b\", \"1|2\"})";
  const tables = extractAnnotationTables(text, "kotlin");
  assert.strictEqual(tables.length, 0);
});

test("decodes Java string-array escapes for downstream table parsing", () => {
  const text = "@TableTest({\"a|b\",\"[k:\\\"v\\\"]|ok\"})";
  const tables = extractAnnotationTables(text, "java");

  assert.strictEqual(tables.length, 1);
  const first = tables[0];
  assert.ok(first);
  assert.strictEqual(first.kind, "stringArray");

  const row = first.rows[1];
  assert.ok(row);
  assert.strictEqual(row.content, "[k:\\\"v\\\"]|ok");
  assert.strictEqual(row.decodedContent, "[k:\"v\"]|ok");

  const decodedQuoteIndex = row.decodedContent.indexOf("\"");
  const sourceQuoteOffset = row.decodedContentSourceOffsets[decodedQuoteIndex];
  assert.strictEqual(text.slice(sourceQuoteOffset, sourceQuoteOffset + 2), "\\\"");
});
