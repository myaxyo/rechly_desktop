const { _electron } = require(
  process.env.RECHLY_PLAYWRIGHT_PATH || "playwright-core",
);
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  assert = require("node:assert/strict");
const { getDefaultStore } = require("../out/storeDefaults");
const root = path.resolve(__dirname, ".."),
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "rechly-storage-ui-")),
  artifacts = fs.mkdtempSync(path.join(os.tmpdir(), "rechly-storage-files-"));
const legacy = getDefaultStore();
legacy.company.name = "Legacy Migration Test";
legacy.onboarding = {
  completed_at: new Date().toISOString(),
  storage_consent_at: new Date().toISOString(),
  cloud_ai_opt_in: false,
};
fs.writeFileSync(
  path.join(profile, "rechly_vault.json"),
  JSON.stringify(legacy),
);
const launch = () =>
  _electron.launch({
    executablePath:
      process.env.RECHLY_EXECUTABLE ||
      require(path.join(root, "node_modules/electron")),
    args: [
      ...(process.env.RECHLY_EXECUTABLE ? [] : [root]),
      "--no-sandbox",
      "--disable-gpu",
      "--user-data-dir=" + profile,
    ],
  });
(async () => {
  let app = await launch();
  try {
    let page = await app.firstWindow();
    await app.evaluate(({ shell }) => {
      shell.showItemInFolder = () => {};
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.waitForSelector(".business-hero");
    assert.equal(
      (await page.evaluate(() => window.rechly.getCompany())).name,
      "Legacy Migration Test",
    );
    assert.ok(fs.existsSync(path.join(profile, "rechly.sqlite")));
    assert.ok(fs.existsSync(path.join(profile, "rechly_vault.json")));
    await page.locator("#nav-settings").click();
    await page.waitForFunction(() =>
      document.getElementById("storage-status")?.textContent.includes("SQLite"),
    );
    assert.match(
      await page.locator("#storage-status").innerText(),
      /nicht verschlüsselt/,
    );
    const backup = path.join(artifacts, "protected.rechly-backup");
    await app.evaluate(({ dialog }, p) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: p });
    }, backup);
    await page
      .getByRole("button", { name: /Tresor-Backup exportieren/ })
      .click();
    await page
      .locator("#storage-form [name=password]")
      .fill("storage-test-password");
    await page
      .locator("#storage-form [name=confirmation]")
      .fill("does-not-match-yet");
    await page.locator("#storage-submit").click();
    await page.waitForFunction(() =>
      document.getElementById("storage-error").textContent.includes("überein"),
    );
    await page
      .locator("#storage-form [name=confirmation]")
      .fill("storage-test-password");
    await page.locator("#storage-submit").click();
    await page.waitForSelector("#storage-dialog", { state: "hidden" });
    assert.equal(
      fs.readFileSync(backup).includes(Buffer.from("Legacy Migration Test")),
      false,
    );
    await page.evaluate(async () => {
      const c = await window.rechly.getCompany();
      await window.rechly.saveCompany({ ...c, name: "Changed after backup" });
    });
    await app.evaluate(({ dialog }, p) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] });
    }, backup);
    await page
      .getByRole("button", { name: /Tresor aus Datei wiederherstellen/ })
      .click();
    await page
      .locator("#storage-form [name=password]")
      .fill("incorrect-long-password");
    await page.locator("#storage-submit").click();
    await page.waitForFunction(() =>
      document
        .getElementById("storage-error")
        .textContent.includes("Falsches Passwort"),
    );
    assert.equal(
      (await page.evaluate(() => window.rechly.getCompany())).name,
      "Changed after backup",
    );
    await page
      .locator("#storage-form [name=password]")
      .fill("storage-test-password");
    await page.locator("#storage-submit").click();
    await page.waitForSelector(".storage-counts");
    assert.match(
      await page.locator("#storage-body").innerText(),
      /Legacy Migration Test/,
    );
    assert.equal(
      (await page.evaluate(() => window.rechly.getCompany())).name,
      "Changed after backup",
    );
    await page.screenshot({
      path: path.join(artifacts, "restore-preview.png"),
    });
    await page.locator("#storage-submit").click();
    await page.waitForSelector("#storage-dialog", { state: "hidden" });
    assert.equal(
      (await page.evaluate(() => window.rechly.getCompany())).name,
      "Legacy Migration Test",
    );
    assert.ok(
      fs
        .readdirSync(path.join(profile, "recovery"))
        .some((n) => n.startsWith("before-restore-")),
    );
    await page.locator("#nav-settings").click();
    await page.locator("#storage-status").scrollIntoViewIfNeeded();
    await page.waitForFunction(() =>
      document.getElementById("storage-status")?.textContent.includes("SQLite"),
    );
    await page.screenshot({
      path: path.join(artifacts, "storage-settings.png"),
    });
    await app.close();
    const original = path.join(profile, "rechly.sqlite");
    fs.writeFileSync(original, "corrupt original database");
    app = await launch();
    page = await app.firstWindow();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.waitForSelector(".recovery-page");
    assert.equal(
      fs.readFileSync(original, "utf8"),
      "corrupt original database",
    );
    await app.evaluate(({ dialog }, p) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] });
    }, backup);
    await page.locator("#recover-backup").click();
    await page
      .locator("#storage-form [name=password]")
      .fill("storage-test-password");
    await page.locator("#storage-submit").click();
    await page.waitForSelector(".storage-counts");
    await page.locator("#storage-submit").click();
    await page.waitForSelector("#storage-dialog", { state: "hidden" });
    assert.equal(
      fs.readFileSync(original, "utf8"),
      "corrupt original database",
    );
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await page.waitForSelector(".business-hero");
    assert.equal(
      (await page.evaluate(() => window.rechly.getCompany())).name,
      "Legacy Migration Test",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: legacy migration, storage disclosure, encrypted backup UI, wrong-password protection, reviewed restore, pre-restore snapshot, corruption recovery, retained original and restart. Artifacts:",
      artifacts,
    );
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
