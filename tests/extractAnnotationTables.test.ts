import * as assert from "node:assert/strict";
import test from "node:test";
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

test("does not extract annotations inside line comments", () => {
  const text = [
    "class T {",
    "    // @TableTest({\"a|b\", \"c|d\"})",
    "    void x() {}",
    "}"
  ].join("\n");

  assert.strictEqual(extractAnnotationTables(text, "java").length, 0);
});

test("does not extract Kotlin annotations inside line comments", () => {
  const text = [
    "class T {",
    "    // @TableTest(\"\"\"a | b\"\"\")",
    "    fun x() {}",
    "}"
  ].join("\n");

  assert.strictEqual(extractAnnotationTables(text, "kotlin").length, 0);
});

test("does not extract annotations inside block comments", () => {
  const text = [
    "/**",
    " * Example: @TableTest({\"a|b\", \"1|2\"})",
    " */",
    "class T {}"
  ].join("\n");

  assert.strictEqual(extractAnnotationTables(text, "java").length, 0);
});

test("does not extract annotations inside string literals", () => {
  const text = "String snippet = \"@TableTest({\\\"a|b\\\", \\\"1|2\\\"})\";";

  assert.strictEqual(extractAnnotationTables(text, "java").length, 0);
});

test("extracts annotation following a comment", () => {
  const text = [
    "// commented out: @TableTest({\"old|table\"})",
    "/* also here: @TableTest({\"old|table\"}) */",
    "@TableTest({\"a|b\", \"1|2\"})"
  ].join("\n");

  const tables = extractAnnotationTables(text, "java");
  assert.strictEqual(tables.length, 1);
  const first = tables[0];
  assert.ok(first);
  assert.strictEqual(first.kind, "stringArray");
  assert.strictEqual(first.rows.map((row: { content: string }) => row.content).join("\n"), "a|b\n1|2");
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

test("extracts tables with block comments around annotation arguments", () => {
  const text = [
    "@TableTest /* note */ (/* rows */ \"\"\"",
    "    a | b",
    "    1 | 2",
    "    \"\"\" /* trailing */)"
  ].join("\n");

  const tables = extractAnnotationTables(text, "java");
  assert.strictEqual(tables.length, 1);
  assert.strictEqual(tables[0]?.kind, "textBlock");
});

test("marks string arrays containing comments between entries", () => {
  const cases = [
    "@TableTest({\"a|b\", // note\n\"1|2\"})",
    "@TableTest({\"a|b\", /* note */ \"1|2\"})"
  ];

  cases.forEach((text) => {
    const tables = extractAnnotationTables(text, "java");
    assert.strictEqual(tables.length, 1, `Expected extraction for: ${text}`);
    const first = tables[0];
    assert.ok(first);
    assert.strictEqual(first.kind, "stringArray");
    assert.ok(first.kind === "stringArray" && first.containsComments, `Expected containsComments for: ${text}`);
    assert.strictEqual(first.rows.map((row: { content: string }) => row.content).join("\n"), "a|b\n1|2");
  });
});

test("marks comment-free string arrays as containing no comments", () => {
  const tables = extractAnnotationTables("@TableTest({\"a|b\", \"1|2\"})", "java");
  const first = tables[0];
  assert.ok(first && first.kind === "stringArray");
  assert.strictEqual(first.containsComments, false);
});
