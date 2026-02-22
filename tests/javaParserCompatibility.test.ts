import * as assert from "node:assert/strict";
import * as test from "node:test";
import { formatTableString } from "../src/parser";

type CompatibilityCase = {
  name: string;
  input: string;
  expected: string;
  expectsTableFallback?: boolean;
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
    name: "quoted map keys should remain unchanged",
    input: "[\"a\":b]",
    expected: "[\"a\":b]",
    expectsTableFallback: true
  }
];

test("java parser compatibility (collection formatting)", () => {
  const deviations = cases.flatMap((c) => {
    const actual = formatCell(c.input);
    const expectedRow = c.expectsTableFallback ? `a|${c.expected}` : `a | ${c.expected}`;
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
    assert.fail(`Formatter deviates from Java parser expectations:\n${deviations.join("\n")}`);
  }
});
