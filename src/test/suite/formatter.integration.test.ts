import * as assert from "node:assert/strict";
import * as vscode from "vscode";
import { suite, test } from "mocha";

type SupportedLanguage = "java" | "kotlin" | "tabletest";

async function hasLanguage(language: string): Promise<boolean> {
  const languages = await vscode.languages.getLanguages();
  return languages.includes(language);
}

function shouldRequireKotlin(): boolean {
  return process.env.TABLETEST_REQUIRE_KOTLIN === "1";
}

async function activateExtension(): Promise<void> {
  const extension = vscode.extensions.getExtension("tabletest.tabletest");
  await extension?.activate();
}

async function openDocument(language: SupportedLanguage, content: string): Promise<vscode.TextDocument> {
  await activateExtension();
  const baseDocument = await vscode.workspace.openTextDocument({ language, content });
  const document =
    baseDocument.languageId === language
      ? baseDocument
      : await vscode.languages.setTextDocumentLanguage(baseDocument, language);
  await vscode.window.showTextDocument(document);
  return document;
}

async function formatDocument(language: SupportedLanguage, content: string): Promise<string> {
  const document = await openDocument(language, content);
  await vscode.commands.executeCommand("tabletest.formatAllTables");
  return document.getText();
}

async function withExtraIndentLevel(level: number, run: () => Promise<void>): Promise<void> {
  const config = vscode.workspace.getConfiguration("tabletest");
  const existing = config.inspect<number>("format.extraIndentLevel");
  const previousGlobalValue = existing?.globalValue;
  await config.update("format.extraIndentLevel", level, vscode.ConfigurationTarget.Global);
  try {
    await run();
  } finally {
    await config.update("format.extraIndentLevel", previousGlobalValue, vscode.ConfigurationTarget.Global);
  }
}

async function withNoExplicitExtraIndent(run: () => Promise<void>): Promise<void> {
  const config = vscode.workspace.getConfiguration("tabletest");
  const existing = config.inspect<number>("format.extraIndentLevel");
  const previousGlobalValue = existing?.globalValue;
  await config.update("format.extraIndentLevel", undefined, vscode.ConfigurationTarget.Global);
  try {
    await run();
  } finally {
    await config.update("format.extraIndentLevel", previousGlobalValue, vscode.ConfigurationTarget.Global);
  }
}

async function waitForDiagnostics(document: vscode.TextDocument, timeoutMs: number = 3000): Promise<vscode.Diagnostic[]> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const diagnostics = vscode.languages
      .getDiagnostics(document.uri)
      .filter((diagnostic) => diagnostic.source === "tabletest");
    if (diagnostics.length > 0) {
      return diagnostics;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return [];
}

async function waitForDiagnosticCount(
  document: vscode.TextDocument,
  count: number,
  timeoutMs: number = 3000
): Promise<vscode.Diagnostic[]> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const diagnostics = vscode.languages
      .getDiagnostics(document.uri)
      .filter((diagnostic) => diagnostic.source === "tabletest");
    if (diagnostics.length === count) {
      return diagnostics;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return vscode.languages
    .getDiagnostics(document.uri)
    .filter((diagnostic) => diagnostic.source === "tabletest");
}

async function replaceDocumentText(document: vscode.TextDocument, text: string): Promise<void> {
  const editor = await vscode.window.showTextDocument(document);
  const lastLine = Math.max(document.lineCount - 1, 0);
  const lastCharacter = document.lineAt(lastLine).text.length;
  await editor.edit((editBuilder) => {
    editBuilder.replace(new vscode.Range(0, 0, lastLine, lastCharacter), text);
  });
}

async function withEditorTabSize(tabSize: number, run: () => Promise<void>): Promise<void> {
  const config = vscode.workspace.getConfiguration("editor");
  const existing = config.inspect<number>("tabSize");
  const previousGlobalValue = existing?.globalValue;
  await config.update("tabSize", tabSize, vscode.ConfigurationTarget.Global);
  try {
    await run();
  } finally {
    await config.update("tabSize", previousGlobalValue, vscode.ConfigurationTarget.Global);
  }
}

