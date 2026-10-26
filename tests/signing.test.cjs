const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm"),
  fs = require("node:fs"),
  path = require("node:path");
function fixture(env = {}) {
  let signed;
  const context = {
    module: { exports: {} },
    process: { platform: "darwin", env },
    console: { log() {} },
    require: (name) => {
      assert.equal(name, "@electron/osx-sign");
      return {
        signAsync: async (options) => {
          signed = options;
        },
      };
    },
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../scripts/sign-macos.cjs"), "utf8"),
    context,
  );
  return { sign: context.module.exports, options: () => signed };
}
test("local Mac builds receive ad-hoc signatures with original per-file entitlements", async () => {
  const f = fixture(),
    optionsForFile = () => ({ entitlements: "electron.plist" });
  await f.sign({
    platform: "darwin",
    app: "/app",
    optionsForFile,
    strictVerify: false,
  });
  assert.equal(f.options().identity, "-");
  assert.equal(f.options().preAutoEntitlements, false);
  assert.equal(
    f.options().optionsForFile("helper").entitlements,
    "electron.plist",
  );
  assert.equal(f.options().optionsForFile("helper").timestamp, "none");
  assert.equal(f.options().strictVerify, undefined);
});
test("certificate builds preserve identity and reject silent ad-hoc notarization fallback", async () => {
  const f = fixture({ APPLE_ID: "builder@example.invalid" });
  await assert.rejects(f.sign({ platform: "darwin" }), /Developer ID/);
  assert.equal(f.options(), undefined);
  await f.sign({
    platform: "darwin",
    identity: "certificate-hash",
    preAutoEntitlements: true,
  });
  assert.equal(f.options().identity, "certificate-hash");
  assert.equal(f.options().preAutoEntitlements, true);
  const required = fixture({ RECHLY_REQUIRE_NOTARIZATION: "1" });
  await assert.rejects(required.sign({ platform: "darwin" }), /Developer ID/);
});

test("required notarization with a certificate still requires credentials", async () => {
  const f = fixture({ RECHLY_REQUIRE_NOTARIZATION: "1" });
  await assert.rejects(
    f.sign({ platform: "darwin", identity: "certificate-hash" }),
    /credentials/,
  );
  assert.equal(f.options(), undefined);
});
