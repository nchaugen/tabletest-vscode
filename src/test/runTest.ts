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

function isHeadlessHostAbort(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("signal SIGABRT") || message.includes("Abort trap: 6");
}

function shouldRequireKotlin(): boolean {
  return process.env.TABLETEST_REQUIRE_KOTLIN === "1";
}

function stripDefaultCliPaths(cliArgs: string[]): string[] {
  return cliArgs.filter(
    (arg) =>
      !arg.startsWith("--extensions-dir") &&
      !arg.startsWith("--user-data-dir") &&
      !arg.startsWith("--prof-startup")
  );
}

async function installKotlinExtensionIfPossible(
  vscodeExecutablePath: string,
  userDataDir: string,
  extensionsDir: string
): Promise<void> {
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

    const vscodeExecutablePath = await downloadAndUnzipVSCode();
    await installKotlinExtensionIfPossible(vscodeExecutablePath, userDataDir, extensionsDir);

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
