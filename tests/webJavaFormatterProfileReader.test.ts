import * as assert from "node:assert/strict";
import * as test from "node:test";
import { WebJavaFormatterProfileReader } from "../src/webJavaFormatterProfileReader";

test("web formatter profile reader always falls back to defaults", () => {
  const reader = new WebJavaFormatterProfileReader();

  assert.strictEqual(reader.readIndentLevels({} as never, ["a", "b"]), null);
});
