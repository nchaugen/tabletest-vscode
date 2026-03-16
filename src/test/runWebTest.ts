import * as path from "node:path";
import { prepareWebRuntime } from "./webRuntime";

type BrowserType = "chromium" | "firefox" | "webkit" | "none";

type WebTestOptions = {
  browserType: BrowserType;
  esm?: boolean;
  extensionDevelopmentPath: string;
  extensionTestsPath: string;
  folderPath?: string;
  headless?: boolean;
  port?: number;
  quality?: "stable" | "insiders";
  testRunnerDataDir?: string;
};

const { runTests } = require("@vscode/test-web") as {
  runTests: (options: WebTestOptions) => Promise<void>;
};

async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");
    const extensionTestsPath = path.resolve(extensionDevelopmentPath, "dist/web/test/suite/index.js");
    const testRunnerDataDir = path.resolve(extensionDevelopmentPath, ".vscode-test-web");
    await prepareWebRuntime(testRunnerDataDir, "stable");

    await runTests({
      browserType: "chromium",
      esm: true,
      extensionDevelopmentPath,
      extensionTestsPath,
      headless: true,
      port: 3010,
      quality: "stable",
      testRunnerDataDir
    });
  } catch (error) {
    console.error("Failed to run VS Code web integration tests.", error);
    process.exit(1);
  }
}

void main();
