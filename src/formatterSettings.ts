import * as path from "node:path";
import { fileURLToPath } from "node:url";

export function hasExplicitConfigurationValue(inspect: unknown): boolean {
  if (!inspect || typeof inspect !== "object") {
    return false;
  }

  const values = inspect as Record<string, unknown>;
  const configuredValues = [
    values.globalValue,
    values.workspaceValue,
    values.workspaceFolderValue,
    values.globalLanguageValue,
    values.workspaceLanguageValue,
    values.workspaceFolderLanguageValue
  ];

  return configuredValues.some((value) => value !== undefined);
}

export function indentStringForLevels(levels: number, tabSize: number, insertSpaces: boolean): string {
  const resolvedLevels = Number.isFinite(levels) ? Math.max(0, Math.floor(levels)) : 0;
  if (resolvedLevels === 0) {
    return "";
  }

  const resolvedTabSize = Number.isFinite(tabSize) ? Math.max(1, Math.floor(tabSize)) : 4;
  const unit = insertSpaces ? " ".repeat(resolvedTabSize) : "\t";
  return unit.repeat(resolvedLevels);
}

export function readFormatterSetting(formatterXml: string, settingId: string): number | null {
  const settingTags = formatterXml.match(/<setting\b[^>]*>/g) ?? [];
  for (const settingTag of settingTags) {
    const id = attributeValue(settingTag, "id");
    if (id !== settingId) {
      continue;
    }

    const value = attributeValue(settingTag, "value");
    if (!value) {
      return null;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return null;
    }

    return Math.max(0, Math.floor(parsed));
  }

  return null;
}

export function attributeValue(tag: string, name: string): string | null {
  const pattern = new RegExp(`${name}\\s*=\\s*(['"])(.*?)\\1`);
  const match = tag.match(pattern);
  return match?.[2] ?? null;
}

export function resolveJavaFormatterSettingsPath(
  configuredUrl: string,
  workspaceRoot: string,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const trimmed = configuredUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  if (/^file:/i.test(trimmed)) {
    try {
      return fileURLToPath(trimmed);
    } catch {
      return null;
    }
  }

  const expandedWorkspaceValue = expandJavaFormatterPathVariables(trimmed, workspaceRoot, env);

  if (path.isAbsolute(expandedWorkspaceValue)) {
    return expandedWorkspaceValue;
  }
  if (workspaceRoot === "") {
    return null;
  }

  return path.resolve(workspaceRoot, expandedWorkspaceValue);
}

export function expandJavaFormatterPathVariables(
  configuredPath: string,
  workspaceRoot: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  const withWorkspaceVariables =
    workspaceRoot === ""
      ? configuredPath
      : configuredPath.replace(/\$\{workspaceFolder(?::[^}]+)?\}/g, workspaceRoot);
  const withTildeExpanded = withWorkspaceVariables.startsWith("~/")
    ? path.join(env.HOME ?? "~", withWorkspaceVariables.slice(2))
    : withWorkspaceVariables;

  return withTildeExpanded.replace(/\$\{env:([^}]+)\}/g, (_match, name) => env[name] ?? "");
}
