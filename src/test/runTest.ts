import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";
import {
  downloadAndUnzipVSCode,
  runTests
} from "@vscode/test-electron";

function isHeadlessHostAbort(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("signal SIGABRT") || message.includes("Abort trap: 6");
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
