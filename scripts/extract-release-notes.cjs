#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const version = process.argv[2];

if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  console.error("Usage: node scripts/extract-release-notes.cjs <version>");
  process.exit(1);
}

const changelogPath = path.resolve(__dirname, "..", "CHANGELOG.md");
const changelog = fs.readFileSync(changelogPath, "utf8");
const headingPattern = new RegExp(`^## \\[${escapeRegExp(version)}\\] - .*$`, "m");
const headingMatch = changelog.match(headingPattern);

if (!headingMatch || headingMatch.index === undefined) {
  console.error(`Could not find release notes for ${version} in CHANGELOG.md.`);
  process.exit(1);
}

const bodyStart = headingMatch.index + headingMatch[0].length;
const afterHeading = changelog.slice(bodyStart);
const nextHeadingIndex = afterHeading.search(/\n## \[[^\]]+\]/);
const body = (nextHeadingIndex < 0 ? afterHeading : afterHeading.slice(0, nextHeadingIndex)).trim();

if (body === "") {
  console.error(`Release notes for ${version} are empty.`);
  process.exit(1);
}

process.stdout.write(`${body}\n`);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
