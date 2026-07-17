import * as assert from "node:assert/strict";
import test from "node:test";
import { formatTableString } from "../src/parser";

type FormatCase = {
  name: string;
  input: string;
  expected: string;
};

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
  return dedented.join("\n").replace(/<s>/g, " ");
}

const cases: FormatCase[] = [
  {
    name: "simple two-column",
    input: table(`
      a|b
      1|22
    `),
    expected: table(`
      a | b
      1 | 22
    `)
  },
  {
    name: "leading/trailing pipes and spaces",
    input: table(`
      <s><s>foo | bar<s>
      <s>baz|qux<s><s>
    `),
    expected: table(`
      foo | bar
      baz | qux
    `)
  },
  {
    name: "uneven columns",
    input: table(`
      h|header2|header3
      1|two|three
      longer|x|y
    `),
    expected: table(`
      h      | header2 | header3
      1      | two     | three
      longer | x       | y
    `)
  },
  {
    name: "ragged rows keep existing columns only",
    input: table(`
      a|b|c
      1|2
      longer|x|y
    `),
    expected: table(`
      a<s><s><s><s><s> | b | c
      1<s><s><s><s><s> | 2
      longer | x | y
    `)
  },
  {
    name: "empty middle cells are preserved",
    input: table(`
      a||c
      1||3
    `),
    expected: table(`
      a |  | c
      1 |  | 3
    `)
  },
  {
    name: "leading empty cells are preserved",
    input: table(`
      |a|b
      |1|2
    `),
    expected: table(`
      <s>| a | b
      <s>| 1 | 2
    `)
  },
  {
    name: "trailing empty cells are preserved",
    input: table(`
      a|b|
      1|2|
    `),
    expected: table(`
      a | b |
      1 | 2 |
    `)
  },
  {
    name: "non-table text without pipes is unchanged",
    input: table(`
      <s><s>just text<s>
      <s><s>more text<s><s>
    `),
    expected: table(`
      <s><s>just text<s>
      <s><s>more text<s><s>
    `)
  },
  {
    name: "keeps empty quoted strings and aligns them",
    input: table(`
      Value|Length?
      ""|0
      ''|0
    `),
    expected: table(`
      Value | Length?
      ""    | 0
      ''    | 0
    `)
  },
  {
    name: "preserves quoted leading and trailing whitespace",
    input: table(`
      Value|Length?
      "  x  "|5
      ' y '|3
    `),
    expected: table(`
      Value   | Length?
      "  x  " | 5
      ' y '   | 3
    `)
  },
  {
    name: "formats collection spacing and preserves quotes",
    input: table(`
      [1,2,"a, b"] | {x , "y"} | [key:"v,1", other : 'z']
    `),
    expected: table(`
      [1, 2, "a, b"] | {x, "y"} | [key: "v,1", other: 'z']
    `)
  },
  {
    name: "formats quoted map keys",
    input: table(`
      ["a:a":b] | ['[b]':c] | [plain:d, "q":'v']
    `),
    expected: table(`
      ["a:a": b] | ['[b]': c] | [plain: d, "q": 'v']
    `)
  },
  {
    name: "formats empty maps",
    input: table(`
      [:] | [a:[:]] | {[:]}
    `),
    expected: table(`
      [:] | [a: [:]] | {[:]}
    `)
  },
  {
    name: "pipes inside quotes are not separators",
    input: table(`
      a|b
      "x|y"|z
      '1|2'|3
    `),
    expected: table(`
      a<s><s><s><s> | b
      "x|y" | z
      '1|2' | 3
    `)
  },
  {
    name: "pipes inside quoted map keys are not separators",
    input: table(`
      a|b
      long|["suc|c e|s s":3]
    `),
    expected: table(`
      a    | b
      long | ["suc|c e|s s": 3]
    `)
  },
  {
    name: "formats nested compound values from parser examples",
    input: table(`
      List|Size?
      [[1,2],[3,4]]|2
      [[a:4],[b:5]]|2
      {[1,2],[1,2]}|1
      [string:abc, list:[1,2], map:[a:4]]|3
    `),
    expected: table(`
      List                                     | Size?
      [[1, 2], [3, 4]]                         | 2
      [[a: 4], [b: 5]]                         | 2
      {[1, 2], [1, 2]}                         | 1
      [string: abc, list: [1, 2], map: [a: 4]] | 3
    `)
  },
  {
    name: "unicode width alignment",
    input: table(`
      a|表|c
      bb|表表|dd
    `),
    expected: table(`
      a<s><s>|<s>表<s><s><s>|<s>c
      bb<s>|<s>表表<s>|<s>dd
    `)
  },
  {
    name: "emoji grapheme alignment",
    input: table(`
      id|i|x
      a|👩‍💻|1
      b|👋🏽|2
      c|1️⃣|3
    `),
    expected: table(`
      id | i<s> | x
      a<s> | 👩‍💻 | 1
      b<s> | 👋🏽 | 2
      c<s> | 1️⃣ | 3
    `)
  },
  {
    name: "unicode standalone table rows pad for wide characters",
    input: table(`
      Scenario|Value|Result?
      ascii|plain text|ok
      hiragana|こんにちは|ok
      emoji simple|😀😀😀|ok
      quoted unicode|"こんにちは 😀"|ok
    `),
    expected: table(`
      Scenario       | Value           | Result?
      ascii          | plain text      | ok
      hiragana       | こんにちは      | ok
      emoji simple   | 😀😀😀          | ok
      quoted unicode | "こんにちは 😀" | ok
    `)
  },
  {
    name: "tab values align using tab stops",
    input: table(`
      k|v|n
      plain|ab|2
      one tab|a	b|3
      two tabs|a		b|4
    `),
    expected: [
      "k        | v          | n",
      "plain    | ab         | 2",
      "one tab  | a\tb     | 3",
      "two tabs | a\t\tb | 4"
    ].join("\n")
  },
  {
    name: "unmatched quotes do not swallow pipes",
    input: table(`
      aa|b|c
      "x|y|z
      '1|2|3
    `),
    expected: table(`
      aa | b | c
      "x | y | z
      '1 | 2 | 3
    `)
  },
  {
    name: "unquoted values containing commas are formatted as valid scalar cells",
    input: table(`
      Value|Length?
      World, hello|12
    `),
    expected: table(`
      Value        | Length?
      World, hello | 12
    `)
  },
  {
    name: "unquoted values containing colons are formatted as valid scalar cells",
    input: table(`
      Map|Size?
      key: value|1
    `),
    expected: table(`
      Map        | Size?
      key: value | 1
    `)
  },
  {
    name: "unquoted map keys containing spaces keep table unchanged",
    input: table(`
      Map|Size?
      [key with spaces: value]|1
    `),
    expected: table(`
      Map|Size?
      [key with spaces: value]|1
    `)
  },
  {
    name: "empty maps with inner whitespace keep table unchanged",
    input: table(`
      Map|Size?
      [: ]|0
    `),
    expected: table(`
      Map|Size?
      [: ]|0
    `)
  },
  {
    name: "invalid collections keep table unchanged",
    input: table(`
      a|b
      [a:b,] | ok
      [a: b} | ok
      {a, b] | ok
      []] | ok
      {}} | ok
      [: ] | ok
    `),
    expected: table(`
      a|b
      [a:b,] | ok
      [a: b} | ok
      {a, b] | ok
      []] | ok
      {}} | ok
      [: ] | ok
    `)
  },
  {
    name: "trailing comma in list keeps table unchanged",
    input: table(`
      a|b
      [a, b,]|ok
    `),
    expected: table(`
      a|b
      [a, b,]|ok
    `)
  },
  {
    name: "map key without value keeps table unchanged",
    input: table(`
      a|b
      [key:]|ok
    `),
    expected: table(`
      a|b
      [key:]|ok
    `)
  },
  {
    name: "map value with extra colons keeps table unchanged",
    input: table(`
      a|b
      [a: b:c:d]|ok
    `),
    expected: table(`
      a|b
      [a: b:c:d]|ok
    `)
  },
  {
    name: "comments and blank lines",
    input: table(`
      a|b
      // keep this

      1|2
    `),
    expected: table(`
      a | b
      // keep this

      1 | 2
    `)
  },
  {
    name: "comments with less indentation are not truncated",
    input: table(`
          a|b
      // keep this
          1|2
    `),
    expected: table(`
      a | b
      // keep this
      1 | 2
    `)
  }
];

