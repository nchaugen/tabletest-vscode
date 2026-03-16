import * as vscode from "vscode";
import { activateTableTestExtension } from "../activateExtension";
import { WebJavaFormatterProfileReader } from "../webJavaFormatterProfileReader";

export function activate(context: vscode.ExtensionContext) {
  activateTableTestExtension(context, new WebJavaFormatterProfileReader());
}

export function deactivate() {}
