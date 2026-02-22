import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
  runTests
} from "@vscode/test-electron";

const execFileAsync = promisify(execFile);
const kotlinExtensionId = "fwcd.kotlin";

async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");
    const extensionsDir = path.resolve(extensionDevelopmentPath, ".vscode-test/extensions");

    const vscodeExecutablePath = await downloadAndUnzipVSCode();
    const [cliPath, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

    await execFileAsync(cliPath, [
      ...cliArgs,
      "--extensions-dir",
      extensionsDir,
      "--install-extension",
      kotlinExtensionId
    ]);

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      vscodeExecutablePath,
      launchArgs: ["--extensions-dir", extensionsDir]
    });
  } catch (error) {
    console.error("Failed to run VS Code integration tests.", error);
    process.exit(1);
  }
}

void main();
