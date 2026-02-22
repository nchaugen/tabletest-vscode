import * as fs from "node:fs";
import * as path from "node:path";
import * as Mocha from "mocha";

function collectTests(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectTests(fullPath);
    }
    return entry.name.endsWith(".test.js") ? [fullPath] : [];
  });
}

export function run(): Promise<void> {
  const mocha = new Mocha({ ui: "tdd", color: true });
  const testsRoot = path.resolve(__dirname);
  const files = collectTests(testsRoot);

  files.forEach((file) => mocha.addFile(file));

  return new Promise((resolve, reject) => {
    try {
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} test(s) failed.`));
        } else {
          resolve();
        }
      });
    } catch (error) {
      reject(error as Error);
    }
  });
}
