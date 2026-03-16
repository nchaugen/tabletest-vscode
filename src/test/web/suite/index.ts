import { webSmokeTests } from "./web.integration.test";

export async function run(): Promise<void> {
  const failures: string[] = [];

  for (const smokeTest of webSmokeTests()) {
    try {
      await smokeTest.run();
      console.log(`PASS ${smokeTest.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${smokeTest.name}: ${message}`);
      console.error(`FAIL ${smokeTest.name}`, error);
    }
  }

  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
}
