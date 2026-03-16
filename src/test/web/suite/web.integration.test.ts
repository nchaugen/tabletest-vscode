import * as vscode from "vscode";

type WebSmokeTest = {
  name: string;
  run: () => Promise<void>;
};

export function webSmokeTests(): readonly WebSmokeTest[] {
  return [
    {
      name: "formats standalone tables through the format provider",
      run: async () => {
        const document = await openTableDocument(["a|b", "1|22"].join("\n"));
        const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
          "vscode.executeFormatDocumentProvider",
          document.uri,
          { tabSize: 4, insertSpaces: true }
        );

        if (!edits || edits.length === 0) {
          throw new Error("Expected formatting edits for a standalone TableTest document.");
        }

        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.set(document.uri, edits);
        await vscode.workspace.applyEdit(workspaceEdit);

        expectEqual(document.getText(), ["a | b", "1 | 22"].join("\n"));
      }
    },
    {
      name: "formats standalone tables through the TableTest command",
      run: async () => {
        const document = await openTableDocument(["a|bbb", "22|3"].join("\n"));
        await vscode.commands.executeCommand("tabletest.formatAllTables");

        expectEqual(document.getText(), ["a  | bbb", "22 | 3"].join("\n"));
      }
    },
    {
      name: "publishes diagnostics for malformed standalone table cells",
      run: async () => {
        const document = await openTableDocument(["a|b", "[key:]|1"].join("\n"));
        const diagnostics = await waitForDiagnosticCount(document, 1);

        expectEqual(diagnostics.length, 1);
        expectEqual(diagnostics[0]?.source, "tabletest");
      }
    }
  ];
}

async function activateExtension(): Promise<void> {
  const extension = vscode.extensions.getExtension("tabletest.tabletest");
  if (!extension) {
    throw new Error("TableTest extension is not available in the web test host.");
  }

  await extension.activate();
}

async function openTableDocument(content: string): Promise<vscode.TextDocument> {
  await activateExtension();
  const document = await vscode.workspace.openTextDocument({ language: "tabletest", content });
  await vscode.window.showTextDocument(document);
  return document;
}

async function waitForDiagnosticCount(
  document: vscode.TextDocument,
  count: number,
  timeoutMs: number = 3000
): Promise<readonly vscode.Diagnostic[]> {
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

function expectEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)} but received ${String(actual)}.`);
  }
}
