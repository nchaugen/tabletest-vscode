import * as assert from "node:assert/strict";
import * as test from "node:test";
import { findTableIssues, formatTableString } from "../src/parser";

type ConformanceExpectation = "accept" | "reject";

type ConformanceCase = {
  name: string;
  expected: ConformanceExpectation;
  input: string;
};

const conformanceCases: ConformanceCase[] = [
  {
    name: "testUnmatchedSingleQuote",
    expected: "accept",
    input: [
      "header",
      "'"
    ].join("\n")
  },
  {
    name: "testUnmatchedDoubleQuote",
    expected: "accept",
    input: [
      "header",
      "\""
    ].join("\n")
  },
  {
    name: "testEmptySingleQuotes",
    expected: "accept",
    input: [
      "header",
      "''"
    ].join("\n")
  },
  {
    name: "testEmptyDoubleQuotes",
    expected: "accept",
    input: [
      "header",
      "\"\""
    ].join("\n")
  },
  {
    name: "testMatchedSingleQuotes",
    expected: "accept",
    input: [
      "header",
      "'value'"
    ].join("\n")
  },
  {
    name: "testMatchedDoubleQuotes",
    expected: "accept",
    input: [
      "header",
      "\"value\""
    ].join("\n")
  },
  {
    name: "testMixedQuotesInList",
    expected: "accept",
    input: [
      "header",
      "['a', \"b\", c]"
    ].join("\n")
  },
  {
    name: "testUnquotedValue",
    expected: "accept",
    input: [
      "header",
      "abc"
    ].join("\n")
  },
  {
    name: "testMultipleColumns",
    expected: "accept",
    input: [
      "a | b | c",
      "1 | 2 | 3"
    ].join("\n")
  },
  {
    name: "testEmptyCell",
    expected: "accept",
    input: [
      "a | b",
      " | "
    ].join("\n")
  },
  {
    name: "testListValue",
    expected: "accept",
    input: [
      "header",
      "[1, 2, 3]"
    ].join("\n")
  },
  {
    name: "testSetValue",
    expected: "accept",
    input: [
      "header",
      "{1, 2, 3}"
    ].join("\n")
  },
  {
    name: "testMapValue",
    expected: "accept",
    input: [
      "header",
      "[a: 1, b: 2]"
    ].join("\n")
  },
  {
    name: "testNestedStructures",
    expected: "accept",
    input: [
      "header",
      "[[1, 2], [3, 4]]"
    ].join("\n")
  },
  {
    name: "testCommentLine",
    expected: "accept",
    input: [
      "header",
      "// comment",
      "value"
    ].join("\n")
  },
  {
    name: "testQuotedPipe",
    expected: "accept",
    input: [
      "header",
      "'|'"
    ].join("\n")
  },
  {
    name: "testQuotedBracket",
    expected: "accept",
    input: [
      "header",
      "'['"
    ].join("\n")
  },
  {
    name: "testQuotedBrace",
    expected: "accept",
    input: [
      "header",
      "'{'"
    ].join("\n")
  },
  {
    name: "testInlineCommentAtEndOfRow",
    expected: "accept",
    input: [
      "a | b",
      "4 // | 5"
    ].join("\n")
  },
  {
    name: "testValueStartingWithSlashSlash",
    expected: "accept",
    input: [
      "a | b",
      "6 | // 7"
    ].join("\n")
  },
  {
    name: "testValueEndingWithSlashSlash",
    expected: "accept",
    input: [
      "a | b",
      "8 | 9 //"
    ].join("\n")
  },
  {
    name: "testQuotedSlashSlash",
    expected: "accept",
    input: [
      "a | b",
      "'//2' | 3"
    ].join("\n")
  },
  {
    name: "testTimestampInList",
    expected: "accept",
    input: [
      "header",
      "[2025-08-01T00:00:00]"
    ].join("\n")
  },
  {
    name: "testTimestampValue",
    expected: "accept",
    input: [
      "header",
      "2025-08-01T00:00:00"
    ].join("\n")
  },
  {
    name: "testListWithNestedLists",
    expected: "accept",
    input: [
      "header",
      "[[a], [b], [c]]"
    ].join("\n")
  },
  {
    name: "testListWithSet",
    expected: "accept",
    input: [
      "header",
      "[{a,b}, c]"
    ].join("\n")
  },
  {
    name: "testListWithMap",
    expected: "accept",
    input: [
      "header",
      "[[a:b], c]"
    ].join("\n")
  },
  {
    name: "testSetWithList",
    expected: "accept",
    input: [
      "header",
      "{[a],[b],[b]}"
    ].join("\n")
  },
  {
    name: "testSetWithMap",
    expected: "accept",
    input: [
      "header",
      "{[a:b], [a:b]}"
    ].join("\n")
  },
  {
    name: "testNestedMap",
    expected: "accept",
    input: [
      "header",
      "[A:[a:1], B:[b:2], C:[c:3]]"
    ].join("\n")
  },
  {
    name: "testMapWithEmptyMap",
    expected: "accept",
    input: [
      "header",
      "[m:[:], s:a]"
    ].join("\n")
  },
  {
    name: "testMapWithSet",
    expected: "accept",
    input: [
      "header",
      "[s:{a,b}, t:{c}]"
    ].join("\n")
  },
  {
    name: "testMapWithList",
    expected: "accept",
    input: [
      "header",
      "[l:[a,b], i:[c]]"
    ].join("\n")
  },
  {
    name: "testMapWithQuotedValue",
    expected: "accept",
    input: [
      "header",
      "[q:\"a,b\", u:c]"
    ].join("\n")
  },
  {
    name: "testScenarioColumn",
    expected: "accept",
    input: [
      "Scenario | Input | Result?",
      "Test | value | expected"
    ].join("\n")
  },
  {
    name: "testBlankLinesWithWhitespace",
    expected: "accept",
    input: [
      "a | b",
      "   ",
      "1 | 2"
    ].join("\n")
  },
  {
    name: "testEmptyQuotedStringInCell",
    expected: "accept",
    input: [
      "header",
      "''"
    ].join("\n")
  },
  {
    name: "testValueWithSpaces",
    expected: "accept",
    input: [
      "header",
      "abc def"
    ].join("\n")
  },
  {
    name: "testQuotedValueWithSpaces",
    expected: "accept",
    input: [
      "header",
      "' a b c '"
    ].join("\n")
  },
  {
    name: "testMixedContentSet",
    expected: "accept",
    input: [
      "header",
      "{{},a,a,{}}"
    ].join("\n")
  },
  {
    name: "testNestedSet",
    expected: "accept",
    input: [
      "header",
      "{{a}, {b}, {b}}"
    ].join("\n")
  },
  {
    name: "testMapWithSingleQuotedValueContainingComma",
    expected: "accept",
    input: [
      "header",
      "[q:'a,b', u:c]"
    ].join("\n")
  },
  {
    name: "testListWithDoubleQuotedValueContainingComma",
    expected: "accept",
    input: [
      "header",
      "[\"a,b\", c]"
    ].join("\n")
  },
  {
    name: "testListWithSingleQuotedValueContainingComma",
    expected: "accept",
    input: [
      "header",
      "['a,b', c]"
    ].join("\n")
  },
  {
    name: "testSetWithDoubleQuotedValueContainingComma",
    expected: "accept",
    input: [
      "header",
      "{\"a,b\", c}"
    ].join("\n")
  },
  {
    name: "testSetWithSingleQuotedValueContainingComma",
    expected: "accept",
    input: [
      "header",
      "{'a,b', c}"
    ].join("\n")
  },
  {
    name: "testQuotedValueContainingColon",
    expected: "accept",
    input: [
      "header",
      "[key:'a:b']"
    ].join("\n")
  },
  {
    name: "testQuotedValueContainingBracket",
    expected: "accept",
    input: [
      "header",
      "[key:'a]b']"
    ].join("\n")
  },
  {
    name: "testQuotedValueContainingBrace",
    expected: "accept",
    input: [
      "header",
      "{'a}b', c}"
    ].join("\n")
  },
  {
    name: "testListWithQuotedCommaNotFirstElement",
    expected: "accept",
    input: [
      "header",
      "[a, \"b,c\"]"
    ].join("\n")
  },
  {
    name: "testSetWithQuotedCommaNotFirstElement",
    expected: "accept",
    input: [
      "header",
      "{a, 'b,c'}"
    ].join("\n")
  },
  {
    name: "testListWithQuotedClosingBracket",
    expected: "accept",
    input: [
      "header",
      "['a]b']"
    ].join("\n")
  },
  {
    name: "testSetWithQuotedClosingBrace",
    expected: "accept",
    input: [
      "header",
      "{'a}b'}"
    ].join("\n")
  },
  {
    name: "testSimpleMapWithQuotedValue",
    expected: "accept",
    input: [
      "header",
      "[key:'value']"
    ].join("\n")
  },
  {
    name: "testQuotedEmptyList",
    expected: "accept",
    input: [
      "header",
      "\"[]\""
    ].join("\n")
  },
  {
    name: "testQuotedEmptySet",
    expected: "accept",
    input: [
      "header",
      "\"{}\""
    ].join("\n")
  },
  {
    name: "testQuotedEmptyMap",
    expected: "accept",
    input: [
      "header",
      "\"[:]\""
    ].join("\n")
  },
  {
    name: "testSingleClosingBracket",
    expected: "accept",
    input: [
      "header",
      "]"
    ].join("\n")
  },
  {
    name: "testSingleClosingBrace",
    expected: "accept",
    input: [
      "header",
      "}"
    ].join("\n")
  },
  {
    name: "testMapClosingOnly",
    expected: "accept",
    input: [
      "header",
      ":]"
    ].join("\n")
  },
  {
    name: "testPrefixBeforeBrackets",
    expected: "accept",
    input: [
      "header",
      "a[]"
    ].join("\n")
  },
  {
    name: "testPrefixBeforeBraces",
    expected: "accept",
    input: [
      "header",
      "a{}"
    ].join("\n")
  },
  {
    name: "testPrefixBeforeMap",
    expected: "accept",
    input: [
      "header",
      "a[:]"
    ].join("\n")
  },
  {
    name: "testWhitespaceInList",
    expected: "accept",
    input: [
      "header",
      "  [  a  ,  a  ]  "
    ].join("\n")
  },
  {
    name: "testWhitespaceInSet",
    expected: "accept",
    input: [
      "header",
      "  {  a  ,  a  }  "
    ].join("\n")
  },
  {
    name: "testWhitespaceInMap",
    expected: "accept",
    input: [
      "header",
      "  [   a   :  a   ]  "
    ].join("\n")
  },
  {
    name: "testSingleQuotedMapKey",
    expected: "accept",
    input: [
      "header",
      "['key': 'value']"
    ].join("\n")
  },
  {
    name: "testDoubleQuotedMapKey",
    expected: "accept",
    input: [
      "header",
      "[\"key\": \"value\"]"
    ].join("\n")
  },
  {
    name: "testQuotedMapKeyWithSpaces",
    expected: "accept",
    input: [
      "header",
      "['key with spaces': value]"
    ].join("\n")
  },
  {
    name: "testQuotedMapKeyWithColon",
    expected: "accept",
    input: [
      "header",
      "['key:with:colon': value]"
    ].join("\n")
  },
  {
    name: "testQuotedMapKeyWithSpecialChars",
    expected: "accept",
    input: [
      "header",
      "['!@#$%^&*()': value]"
    ].join("\n")
  },
  {
    name: "testQuotedMapKeyWithBrackets",
    expected: "accept",
    input: [
      "header",
      "['key[with]brackets': value]"
    ].join("\n")
  },
  {
    name: "testQuotedMapKeyWithBraces",
    expected: "accept",
    input: [
      "header",
      "['key{with}braces': value]"
    ].join("\n")
  },
  {
    name: "testQuotedMapKeyWithComma",
    expected: "accept",
    input: [
      "header",
      "['key,with,comma': value]"
    ].join("\n")
  },
  {
    name: "testQuotedMapKeyWithMixedSpecials",
    expected: "accept",
    input: [
      "header",
      "['key:[],{}': value]"
    ].join("\n")
  },
  {
    name: "testMixedQuotedAndUnquotedMapKeys",
    expected: "accept",
    input: [
      "header",
      "['quoted': 1, unquoted: 2, \"double\": 3]"
    ].join("\n")
  },
  {
    name: "testTripleSingleQuotes",
    expected: "reject",
    input: [
      "header",
      "'''"
    ].join("\n")
  },
  {
    name: "testTripleDoubleQuotes",
    expected: "reject",
    input: [
      "header",
      "\"\"\""
    ].join("\n")
  },
  {
    name: "testStandaloneOpeningBracket",
    expected: "reject",
    input: [
      "header",
      "["
    ].join("\n")
  },
  {
    name: "testStandaloneOpeningBrace",
    expected: "reject",
    input: [
      "header",
      "{"
    ].join("\n")
  },
  {
    name: "testMissingClosingForEmptyMap",
    expected: "reject",
    input: [
      "header",
      "[:"
    ].join("\n")
  },
  {
    name: "testListWithBrace",
    expected: "reject",
    input: [
      "header",
      "[a, b}"
    ].join("\n")
  },
  {
    name: "testSetWithBracket",
    expected: "reject",
    input: [
      "header",
      "{a, b]"
    ].join("\n")
  },
  {
    name: "testMapWithBrace",
    expected: "reject",
    input: [
      "header",
      "[a: b}"
    ].join("\n")
  },
  {
    name: "testBraceBracketMismatch",
    expected: "reject",
    input: [
      "header",
      "{a: b]"
    ].join("\n")
  },
  {
    name: "testDoubleOpeningBracket",
    expected: "reject",
    input: [
      "header",
      "[[]"
    ].join("\n")
  },
  {
    name: "testDoubleOpeningBrace",
    expected: "reject",
    input: [
      "header",
      "{{}"
    ].join("\n")
  },
  {
    name: "testDoubleOpeningWithMap",
    expected: "reject",
    input: [
      "header",
      "[[:]"
    ].join("\n")
  },
  {
    name: "testDoubleClosingBracket",
    expected: "reject",
    input: [
      "header",
      "[]]"
    ].join("\n")
  },
  {
    name: "testDoubleClosingBrace",
    expected: "reject",
    input: [
      "header",
      "{}}"
    ].join("\n")
  },
  {
    name: "testDoubleClosingWithMap",
    expected: "reject",
    input: [
      "header",
      "[:]]"
    ].join("\n")
  },
  {
    name: "testTrailingCharAfterList",
    expected: "reject",
    input: [
      "header",
      "[]a"
    ].join("\n")
  },
  {
    name: "testTrailingCharAfterSet",
    expected: "reject",
    input: [
      "header",
      "{}a"
    ].join("\n")
  },
  {
    name: "testTrailingCharAfterMap",
    expected: "reject",
    input: [
      "header",
      "[:]a"
    ].join("\n")
  },
  {
    name: "testListTrailingComma",
    expected: "reject",
    input: [
      "header",
      "[a,]"
    ].join("\n")
  },
  {
    name: "testSetTrailingComma",
    expected: "reject",
    input: [
      "header",
      "{a,}"
    ].join("\n")
  },
  {
    name: "testMapTrailingComma",
    expected: "reject",
    input: [
      "header",
      "[a:b,]"
    ].join("\n")
  }
];

