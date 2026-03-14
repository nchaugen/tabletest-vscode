import * as assert from "node:assert/strict";
import * as test from "node:test";
import { formatTableString } from "../src/parser";

type CompatibilityCase = {
  name: string;
  input: string;
  expected: string;
};

function formatCell(value: string): string {
  return formatTableString(`a|${value}`);
}

const cases: CompatibilityCase[] = [
  {
    name: "list spacing",
    input: "[1,2,3]",
    expected: "[1, 2, 3]"
  },
  {
    name: "set spacing",
    input: "{a ,b}",
    expected: "{a, b}"
  },
  {
    name: "map spacing",
    input: "[a:b, c : d]",
    expected: "[a: b, c: d]"
  },
  {
    name: "nested list spacing",
    input: "[[1,2],[3,4]]",
    expected: "[[1, 2], [3, 4]]"
  },
  {
    name: "nested map/list/set spacing",
    input: "[a:[1,2], b:{x,y}]",
    expected: "[a: [1, 2], b: {x, y}]"
  },
  {
    name: "double-quoted map key spacing",
    input: "[\"a:a\":b]",
    expected: "[\"a:a\": b]"
  },
  {
    name: "single-quoted map key spacing",
    input: "['[a]':b]",
    expected: "['[a]': b]"
  }
];

test("collection formatting compatibility", () => {
  const deviations = cases.flatMap((c) => {
    const actual = formatCell(c.input);
    const expectedRow = `a | ${c.expected}`;
    if (actual === expectedRow) return [];
    return [
      [
        `- ${c.name}`,
        `  input:    ${c.input}`,
        `  expected: ${expectedRow}`,
        `  actual:   ${actual}`
      ].join("\n")
    ];
  });

  if (deviations.length > 0) {
    assert.fail(`Formatter deviates from collection formatting expectations:\n${deviations.join("\n")}`);
  }
});