for (const c of cases) {
  test(c.name, () => {
    assert.strictEqual(formatTableString(c.input), c.expected);
  });
}

test("applies base indent to formatted rows", () => {
  const input = table(`
    a|b
    1|22
  `);
  const expected = table(`
    <s><s>a | b
    <s><s>1 | 22
  `);
  assert.strictEqual(formatTableString(input, "  "), expected);
});

test("does not insert extra blank lines for triple-quoted table content", () => {
  const input = "\na|b\n1|22\n";
  const expected = "\na | b\n1 | 22\n";
  assert.strictEqual(formatTableString(input), expected);
});

test("is idempotent for triple-quoted table content", () => {
  const input = "\na|b\n1|22\n";
  const once = formatTableString(input);
  const twice = formatTableString(once);
  assert.strictEqual(twice, once);
});

test("does not accumulate indentation on blank lines when base indent is used", () => {
  const input = "\na|b\n// note\n1|22\n";
  const once = formatTableString(input, "    ");
  const twice = formatTableString(once, "    ");

  assert.strictEqual(once, "\n    a | b\n    // note\n    1 | 22\n    ");
  assert.strictEqual(twice, once);
});

test("does not double-indent comments when correcting under-indented rows", () => {
  const input = "\n    // note\na|b\n1|22\n";
  const once = formatTableString(input, "    ");

  assert.strictEqual(once, "\n    // note\n    a | b\n    1 | 22\n    ");
});

test("normalises comment indentation to base indent when formatting host strings", () => {
  const input = "\n  // note\na|b\n1|22\n";
  const once = formatTableString(input, "    ");

  assert.strictEqual(once, "\n    // note\n    a | b\n    1 | 22\n    ");
});

test("aligns trailing closing-quote indentation with base indent", () => {
  const input = "\na|b\n1|22\n";
  const once = formatTableString(input, "    ");

  assert.strictEqual(once, "\n    a | b\n    1 | 22\n    ");
});

test("preserves CRLF line endings when the table uses them", () => {
  const input = "\r\na|b\r\n1|22\r\n";
  const once = formatTableString(input, "    ");

  assert.strictEqual(once, "\r\n    a | b\r\n    1 | 22\r\n    ");
});

test("returns already-formatted CRLF tables unchanged", () => {
  const input = "\r\n    a | b\r\n    1 | 22\r\n    ";
  const once = formatTableString(input, "    ");

  assert.strictEqual(once, input);
});
