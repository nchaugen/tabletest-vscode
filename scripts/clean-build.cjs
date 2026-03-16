const fs = require("node:fs");
const path = require("node:path");

const directories = process.argv.slice(2);

if (directories.length === 0) {
  console.error("Expected one or more build directories to remove.");
  process.exit(1);
}

for (const directory of directories) {
  fs.rmSync(path.resolve(__dirname, "..", directory), { recursive: true, force: true });
}
