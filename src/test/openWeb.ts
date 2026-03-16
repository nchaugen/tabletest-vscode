import { spawn } from "node:child_process";
import * as path from "node:path";
import { prepareWebRuntime } from "./webRuntime";

type WebServerConfig = {
  build: {
    location: string;
    type: "static";
  };
  extensionDevelopmentPath: string;
  esm: boolean;
  printServerLog?: boolean;
};

const { runServer } = require("@vscode/test-web/out/server/main") as {
  runServer: (host: string, port: number, config: WebServerConfig) => Promise<{ close: (callback?: () => void) => void }>;
};

function shouldOpenBrowser(): boolean {
  return process.env.TABLETEST_WEB_OPEN?.trim() !== "0";
}

function resolvePort(): number {
  const configuredPort = Number.parseInt(process.env.TABLETEST_WEB_PORT ?? "", 10);
  if (Number.isFinite(configuredPort) && configuredPort > 0) {
    return configuredPort;
  }
  return 3010;
}

async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");
    const testRunnerDataDir = path.resolve(extensionDevelopmentPath, ".vscode-test-web");
    const port = resolvePort();
    const host = "localhost";
    const buildLocation = await prepareWebRuntime(testRunnerDataDir, "stable");
    const server = await runServer(host, port, {
      build: {
        location: buildLocation,
        type: "static"
      },
      extensionDevelopmentPath,
      esm: true
    });
    const url = `http://${host}:${port}`;

    if (shouldOpenBrowser()) {
      openBrowser(url);
    }

    console.log(`Opened VS Code for the Web on ${url}`);
    console.log("The TableTest web extension is loaded from this workspace.");
    console.log("Close the browser window or press Ctrl+C to stop the local server.");

    const shutdown = () => {
      server.close(() => process.exit(0));
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("Failed to open VS Code for the Web.", error);
    process.exit(1);
  }
}

function openBrowser(url: string): void {
  const platform = process.platform;
  if (platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    return;
  }

  if (platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    return;
  }

  spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}

void main();
