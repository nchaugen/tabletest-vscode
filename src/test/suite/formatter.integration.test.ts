import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { suite, test } from "mocha";

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

async function openDocument(language: "java" | "kotlin", content: string): Promise<vscode.TextDocument> {
  await activateExtension();
  const baseDocument = await vscode.workspace.openTextDocument({ language, content });
  const document =
    baseDocument.languageId === language
      ? baseDocument
      : await vscode.languages.setTextDocumentLanguage(baseDocument, language);
  await vscode.window.showTextDocument(document);
  return document;
}

async function formatDocument(language: "java" | "kotlin", content: string): Promise<string> {
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

async function withJavaArrayContinuationIndent(level: number, run: () => Promise<void>): Promise<void> {
  const javaConfig = vscode.workspace.getConfiguration("java");
  const existing = javaConfig.inspect<string>("format.settings.url");
  const previousGlobalValue = existing?.globalValue;
  const profilePath = path.join(
    os.tmpdir(),
    `tabletest-java-formatter-${Date.now()}-${Math.random().toString(16).slice(2)}.xml`
  );

  const profile = [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<profiles version=\"21\">",
    "  <profile kind=\"CodeFormatterProfile\" name=\"TableTestTemp\" version=\"21\">",
    `    <setting id=\"org.eclipse.jdt.core.formatter.continuation_indentation_for_array_initializer\" value=\"${level}\"/>`,
    "  </profile>",
    "</profiles>"
  ].join("\n");

  fs.writeFileSync(profilePath, profile, "utf8");
  await javaConfig.update("format.settings.url", profilePath, vscode.ConfigurationTarget.Global);
  try {
    await run();
  } finally {
    await javaConfig.update("format.settings.url", previousGlobalValue, vscode.ConfigurationTarget.Global);
    fs.rmSync(profilePath, { force: true });
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

  test("formats a Java implicit string-array table", async () => {
    const input = "@TableTest({\"name|age\",\"Alice|30\",\"Bob|7\"})";

    const expected = [
      "@TableTest({",
      "        \"name  | age\",",
      "        \"Alice | 30 \",",
      "        \"Bob   | 7  \"",
      "})"
    ].join("\n");

    const actual = await formatDocument("java", input);
    assert.strictEqual(actual, expected);
  });

  test("formats a Java named value string-array table", async () => {
    const input = "@TableTest(value = {\"a|b\",\"1|22\"}, name = \"x\")";

    const expected = [
      "@TableTest(value = {",
      "        \"a | b \",",
      "        \"1 | 22\"",
      "}, name = \"x\")"
    ].join("\n");

    const actual = await formatDocument("java", input);
    assert.strictEqual(actual, expected);
  });

  test("uses Java formatter array continuation indentation when tabletest indent is not explicitly configured", async () => {
    await withNoExplicitExtraIndent(async () => {
      await withJavaArrayContinuationIndent(2, async () => {
        const input = "@TableTest({\"a|b\",\"1|22\"})";

        const expected = [
          "@TableTest({",
          "        \"a | b \",",
          "        \"1 | 22\"",
          "})"
        ].join("\n");

        const actual = await formatDocument("java", input);
        assert.strictEqual(actual, expected);
      });
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

  test("does not surface diagnostics for escaped quote collection values in Java string arrays", async () => {
    const input = [
      "@TableTest({",
      "\"a|b\",",
      "\"[k:\\\"v\\\"]|ok\"",
      "})"
    ].join("\n");

    const document = await openDocument("java", input);
    const diagnostics = await waitForDiagnostics(document);
    assert.strictEqual(diagnostics.length, 0);
  });
});
