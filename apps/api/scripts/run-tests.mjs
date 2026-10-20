/**
 * Sequential test runner.
 *
 * Node's built-in `node --test` spawns one child process per test file, which is
 * blocked in restricted sandboxes (spawn EPERM). Running each file with
 * `node <file>` preserves per-file isolation (separate process, separate
 * SQLite database) and still executes the `node:test` suite in TAP mode.
 *
 * Usage: npm test  (or node scripts/run-tests.mjs tests/auth.test.ts)
 */
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const testsDir = path.join(root, "tests");

const requested = process.argv.slice(2);
const files = requested.length
  ? requested
  : readdirSync(testsDir)
      .filter((name) => name.endsWith(".test.ts"))
      .sort()
      .map((name) => path.join(testsDir, name));

let failed = 0;
for (const file of files) {
  const label = path.relative(root, file);
  console.log(`\n\x1b[36m=== ${label} ===\x1b[0m`);
  const started = Date.now();
  const result = spawnSync(process.execPath, [file], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "test", LOG_LEVEL: process.env.LOG_LEVEL ?? "error" },
  });
  const duration = ((Date.now() - started) / 1000).toFixed(1);
  if (result.status !== 0) {
    failed += 1;
    console.error(`\x1b[31mFAIL ${label} (${duration}s, exit ${result.status ?? "signal"})\x1b[0m`);
  } else {
    console.log(`\x1b[32mPASS ${label} (${duration}s)\x1b[0m`);
  }
}

console.log(`\n${files.length - failed}/${files.length} test files passed`);
process.exit(failed === 0 ? 0 : 1);
