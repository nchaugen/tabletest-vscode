import * as assert from "node:assert/strict";
import * as test from "node:test";
import { findTableIssues } from "../src/parser";

test("does not report issues for valid table content", () => {
  const table = [
    "",
    "a | b",
    "[1, 2] | {x, y}",
    "// comment line",
    ""
  ].join("\n");

  const issues = findTableIssues(table);
  assert.deepStrictEqual(issues, []);
});

test("reports malformed collection cell range", () => {
  const table = [
    "",
    "a|b",
    "[1,2|x",
    ""
  ].join("\n");

  const issues = findTableIssues(table);
  assert.strictEqual(issues.length, 1);

  const issue = issues[0];
  assert.ok(issue);
  assert.strictEqual(table.slice(issue.start, issue.end), "[1,2");
  assert.strictEqual(issue.message, "Invalid collection syntax in table cell; formatting skipped.");
});

test("reports list cell with trailing comma as malformed collection", () => {
  const table = [
    "",
    "a|b",
    "[a, b,]|x",
    ""
  ].join("\n");

  const issues = findTableIssues(table);
  assert.strictEqual(issues.length, 1);

  const issue = issues[0];
  assert.ok(issue);
  assert.strictEqual(table.slice(issue.start, issue.end), "[a, b,]");
  assert.strictEqual(issue.message, "Invalid collection syntax in table cell; formatting skipped.");
});

test("reports map key without value as malformed collection", () => {
  const table = [
    "",
    "a|b",
    "[key:]|x",
    ""
  ].join("\n");

  const issues = findTableIssues(table);
  assert.strictEqual(issues.length, 1);

  const issue = issues[0];
  assert.ok(issue);
  assert.strictEqual(table.slice(issue.start, issue.end), "[key:]");
  assert.strictEqual(issue.message, "Invalid collection syntax in table cell; formatting skipped.");
});

test("reports map value containing extra top-level colons as malformed collection", () => {
  const table = [
    "",
    "a|b",
    "[a: b:c:d]|x",
    ""
  ].join("\n");

  const issues = findTableIssues(table);
  assert.strictEqual(issues.length, 1);

  const issue = issues[0];
  assert.ok(issue);
  assert.strictEqual(table.slice(issue.start, issue.end), "[a: b:c:d]");
  assert.strictEqual(issue.message, "Invalid collection syntax in table cell; formatting skipped.");
});

test("ignores non-table text without pipe separators", () => {
  const table = [
    "",
    "[1,2",
    "{x, y",
    ""
  ].join("\n");

  const issues = findTableIssues(table);
  assert.deepStrictEqual(issues, []);
});
