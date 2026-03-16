const { spawn } = require("node:child_process");

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    const child = spawn(npmCommand(), ["run", scriptName], {
      stdio: "inherit",
      env: process.env
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      if (signal) {
        reject(new Error(`npm run ${scriptName} exited with signal ${signal}`));
        return;
      }

      reject(new Error(`npm run ${scriptName} exited with code ${code ?? 1}`));
    });
  });
}

async function main() {
  await runScript("test:unit");
  await runScript("test:integration:strict");
  await runScript("test:integration:web");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
