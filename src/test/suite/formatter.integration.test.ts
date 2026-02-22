import * as assert from "node:assert/strict";
import * as vscode from "vscode";
import { suite, test } from "mocha";

async function hasLanguage(language: string): Promise<boolean> {
  const languages = await vscode.languages.getLanguages();
  return languages.includes(language);
}

async function formatDocument(language: "java" | "kotlin", content: string): Promise<string> {
  const extension = vscode.extensions.getExtension("nchaugen.tabletest");
  await extension?.activate();

  const baseDocument = await vscode.workspace.openTextDocument({ language, content });
  const document =
    baseDocument.languageId === language
      ? baseDocument
      : await vscode.languages.setTextDocumentLanguage(baseDocument, language);
  await vscode.window.showTextDocument(document);

  await vscode.commands.executeCommand("tabletest.formatAllTables");
  return document.getText();
}

suite("TableTest formatter integration", () => {
  test("formats a Java table", async () => {
    const input = [
      "@TableTest(\"\"\"",
      "a|b",
      "1|22",
      "\"\"\")"
    ].join("\n");

    const expected = [
      "@TableTest(\"\"\"",
      "",
      "a | b",
      "1 | 22",
      "",
      "\"\"\")"
    ].join("\n");

    const actual = await formatDocument("java", input);
    assert.strictEqual(actual, expected);
  });

  test("formats a Kotlin table", async function () {
    if (!(await hasLanguage("kotlin"))) {
      this.skip();
      return;
    }

    const input = [
      "@TableTest(",
      "\"\"\"",
      "foo|bar",
      "1|22",
      "\"\"\"",
      ")"
    ].join("\n");

    const expected = [
      "@TableTest(",
      "\"\"\"",
      "",
      "foo | bar",
      "1   | 22",
      "",
      "\"\"\"",
      ")"
    ].join("\n");

    const actual = await formatDocument("kotlin", input);
    assert.strictEqual(actual, expected);
  });

  test("keeps pipes inside quotes within a cell", async () => {
    const input = [
      "@TableTest(\"\"\"",
      "a|b",
      "\"x|y\"|z",
      "\"\"\")"
    ].join("\n");

    const expected = [
      "@TableTest(\"\"\"",
      "",
      "a     | b",
      "\"x|y\" | z",
      "",
      "\"\"\")"
    ].join("\n");

    const actual = await formatDocument("java", input);
    assert.strictEqual(actual, expected);
  });
});
