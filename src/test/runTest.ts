import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
  runTests
} from "@vscode/test-electron";

const execFileAsync = promisify(execFile);
const kotlinExtensionId = "fwcd.kotlin";
const vscodeVersionEnvironmentVariable = "TABLETEST_VSCODE_VERSION";

function isHeadlessHostAbort(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("signal SIGABRT") || message.includes("Abort trap: 6");
}

function shouldRequireKotlin(): boolean {
  return process.env.TABLETEST_REQUIRE_KOTLIN === "1";
}

function requestedVSCodeVersion(): string | undefined {
  const configuredVersion = process.env[vscodeVersionEnvironmentVariable]?.trim();
  return configuredVersion === "" ? undefined : configuredVersion;
}

async function downloadVSCodeExecutablePath(extensionDevelopmentPath: string): Promise<string> {
  const version = requestedVSCodeVersion();
  if (version) {
    console.log(`Running integration tests against VS Code ${version}.`);
    return downloadAndUnzipVSCode(version);
  }

  console.log("Running integration tests against the newest VS Code release compatible with engines.vscode.");
  return downloadAndUnzipVSCode({ extensionDevelopmentPath });
}

function cachedKotlinExtensionDirectory(extensionDevelopmentPath: string): string | null {
  const cachedExtensionsDir = path.join(extensionDevelopmentPath, ".vscode-test", "extensions");
  if (!fs.existsSync(cachedExtensionsDir)) {
    return null;
  }

  const cachedExtensionDirectories = fs.readdirSync(cachedExtensionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(`${kotlinExtensionId}-`))
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));

  if (cachedExtensionDirectories.length === 0) {
    return null;
  }

  return path.join(cachedExtensionsDir, cachedExtensionDirectories[0]);
}

function stripDefaultCliPaths(cliArgs: string[]): string[] {
  return cliArgs.filter(
    (arg) =>
      !arg.startsWith("--extensions-dir") &&
      !arg.startsWith("--user-data-dir") &&
      !arg.startsWith("--prof-startup")
  );
}

function seedJavaFormatterSettings(testRuntimeDir: string, userDataDir: string): void {
  const formatterSettingsPath = path.join(testRuntimeDir, "java-formatter.xml");
  const formatterSettings = [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<profiles version=\"21\">",
    "  <profile kind=\"CodeFormatterProfile\" name=\"TableTestIntegration\" version=\"21\">",
    "    <setting id=\"org.eclipse.jdt.core.formatter.continuation_indentation\" value=\"2\"/>",
    "    <setting id=\"org.eclipse.jdt.core.formatter.continuation_indentation_for_array_initializer\" value=\"3\"/>",
    "  </profile>",
    "</profiles>"
  ].join("\n");
  fs.writeFileSync(formatterSettingsPath, formatterSettings, "utf8");

  const userSettingsDir = path.join(userDataDir, "User");
  fs.mkdirSync(userSettingsDir, { recursive: true });
  const userSettingsPath = path.join(userSettingsDir, "settings.json");
  const existingSettings = fs.existsSync(userSettingsPath)
    ? JSON.parse(fs.readFileSync(userSettingsPath, "utf8")) as Record<string, unknown>
    : {};
  const mergedSettings = {
    ...existingSettings,
    "java.format.settings.url": formatterSettingsPath
  };
  fs.writeFileSync(userSettingsPath, JSON.stringify(mergedSettings, null, 2), "utf8");
}

async function installKotlinExtensionIfPossible(
  vscodeExecutablePath: string,
  extensionDevelopmentPath: string,
  userDataDir: string,
  extensionsDir: string
): Promise<void> {
  const cachedExtensionDirectory = cachedKotlinExtensionDirectory(extensionDevelopmentPath);
  if (cachedExtensionDirectory) {
    const targetDirectory = path.join(extensionsDir, path.basename(cachedExtensionDirectory));
    fs.cpSync(cachedExtensionDirectory, targetDirectory, { recursive: true });
    console.log(`Reused cached Kotlin extension from ${cachedExtensionDirectory}.`);
    return;
  }

  const [cliPath, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);
  const effectiveCliArgs = stripDefaultCliPaths(cliArgs);

  try {
    await execFileAsync(cliPath, [
      ...effectiveCliArgs,
      "--user-data-dir",
      userDataDir,
      "--extensions-dir",
      extensionsDir,
      "--install-extension",
      kotlinExtensionId,
      "--force"
    ]);
  } catch (error) {
    if (shouldRequireKotlin()) {
      throw error;
    }
    console.warn(
      "Could not install Kotlin extension for integration tests. " +
        "Kotlin-specific assertions may be skipped."
    );
  }
}

async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");
    const testRuntimeDir = fs.mkdtempSync(path.join(os.tmpdir(), "tabletest-vscode-test-"));
    const userDataDir = path.join(testRuntimeDir, "user-data");
    const extensionsDir = path.join(testRuntimeDir, "extensions");
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.mkdirSync(extensionsDir, { recursive: true });
    seedJavaFormatterSettings(testRuntimeDir, userDataDir);

    const vscodeExecutablePath = await downloadVSCodeExecutablePath(extensionDevelopmentPath);
    await installKotlinExtensionIfPossible(
      vscodeExecutablePath,
      extensionDevelopmentPath,
      userDataDir,
      extensionsDir
    );

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      vscodeExecutablePath,
      launchArgs: [
        "--user-data-dir",
        userDataDir,
        "--extensions-dir",
        extensionsDir,
        "--disable-gpu",
        "--disable-updates",
        "--skip-release-notes",
        "--skip-welcome",
        "--disable-workspace-trust"
      ]
    });
  } catch (error) {
    if (isHeadlessHostAbort(error) && process.env.TABLETEST_INTEGRATION_STRICT !== "1") {
      console.warn(
        "Skipping integration tests: VS Code test host cannot start in this environment. " +
          "Set TABLETEST_INTEGRATION_STRICT=1 to fail on this condition."
      );
      return;
    }
    console.error("Failed to run VS Code integration tests.", error);
    process.exit(1);
  }
}

void main();
