import * as fs from "node:fs";
import * as path from "node:path";

type WebQuality = "stable" | "insiders";

type DownloadedBuild = {
  location: string;
};

const { downloadAndUnzipVSCode } = require("@vscode/test-web/out/server/download") as {
  downloadAndUnzipVSCode: (
    vscodeTestDir: string,
    quality: WebQuality,
    commit?: string
  ) => Promise<DownloadedBuild>;
};

export async function prepareWebRuntime(testRunnerDataDir: string, quality: WebQuality): Promise<string> {
  const cachedBuildLocation = findCachedBuildLocation(testRunnerDataDir, quality);
  if (cachedBuildLocation) {
    ensureWorkbenchCssAlias(cachedBuildLocation);
    return cachedBuildLocation;
  }

  const build = await downloadAndUnzipVSCode(testRunnerDataDir, quality);
  ensureWorkbenchCssAlias(build.location);
  return build.location;
}

function ensureWorkbenchCssAlias(buildLocation: string): void {
  const workbenchDirectory = path.join(buildLocation, "out", "vs", "workbench");
  const expectedCssPath = path.join(workbenchDirectory, "workbench.web.main.css");
  const internalCssPath = path.join(workbenchDirectory, "workbench.web.main.internal.css");

  if (fs.existsSync(expectedCssPath) || !fs.existsSync(internalCssPath)) {
    return;
  }

  fs.copyFileSync(internalCssPath, expectedCssPath);
}

function findCachedBuildLocation(testRunnerDataDir: string, quality: WebQuality): string | null {
  if (!fs.existsSync(testRunnerDataDir)) {
    return null;
  }

  const prefix = `vscode-web-${quality}-`;
  const cachedBuildDirectories = fs.readdirSync(testRunnerDataDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));

  for (const directoryName of cachedBuildDirectories) {
    const buildLocation = path.join(testRunnerDataDir, directoryName);
    const versionMarker = path.join(buildLocation, "version");
    if (fs.existsSync(versionMarker)) {
      return buildLocation;
    }
  }

  return null;
}
