import * as assert from "node:assert/strict";
import * as test from "node:test";
import { calculateDocumentEdits, DocumentAdapter, Range } from "../src/formatterEdits";

function createFakeDocument(text: string): DocumentAdapter {
  const lineOffsets: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      lineOffsets.push(i + 1);
    }
  }

  const getLineOffset = (line: number): number => {
    if (line <= 0) return 0;
    if (line >= lineOffsets.length) return text.length;
    return lineOffsets[line] ?? text.length;
  };

  return {
    getText: () => text,
    offsetAt: (position) => {
      const lineOffset = getLineOffset(position.line);
      return Math.min(lineOffset + position.character, text.length);
    },
    positionAt: (offset) => {
      const clamped = Math.max(0, Math.min(offset, text.length));
      let line = 0;
      for (let i = 1; i < lineOffsets.length; i++) {
        if (lineOffsets[i] > clamped) break;
        line = i;
      }
      return { line, character: clamped - getLineOffset(line) };
    }
  };
}

test("maps table edits to document positions", () => {
  const text = [
    "prefix",
    "@TableTest(\"\"\"",
    "a|b",
    "1|2",
    "\"\"\")",
    "suffix"
  ].join("\n");

  const document = createFakeDocument(text);
  const edits = calculateDocumentEdits(document, (content) => content.toUpperCase());

  assert.strictEqual(edits.length, 1);
  assert.deepStrictEqual(edits[0]?.range, {
    start: { line: 1, character: 14 },
    end: { line: 4, character: 0 }
  });
});

test("respects selection ranges expressed in positions", () => {
  const text = [
    "before",
    "@TableTest(\"\"\"",
    "a|b",
    "\"\"\")",
    "middle",
    "@TableTest(\"\"\"",
    "x|y",
    "\"\"\")",
    "after"
  ].join("\n");

  const document = createFakeDocument(text);
  const range: Range = {
    start: { line: 5, character: 0 },
    end: { line: 7, character: 3 }
  };

  const edits = calculateDocumentEdits(document, (content) => `<<${content}>>`, range);
  assert.strictEqual(edits.length, 1);
  assert.deepStrictEqual(edits[0]?.range, {
    start: { line: 5, character: 14 },
    end: { line: 7, character: 0 }
  });
});
