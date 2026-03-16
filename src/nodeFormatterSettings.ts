import * as path from "node:path";
import { fileURLToPath } from "node:url";

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
