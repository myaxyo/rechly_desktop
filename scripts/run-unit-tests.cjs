// The SQLite addon is compiled for Electron's Node ABI, including on native CI runners.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const files = fs
  .readdirSync(path.join(__dirname, "../tests"))
  .filter((n) => n.endsWith(".test.cjs"))
  .map((n) => path.join(__dirname, "../tests", n));
const result = spawnSync(require("electron"), ["--test", ...files], {
  encoding: "utf8",
  maxBuffer: 8 * 1024 * 1024,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
});
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
if (process.env.GITHUB_ACTIONS && (result.error || result.status !== 0)) {
  const detail = (
    result.error?.message ||
    result.stderr ||
    result.stdout ||
    "Unit tests failed"
  )
    .slice(-5500)
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A");
  console.log(`::error title=Storage and domain test failure::${detail}`);
}
if (result.error) throw result.error;
process.exit(result.status ?? 1);