function isBlankLine(line: string): boolean {
  return line.trim() === "";
}

function isCommentLine(line: string): boolean {
  return line.trimStart().startsWith("//");
}

function hasMultipleColumns(text: string): boolean {
  return text.split("\n").some((line) => !isBlankLine(line) && !isCommentLine(line) && countColumns(line) > 1);
}

function countColumns(line: string): number {
  let columns = 1;
  let quote: "\"" | "'" | null = null;
  let escaped = false;

  for (const char of line) {
    if (quote !== null) {
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
      continue;
    }

    if (char === "|") {
      columns += 1;
    }
  }

  return columns;
}

function toRecognisedTable(input: string): string {
  if (hasMultipleColumns(input)) {
    return input;
  }

  let headerSeen = false;
  return input
    .split("\n")
    .map((line) => {
      if (isBlankLine(line) || isCommentLine(line)) {
        return line;
      }
      if (!headerSeen) {
        headerSeen = true;
        return `${line} | ok?`;
      }
      return `${line} | ok`;
    })
    .join("\n");
}

function assertAccepted(caseData: ConformanceCase): void {
  const recognised = toRecognisedTable(caseData.input);
  const issues = findTableIssues(recognised);
  assert.deepStrictEqual(issues, [], `${caseData.name} should not report diagnostics`);

  const formatted = formatTableString(recognised);
  const formattedIssues = findTableIssues(formatted);
  assert.deepStrictEqual(formattedIssues, [], `${caseData.name} should remain valid after formatting`);
  assert.strictEqual(formatTableString(formatted), formatted, `${caseData.name} should format idempotently`);
}

function assertRejected(caseData: ConformanceCase): void {
  const recognised = toRecognisedTable(caseData.input);
  const issues = findTableIssues(recognised);
  assert.ok(issues.length > 0, `${caseData.name} should report diagnostics`);
  assert.strictEqual(formatTableString(recognised), recognised, `${caseData.name} should not be reformatted`);
}

for (const caseData of conformanceCases) {
  test(caseData.name, () => {
    if (caseData.expected === "accept") {
      assertAccepted(caseData);
      return;
    }
    assertRejected(caseData);
  });
}

test("accepts leading comments before the header row", () => {
  const table = [
    "// explanation",
    "header | ok?",
    "value  | ok"
  ].join("\n");

  assert.deepStrictEqual(findTableIssues(table), []);
  assert.strictEqual(formatTableString(table), table);
});
