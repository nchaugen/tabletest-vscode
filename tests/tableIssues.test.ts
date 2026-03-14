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

test("does not report issues for quoted empty values and quoted whitespace", () => {
  const table = [
    "",
    "Value|Length?",
    "\"\"|0",
    "''|0",
    "\"  x  \"|5",
    ""
  ].join("\n");

  const issues = findTableIssues(table);
  assert.deepStrictEqual(issues, []);
});

test("does not report issues for quoted map keys", () => {
  const table = [
    "",
    "a|b",
    "[\"a:a\": b]|x",
    "['[a]': b]|x",
    "[plain: y, \"quoted\": z, 'single': w]|x",
    "[\"suc|c e|s s\": 3]|x",
    ""
  ].join("\n");

  const issues = findTableIssues(table);
  assert.deepStrictEqual(issues, []);
});

test("reports unquoted scalar values containing commas", () => {
  const table = [
    "",
    "Value|Length?",
    "World, hello|12",
    ""
  ].join("\n");

  const issues = findTableIssues(table);
  assert.strictEqual(issues.length, 1);

  const issue = issues[0];
  assert.ok(issue);
  assert.strictEqual(table.slice(issue.start, issue.end), "World, hello");
  assert.strictEqual(
    issue.message,
    "Invalid unquoted value in table cell; quote values containing ',', ':', '[' or '|'."
  );
});

test("reports unquoted scalar values containing colons", () => {
  const table = [
    "",
    "Map|Size?",
    "key: value|1",
    ""
  ].join("\n");

  const issues = findTableIssues(table);
  assert.strictEqual(issues.length, 1);

  const issue = issues[0];
  assert.ok(issue);
  assert.strictEqual(table.slice(issue.start, issue.end), "key: value");
  assert.strictEqual(
    issue.message,
    "Invalid unquoted value in table cell; quote values containing ',', ':', '[' or '|'."
  );
});

test("reports unquoted map keys containing spaces", () => {
  const table = [
    "",
    "Map|Size?",
    "[key with spaces: value]|1",
    ""
  ].join("\n");

  const issues = findTableIssues(table);
  assert.strictEqual(issues.length, 1);

  const issue = issues[0];
  assert.ok(issue);
  assert.strictEqual(table.slice(issue.start, issue.end), "[key with spaces: value]");
  assert.strictEqual(
    issue.message,
    "Invalid unquoted map key in table cell; quote keys containing whitespace or reserved characters."
  );
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

test("reports empty map syntax with inner whitespace as malformed collection", () => {
  const table = [
    "",
    "Map|Size?",
    "[: ]|0",
    ""
  ].join("\n");

  const issues = findTableIssues(table);
  assert.strictEqual(issues.length, 1);

  const issue = issues[0];
  assert.ok(issue);
  assert.strictEqual(table.slice(issue.start, issue.end), "[: ]");
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
