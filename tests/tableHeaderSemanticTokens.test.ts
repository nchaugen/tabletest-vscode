import * as assert from "node:assert/strict";
import * as test from "node:test";
import { collectTableHeaderTokenSpans } from "../src/tableHeaderTokens";

type SupportedLanguage = "java" | "kotlin" | "tabletest";

function headerTexts(text: string, language: SupportedLanguage): string[] {
  return collectTableHeaderTokenSpans(text, language).map((span) => text.slice(span.start, span.end));
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
