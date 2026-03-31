import * as assert from "node:assert/strict";
import test from "node:test";
import { displayWidth } from "../src/parser";

function table(value: string): string {
  const normalised = value.replace(/\r\n?/g, "\n");
  const rawLines = normalised.split("\n");

  const withoutLeading = rawLines.length > 0 && rawLines[0].trim() === "" ? rawLines.slice(1) : rawLines;
  const withoutTrailing =
    withoutLeading.length > 0 && withoutLeading[withoutLeading.length - 1].trim() === ""
      ? withoutLeading.slice(0, -1)
      : withoutLeading;

  const nonEmpty = withoutTrailing.filter((line) => line.trim() !== "");
  const indents = nonEmpty.map((line) => {
    const match = line.match(/^\s*/);
    return match ? match[0].length : 0;
  });
  const minIndent = indents.length > 0 ? Math.min(...indents) : 0;
  const dedented = withoutTrailing.map((line) => (line.length >= minIndent ? line.slice(minIndent) : line));
  return dedented.join("\n");
}

const widthTable = table(`
  Scenario                     | Text               | Expected Width
  ASCII single letter          | A                  | 1
  ASCII word                   | Hello              | 5
  ASCII numbers                | 123                | 3
  CJK single character         | 中                 | 2
  CJK two characters           | 你好               | 4
  CJK four characters          | 你好世界           | 8
  Japanese hiragana            | こんにちは         | 10
  Japanese hiragana with kanji | こんにちは世界     | 14
  Korean short greeting        | 안녕                 | 4
  Korean greeting              | 안녕하세요              | 10
  Emoji grinning face          | 😀                  | 2
  Emoji waving hand            | 👋                  | 2
  Emoji waving hand skin tone  | 👋🏽                | 2
  Emoji coffee                 | ☕                  | 2
  Emoji technologist           | 👩‍💻                | 2
  Emoji family ZWJ             | 👨‍👩‍👧‍👦            | 2
  Emoji keycap                 | 1️⃣                | 2
  Flag emoji                   | 🇺🇸                | 2
  Mixed ASCII and emoji        | Hello 👋 World      | 14
  Mixed text with emoji        | Café ☕ tastes good | 19
  Scandinavian æ               | æ                  | 1
  Scandinavian ø repeated      | øøø                | 3
  Scandinavian å repeated      | ååå                | 3
  Accented word naïve          | naïve              | 5
  Accented word résumé         | résumé             | 6
  Greek letters with spaces    | α β γ              | 5
  Greek greeting               | Γεια σου κόσμε     | 14
  Cyrillic greeting            | Привет мир         | 10
  Arabic greeting              | مرحبا بالعالم      | 13
  Hebrew greeting              | שלום עולם          | 9
  Mathematical symbols         | ∑ ∏ ∫ √            | 7
  Box drawing characters       | ┌─┐│ │└─┘          | 9
  Currency symbols             | $€£¥₹              | 5
  Quotation marks              | «»""''—–           | 8
  Null string                  |                    | 0
  Empty string                 | ''                 | 0
`);

function isQuotedLiteral(value: string): boolean {
  if (value.length < 2) return false;
  const first = value[0];
  const last = value[value.length - 1];
  return (first === "'" || first === "\"") && last === first;
}

test("calculates display width for literal table values", () => {
  const lines = widthTable.split("\n");
  const dataLines = lines.filter((line) => line.includes("|"));
  const rows = dataLines.slice(1);

  for (const line of rows) {
    const parts = line.split("|");
    const textValue = (parts[1] ?? "").trim();
    const expected = Number((parts[2] ?? "").trim());
    const expectedWidth = expected + (isQuotedLiteral(textValue) ? 2 : 0);
    assert.strictEqual(
      displayWidth(textValue),
      expectedWidth,
      `Expected width for "${textValue}" to be ${expectedWidth} (raw ${expected})`
    );
  }
});

test("expands tab characters to tab stops", () => {
  assert.strictEqual(displayWidth("\t"), 4);
  assert.strictEqual(displayWidth("a\tb"), 5);
  assert.strictEqual(displayWidth("ab\tb"), 5);
  assert.strictEqual(displayWidth("abcd\tb"), 9);
});

test("supports custom tab size in width calculation", () => {
  assert.strictEqual(displayWidth("a\tb", 8), 9);
  assert.strictEqual(displayWidth("abcd\tb", 8), 9);
});

test("respects start column when expanding tabs", () => {
  assert.strictEqual(displayWidth("\t", 4, 0), 4);
  assert.strictEqual(displayWidth("\t", 4, 2), 2);
  assert.strictEqual(displayWidth("a\tb", 4, 1), 4);
});
