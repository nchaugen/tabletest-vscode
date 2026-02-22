import * as vscode from "vscode";
import { TableTestFormatter } from "./formatter";

/**
 * Syntax highlighting is provided via a TextMate injection grammar (see syntaxes/).
 */
export function activate(context: vscode.ExtensionContext) {
	const formatter = new TableTestFormatter();
	const supportedLanguages = new Set(["java", "kotlin", "tabletest"]);

	context.subscriptions.push(
		vscode.languages.registerDocumentFormattingEditProvider([{ language: "tabletest" }], formatter),
		vscode.commands.registerCommand("tabletest.formatAllTables", async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				void vscode.window.showInformationMessage("No active editor to format TableTest tables.");
				return;
			}

			const document = editor.document;
			if (!supportedLanguages.has(document.languageId)) {
				void vscode.window.showInformationMessage("TableTest formatting is only available for Java, Kotlin, or .table files.");
				return;
			}

			const edits = formatter.provideDocumentFormattingEdits(document);
			if (edits.length === 0) {
				return;
			}

			const workspaceEdit = new vscode.WorkspaceEdit();
			workspaceEdit.set(document.uri, edits);
			await vscode.workspace.applyEdit(workspaceEdit);
		})
	);
}

export function deactivate() {}
