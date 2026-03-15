#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const version = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  console.error("Usage: node scripts/prepare-release.cjs <version> [--dry-run]");
  process.exit(1);
}

const repoRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(repoRoot, "package.json");
const packageLockPath = path.join(repoRoot, "package-lock.json");
const changelogPath = path.join(repoRoot, "CHANGELOG.md");

const packageJson = readJson(packageJsonPath);
const currentVersion = packageJson.version;

if (currentVersion === version) {
  console.error(`package.json is already at version ${version}.`);
  process.exit(1);
}

packageJson.version = version;
writeJson(packageJsonPath, packageJson);

if (fs.existsSync(packageLockPath)) {
  const packageLock = readJson(packageLockPath);
  packageLock.version = version;
  if (packageLock.packages?.[""]) {
    packageLock.packages[""].version = version;
  }
  writeJson(packageLockPath, packageLock);
}

const today = new Date().toISOString().slice(0, 10);
const changelog = fs.readFileSync(changelogPath, "utf8");
const updatedChangelog = updateChangelog(changelog, currentVersion, version, today, repositoryUrl(packageJson));
fs.writeFileSync(changelogPath, updatedChangelog, "utf8");

const mode = dryRun ? "Prepared release files in dry-run mode" : "Prepared release files";
console.log(`${mode} for ${version}.`);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function repositoryUrl(packageJsonValue) {
  const repository = packageJsonValue.repository;
  const url = typeof repository === "string" ? repository : repository?.url;
  if (typeof url !== "string") {
    throw new Error("package.json repository URL is missing.");
  }
  return url.replace(/\.git$/, "");
}

function updateChangelog(changelog, previousVersion, nextVersion, date, repoUrl) {
  const unreleasedHeader = /^## \[Unreleased\]\s*$/m;
  const unreleasedMatch = changelog.match(unreleasedHeader);
  if (!unreleasedMatch || unreleasedMatch.index === undefined) {
    throw new Error("CHANGELOG.md is missing the [Unreleased] heading.");
  }

  const headerStart = unreleasedMatch.index;
  const contentStart = headerStart + unreleasedMatch[0].length;
  const afterHeader = changelog.slice(contentStart);
  const nextSectionIndex = afterHeader.search(/\n## \[[^\]]+\]/);
  if (nextSectionIndex < 0) {
    throw new Error("CHANGELOG.md is missing the next release heading after [Unreleased].");
  }

  const unreleasedBody = afterHeader.slice(0, nextSectionIndex).trim();
  const remainingSections = afterHeader.slice(nextSectionIndex + 1);
  const releaseBody = unreleasedBody === "" ? "" : `${unreleasedBody}\n\n`;
  const releaseSection = `## [${nextVersion}] - ${date}\n\n${releaseBody}`;
  const rebuilt = `${changelog.slice(0, headerStart)}## [Unreleased]\n\n${releaseSection}${remainingSections}`;

  const lines = rebuilt.split("\n");
  const unreleasedLinkIndex = lines.findIndex((line) => line.startsWith("[Unreleased]: "));
  if (unreleasedLinkIndex < 0) {
    throw new Error("CHANGELOG.md is missing the [Unreleased] compare link.");
  }

  const nextVersionLink = `[${nextVersion}]: ${repoUrl}/compare/v${previousVersion}...v${nextVersion}`;
  if (lines.some((line) => line.startsWith(`[${nextVersion}]: `))) {
    throw new Error(`CHANGELOG.md already contains a compare link for ${nextVersion}.`);
  }

  lines[unreleasedLinkIndex] = `[Unreleased]: ${repoUrl}/compare/v${nextVersion}...HEAD`;
  lines.splice(unreleasedLinkIndex + 1, 0, nextVersionLink);

  return `${lines.join("\n")}\n`;
}
