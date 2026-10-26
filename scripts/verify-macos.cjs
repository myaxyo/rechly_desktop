// Run after packaging, or against the app copied out of the DMG.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
if (process.platform !== "darwin")
  throw new Error("Signature verification requires macOS.");
const args = process.argv.slice(2),
  distribution = args.includes("--distribution");
const supplied = args.find((arg) => !arg.startsWith("--"));
const candidates = supplied
  ? [path.resolve(supplied)]
  : ["mac", "mac-arm64", "mac-x64"]
      .map((dir) =>
        path.resolve(__dirname, "../dist", dir, "Rechly Desktop.app"),
      )
      .filter((p) => fs.existsSync(p));
if (!candidates.length)
  throw new Error(
    "No packaged app found. Run npm run dist:mac first, or pass the .app path.",
  );
for (const app of candidates) {
  execFileSync(
    "/usr/bin/codesign",
    ["--verify", "--deep", "--strict", "--verbose=2", app],
    { stdio: "inherit" },
  );
  if (distribution) {
    execFileSync("/usr/bin/xcrun", ["stapler", "validate", app], {
      stdio: "inherit",
    });
    execFileSync(
      "/usr/sbin/spctl",
      ["--assess", "--type", "execute", "--verbose=4", app],
      { stdio: "inherit" },
    );
  }
  console.log(
    `${distribution ? "Signature, notarization ticket and Gatekeeper assessment" : "Bundle signature integrity"} verified: ${app}`,
  );
}
if (!distribution)
  console.log(
    "Apple trust was not assessed. For distribution, rerun with --distribution.",
  );
