import * as vscode from "vscode";
import { activateTableTestExtension } from "./activateExtension";
import { NodeJavaFormatterProfileReader } from "./nodeJavaFormatterProfileReader";

export function activate(context: vscode.ExtensionContext) {
	activateTableTestExtension(context, new NodeJavaFormatterProfileReader());
}

export function deactivate() {}
