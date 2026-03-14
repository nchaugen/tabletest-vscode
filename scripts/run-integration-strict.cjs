const { spawn } = require("node:child_process");

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runScript(scriptName, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(npmCommand(), ["run", scriptName], {
      stdio: "inherit",
      env: environment
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
  const environment = {
    ...process.env,
    TABLETEST_INTEGRATION_STRICT: "1",
    TABLETEST_REQUIRE_KOTLIN: "1"
  };

  await runScript("test:integration", environment);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