async function withActiveEditorOptions(
  options: { tabSize?: number; insertSpaces?: boolean },
  run: () => Promise<void>
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error("An active editor is required to adjust editor options.");
  }

  const previousTabSize = editor.options.tabSize;
  const previousInsertSpaces = editor.options.insertSpaces;
  editor.options = {
    tabSize: options.tabSize ?? previousTabSize,
    insertSpaces: options.insertSpaces ?? previousInsertSpaces
  };
  try {
    await run();
  } finally {
    editor.options = {
      tabSize: previousTabSize,
      insertSpaces: previousInsertSpaces
    };
  }
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
      "        a | b",
      "        1 | 22",
      "        \"\"\")"
    ].join("\n");

    const actual = await formatDocument("java", input);
    assert.strictEqual(actual, expected);
  });

  test("does not add extra indent when a Java implicit value comment precedes a text block", async () => {
    const input = [
      "@TableTest(",
      "    // comment before implicit value",
      "    \"\"\"",
      "    a|b",
      "    1|22",
      "    \"\"\"",
      ")"
    ].join("\n");

    const expected = [
      "@TableTest(",
      "    // comment before implicit value",
      "    \"\"\"",
      "    a | b",
      "    1 | 22",
      "    \"\"\"",
      ")"
    ].join("\n");

    const actual = await formatDocument("java", input);
    assert.strictEqual(actual, expected);
  });

  test("formats a Java implicit string-array table", async () => {
    const input = "@TableTest({\"name|age\",\"Alice|30\",\"Bob|7\"})";

    const expected = [
      "@TableTest({",
      "            \"name  | age\",",
      "            \"Alice | 30 \",",
      "            \"Bob   | 7  \"",
      "})"
    ].join("\n");

    const actual = await formatDocument("java", input);
    assert.strictEqual(actual, expected);
  });

  test("formats a Java named value string-array table", async () => {
    const input = "@TableTest(value = {\"a|b\",\"1|22\"}, name = \"x\")";

    const expected = [
      "@TableTest(value = {",
      "            \"a | b \",",
      "            \"1 | 22\"",
      "}, name = \"x\")"
    ].join("\n");

    const actual = await formatDocument("java", input);
    assert.strictEqual(actual, expected);
  });

  test("formats a fully-qualified Java table", async () => {
    const input = [
      "@org.tabletest.junit.TableTest(\"\"\"",
      "a|b",
      "1|22",
      "\"\"\")"
    ].join("\n");

    const expected = [
      "@org.tabletest.junit.TableTest(\"\"\"",
      "        a | b",
      "        1 | 22",
      "        \"\"\")"
    ].join("\n");

    const actual = await formatDocument("java", input);
    assert.strictEqual(actual, expected);
  });

  test("uses Java formatter array continuation indentation when tabletest indent is not explicitly configured", async () => {
    await withNoExplicitExtraIndent(async () => {
      const input = "@TableTest({\"a|b\",\"1|22\"})";

      const expected = [
        "@TableTest({",
        "            \"a | b \",",
        "            \"1 | 22\"",
        "})"
      ].join("\n");

      const actual = await formatDocument("java", input);
      assert.strictEqual(actual, expected);
    });
  });

  test("formats a Kotlin table", async function () {
    if (!(await hasLanguage("kotlin"))) {
      if (shouldRequireKotlin()) {
        assert.fail("Kotlin language support is required but not available in the integration test host.");
      }
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
      "foo | bar",
      "1   | 22",
      "\"\"\"",
      ")"
    ].join("\n");

    const actual = await formatDocument("kotlin", input);
    assert.strictEqual(actual, expected);
  });

  test("formats a standalone table file with the standard format document command", async () => {
    const input = [
      "Value|Length?",
      "\"\"|0",
      "\"  x  \"|5",
      "World, hello|12",
      "key: value|9",
      "[string:abc, list:[1,2], map:[a:4]]|3"
    ].join("\n");

    const expected = [
      "Value                                    | Length?",
      "\"\"                                       | 0",
      "\"  x  \"                                  | 5",
      "World, hello                             | 12",
      "key: value                               | 9",
      "[string: abc, list: [1, 2], map: [a: 4]] | 3"
    ].join("\n");

    const document = await openDocument("tabletest", input);
    await vscode.commands.executeCommand("editor.action.formatDocument");
    assert.strictEqual(document.getText(), expected);
  });

  test("formats only the selected lines in standalone table files", async () => {
    const input = [
      "a|b",
      "1|22",
      "",
      "x|yy",
      "3|4"
    ].join("\n");

    const expected = [
      "a | b",
      "1 | 22",
      "",
      "x|yy",
      "3|4"
    ].join("\n");

    const document = await openDocument("tabletest", input);
    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);

    editor.selection = new vscode.Selection(0, 0, 1, document.lineAt(1).text.length);
    await vscode.commands.executeCommand("editor.action.formatSelection");

    assert.strictEqual(document.getText(), expected);
  });

  test("leaves already formatted standalone table files unchanged", async () => {
    const input = [
      "Value | Length?",
      "\"\"    | 0",
      "\"x\"   | 1"
    ].join("\n");

    const document = await openDocument("tabletest", input);
    await vscode.commands.executeCommand("editor.action.formatDocument");

    assert.strictEqual(document.getText(), input);
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
      "        a     | b",
      "        \"x|y\" | z",
      "        \"\"\")"
    ].join("\n");

    const actual = await formatDocument("java", input);
    assert.strictEqual(actual, expected);
  });

  test("does not add extra comment indentation when fixing under-indented rows", async () => {
    const input = [
      "@TableTest(\"\"\"",
      "    // comment",
      "a|b",
      "1|22",
      "\"\"\")"
    ].join("\n");

    const expected = [
      "@TableTest(\"\"\"",
      "        // comment",
      "        a | b",
      "        1 | 22",
      "        \"\"\")"
    ].join("\n");

    const document = await openDocument("java", input);
    await vscode.commands.executeCommand("tabletest.formatAllTables");
    const afterFirstFormat = document.getText();
    assert.strictEqual(afterFirstFormat, expected);

    await vscode.commands.executeCommand("tabletest.formatAllTables");
    const afterSecondFormat = document.getText();
    assert.strictEqual(afterSecondFormat, expected);
  });

  test("applies configured extra indent levels in Java formatting", async () => {
    await withExtraIndentLevel(2, async () => {
      const input = [
        "@TableTest(\"\"\"a|b",
        "1|22\"\"\")"
      ].join("\n");

      const expected = [
        "@TableTest(\"\"\"        a | b",
        "        1 | 22\"\"\")"
      ].join("\n");

      const actual = await formatDocument("java", input);
      assert.strictEqual(actual, expected);
    });
  });

  test("respects explicit zero extra indent in Java formatting", async () => {
    await withExtraIndentLevel(0, async () => {
      const input = [
        "@TableTest(\"\"\"a|b",
        "1|22\"\"\")"
      ].join("\n");

      const actual = await formatDocument("java", input);
      assert.strictEqual(actual, "@TableTest(\"\"\"a | b\n1 | 22\"\"\")");
    });
  });

  test("uses tabs when the active editor is configured with insertSpaces = false", async () => {
    await withExtraIndentLevel(1, async () => {
      const input = [
        "@TableTest(\"\"\"",
        "a|b",
        "1|22",
        "\"\"\")"
      ].join("\n");

      const document = await openDocument("java", input);
      await withActiveEditorOptions({ tabSize: 4, insertSpaces: false }, async () => {
        await vscode.commands.executeCommand("tabletest.formatAllTables");
      });

      assert.strictEqual(document.getText(), "@TableTest(\"\"\"\n\ta | b\n\t1 | 22\n\t\"\"\")");
    });
  });

  test("prefers configured editor tab size over active editor tab size", async () => {
    await withExtraIndentLevel(1, async () => {
      await withEditorTabSize(2, async () => {
        const input = [
          "@TableTest(\"\"\"",
          "a|b",
          "1|22",
          "\"\"\")"
        ].join("\n");

        const document = await openDocument("java", input);
        await withActiveEditorOptions({ tabSize: 8, insertSpaces: true }, async () => {
          await vscode.commands.executeCommand("tabletest.formatAllTables");
        });

        assert.strictEqual(document.getText(), "@TableTest(\"\"\"\n  a | b\n  1 | 22\n  \"\"\")");
      });
    });
  });

  test("surfaces diagnostics for malformed collection cells", async () => {
    const input = [
      "@TableTest(\"\"\"",
      "a|b",
      "[1,2|x",
      "\"\"\")"
    ].join("\n");

    const document = await openDocument("java", input);
    const diagnostics = await waitForDiagnostics(document);
    assert.ok(diagnostics.length > 0, "Expected at least one tabletest diagnostic");

    const first = diagnostics[0];
    assert.ok(first);
    const highlighted = document.getText(first.range);
    assert.strictEqual(highlighted, "[1,2");
  });

  test("surfaces diagnostics for malformed collection cells in fully-qualified Java tables", async () => {
    const input = [
      "@org.tabletest.junit.TableTest(\"\"\"",
      "a|b",
      "[1,2|x",
      "\"\"\")"
    ].join("\n");

    const document = await openDocument("java", input);
    const diagnostics = await waitForDiagnostics(document);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(document.getText(diagnostics[0].range), "[1,2");
  });

  test("surfaces diagnostics for malformed collection cells in Java string arrays", async () => {
    const input = [
      "@TableTest({",
      "\"a|b\",",
      "\"[1,2|x\"",
      "})"
    ].join("\n");

    const document = await openDocument("java", input);
    const diagnostics = await waitForDiagnostics(document);
    assert.ok(diagnostics.length > 0, "Expected at least one tabletest diagnostic");

    const first = diagnostics[0];
    assert.ok(first);
    const highlighted = document.getText(first.range);
    assert.strictEqual(highlighted, "[1,2");
  });

  test("maps Java string-array diagnostics back to source ranges after escape decoding", async () => {
    const input = [
      "@TableTest({",
      "\"a|b\",",
      "\"\\\"quoted\\\"|[key with spaces: value]\"",
      "})"
    ].join("\n");

    const document = await openDocument("java", input);
    const diagnostics = await waitForDiagnostics(document);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(document.getText(diagnostics[0].range), "[key with spaces: value]");
  });

  test("does not surface diagnostics for escaped quote collection values in Java string arrays", async () => {
    const input = [
      "@TableTest({",
      "\"a|b\",",
      "\"[k:\\\"v\\\"]|ok\"",
      "})"
    ].join("\n");

    const document = await openDocument("java", input);
    const diagnostics = await waitForDiagnosticCount(document, 0, 500);
    assert.strictEqual(diagnostics.length, 0);
  });

  test("does not surface diagnostics for unquoted scalar values containing commas or colons in standalone table files", async () => {
    const input = [
      "Value|Length?",
      "World, hello|12",
      "key: value|9"
    ].join("\n");

    const document = await openDocument("tabletest", input);
    const diagnostics = await waitForDiagnosticCount(document, 0, 500);
    assert.strictEqual(diagnostics.length, 0);
  });

  test("surfaces multiple diagnostics in standalone table files and clears them after a fix", async () => {
    const input = [
      "Value|Length?",
      "[: ]|0",
      "[key with spaces: value]|1"
    ].join("\n");

    const document = await openDocument("tabletest", input);
    const diagnostics = await waitForDiagnosticCount(document, 2);
    assert.strictEqual(diagnostics.length, 2);

    await replaceDocumentText(
      document,
      [
        "Value|Length?",
        "[:]|0",
        "[\"key with spaces\": value]|1"
      ].join("\n")
    );

    const clearedDiagnostics = await waitForDiagnosticCount(document, 0);
    assert.strictEqual(clearedDiagnostics.length, 0);
  });

  test("clears diagnostics when a standalone table document closes", async () => {
    const input = [
      "Value|Length?",
      "[key with spaces: value]|1"
    ].join("\n");

    const document = await openDocument("tabletest", input);
    const diagnostics = await waitForDiagnostics(document);
    assert.strictEqual(diagnostics.length, 1);

    await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");

    const clearedDiagnostics = await waitForDiagnosticCount(document, 0);
    assert.strictEqual(clearedDiagnostics.length, 0);
  });

  test("surfaces diagnostics for invalid map keys in Kotlin tables", async function () {
    if (!(await hasLanguage("kotlin"))) {
      if (shouldRequireKotlin()) {
        assert.fail("Kotlin language support is required but not available in the integration test host.");
      }
      this.skip();
      return;
    }

    const input = [
      "@TableTest(",
      "\"\"\"",
      "a|b",
      "[key with spaces: value]|1",
      "\"\"\"",
      ")"
    ].join("\n");

    const document = await openDocument("kotlin", input);
    const diagnostics = await waitForDiagnostics(document);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(document.getText(diagnostics[0].range), "[key with spaces: value]");
  });
});
