import * as assert from "node:assert/strict";
import * as test from "node:test";
import { collectTableHeaderTokenSpans } from "../src/tableHeaderTokens";
import type { TableHeaderTokenType } from "../src/tableHeaderTokens";

type SupportedLanguage = "java" | "kotlin" | "tabletest";

function headerTexts(text: string, language: SupportedLanguage): string[] {
  return collectTableHeaderTokenSpans(text, language).map((span) => text.slice(span.start, span.end));
}

function headerTokens(text: string, language: SupportedLanguage): Array<{ text: string; tokenType: TableHeaderTokenType }> {
  return collectTableHeaderTokenSpans(text, language).map((span) => ({
    text: text.slice(span.start, span.end),
    tokenType: span.tokenType
  }));
}

test("collects standalone table header cells after leading comments and blank lines", () => {
  const text = [
    "// leading table comment",
    "",
    "Scenario|Result?",
    "ok|yes"
  ].join("\n");

  assert.deepStrictEqual(headerTexts(text, "tabletest"), ["Scenario", "Result?"]);
});

test("collects Java text-block header cells after a leading table comment", () => {
  const text = [
    "class Sample {",
    "  @TableTest(\"\"\"",
    "    // leading table comment",
    "    Scenario|Result?",
    "    ok|yes",
    "    \"\"\")",
    "}"
  ].join("\n");

  assert.deepStrictEqual(headerTexts(text, "java"), ["Scenario", "Result?"]);
});

test("collects Kotlin text-block header cells after leading blank lines and comments", () => {
  const text = [
    "class Sample {",
    "  @TableTest(",
    "    \"\"\"",
    "",
    "    // leading table comment",
    "    Scenario|Result?",
    "    ok|yes",
    "    \"\"\"",
    "  )",
    "}"
  ].join("\n");

  assert.deepStrictEqual(headerTexts(text, "kotlin"), ["Scenario", "Result?"]);
});

test("collects Java string-array header cells after a leading comment row", () => {
  const text = [
    "@TableTest({",
    "  \"// leading table comment\",",
    "  \"Scenario|Result?\",",
    "  \"ok|yes\"",
    "})"
  ].join("\n");

  assert.deepStrictEqual(headerTexts(text, "java"), ["Scenario", "Result?"]);
});

test("marks question-mark headers with a dedicated semantic token type", () => {
  const text = [
    "// leading table comment",
    "",
    "Scenario|Result?|Other",
    "ok|yes|x"
  ].join("\n");

  assert.deepStrictEqual(headerTokens(text, "tabletest"), [
    { text: "Scenario", tokenType: "tableHeader" },
    { text: "Result?", tokenType: "tableQuestionHeader" },
    { text: "Other", tokenType: "tableHeader" }
  ]);
});
