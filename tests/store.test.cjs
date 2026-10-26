const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const Database = require("better-sqlite3");
const { DatabaseStore } = require("../out/databaseStore");
const { getDefaultStore } = require("../out/storeDefaults");
const { BackupSelection } = require("../out/backupService");
const codec = {
  encrypt: (value) => "protected:" + Buffer.from(value).toString("base64"),
  decrypt: (value) => Buffer.from(value.slice(10), "base64").toString(),
};
function fixture(t, seed) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rechly-sqlite-"));
  if (seed)
    fs.writeFileSync(path.join(dir, "rechly_vault.json"), JSON.stringify(seed));
  const store = new DatabaseStore(dir, codec);
  t.after(() => {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return { dir, store };
}
test("migrates legacy JSON losslessly, keeps the original, and reads SQLite on later launches", (t) => {
  const initial = getDefaultStore();
  initial.company.name = "Existing Business";
  const { dir, store } = fixture(t, initial);
  const legacy = fs.readFileSync(path.join(dir, "rechly_vault.json"));
  store.initialize();
  assert.equal(
    fs.readFileSync(store.file).subarray(0, 16).toString(),
    "SQLite format 3\0",
  );
  assert.deepEqual(store.get("invoices"), initial.invoices);
  assert.equal(store.get("company").name, "Existing Business");
  assert.deepEqual(
    fs.readFileSync(path.join(dir, "rechly_vault.json")),
    legacy,
  );
  store.set("company", { name: "SQLite is authoritative" });
  store.close();
  store.initialize();
  assert.equal(store.get("company").name, "SQLite is authoritative");
  const db = new Database(store.file, { readonly: true });
  assert.equal(db.pragma("journal_mode", { simple: true }), "wal");
  assert.equal(db.pragma("quick_check", { simple: true }), "ok");
  db.close();
  if (process.platform !== "win32")
    assert.equal(fs.statSync(store.file).mode & 0o777, 0o600);
});
test("corrupt or incomplete legacy files never turn into a fresh demo database", (t) => {
  const { dir, store } = fixture(t);
  const legacy = path.join(dir, "rechly_vault.json");
  fs.writeFileSync(legacy, '{"company":');
  assert.throws(() => store.initialize());
  assert.equal(fs.existsSync(store.file), false);
  assert.equal(fs.readFileSync(legacy, "utf8"), '{"company":');
  fs.writeFileSync(
    legacy,
    JSON.stringify({ version: 1, company: {}, invoices: [] }),
  );
  assert.throws(() => store.initialize(), /Daten/);
  assert.equal(fs.existsSync(store.file), false);
});
test("failed multi-table commits roll back disk state and memory", (t) => {
  const { store } = fixture(t);
  store.initialize();
  const before = store.getAll();
  const db = new Database(store.file);
  db.exec(
    "CREATE TRIGGER fail_invoice BEFORE UPDATE ON invoices BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END",
  );
  assert.throws(
    () =>
      store.transaction((draft) => {
        draft.company.name = "Must not persist";
        draft.invoices[0].invoice_number = "CHANGED";
      }),
    /simulated write failure/,
  );
  assert.deepEqual(store.getAll(), before);
  db.close();
  store.close();
  store.initialize();
  assert.equal(store.get("company").name, before.company.name);
  assert.equal(
    store.get("invoices")[0].invoice_number,
    before.invoices[0].invoice_number,
  );
});
test("changed records are updated without rewriting unrelated tables", (t) => {
  const { store } = fixture(t);
  store.initialize();
  const db = new Database(store.file);
  db.exec(
    "CREATE TRIGGER no_invoice_rewrite BEFORE UPDATE ON invoices BEGIN SELECT RAISE(ABORT, 'unrelated rewrite'); END",
  );
  store.set("company", { name: "One small change" });
  assert.equal(store.get("company").name, "One small change");
  db.close();
});
test("returned objects and failed validation cannot mutate live data", (t) => {
  const { store } = fixture(t);
  const before = store.getAll(),
    copy = store.getAll();
  copy.company.name = "Leak";
  assert.deepEqual(store.getAll(), before);
  assert.throws(
    () =>
      store.transaction((draft) => {
        draft.company.name = "Leak";
        throw Error("Invalid");
      }),
    /Invalid/,
  );
  assert.throws(
    () => store.set("invoices", [...before.invoices, ...before.invoices]),
    /doppelte ID/,
  );
  assert.deepEqual(store.getAll(), before);
});
test("API keys are protected at rest and omitted from portable encrypted backups", async (t) => {
  const { dir, store } = fixture(t);
  store.saveAiSettings({ openai_key: "private-test-key" });
  store.close();
  assert.equal(
    fs.readFileSync(store.file).includes(Buffer.from("private-test-key")),
    false,
  );
  store.initialize();
  assert.equal(store.getAiSettings().openai_key, "private-test-key");
  const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), "rechly-export-"));
  t.after(() => fs.rmSync(exportDir, { recursive: true, force: true }));
  const file = path.join(exportDir, "secure.rechly-backup");
  await store.exportBackup(file, "test-only-long-passphrase");
  assert.equal(
    fs.readFileSync(file).includes(Buffer.from(store.get("company").name)),
    false,
  );
  const selection = new BackupSelection(),
    selected = selection.select(file);
  assert.equal(selected.encrypted, true);
  await assert.rejects(
    selection.preview(selected.token, "incorrect-long-password"),
    /Passwort/,
  );
  assert.throws(() => selection.take(selected.token), /zuerst/);
  const preview = await selection.preview(
    selected.token,
    "test-only-long-passphrase",
  );
  assert.equal(preview.containsApiKeys, false);
  assert.equal(selection.take(selected.token).aiSettings.openai_key, "");
  await assert.rejects(
    store.exportBackup(store.file, "test-only-long-passphrase"),
    /andere Sicherungsdatei/,
  );
  const broken = path.join(exportDir, "tampered.rechly-backup"),
    bytes = fs.readFileSync(file);
  bytes[bytes.length - 1] ^= 1;
  fs.writeFileSync(broken, bytes);
  const altered = selection.select(broken);
  await assert.rejects(
    selection.preview(altered.token, "test-only-long-passphrase"),
    /beschädigte/,
  );
  assert.equal(store.getAiSettings().openai_key, "private-test-key");
});
test("unavailable OS credential storage fails migration without exposing keys or replacing the JSON", (t) => {
  const data = getDefaultStore();
  data.aiSettings.openai_key = "legacy-secret";
  const { dir } = fixture(t, data);
  const blocked = new DatabaseStore(dir, {
    encrypt() {
      throw Error("Keychain locked");
    },
    decrypt() {
      throw Error("Keychain locked");
    },
  });
  t.after(() => blocked.close());
  assert.throws(() => blocked.initialize(), /Keychain locked/);
  assert.equal(fs.existsSync(blocked.file), false);
  assert.match(
    fs.readFileSync(path.join(dir, "rechly_vault.json"), "utf8"),
    /legacy-secret/,
  );
});
test("restore validates before changing data and keeps a local pre-restore snapshot", async (t) => {
  const { store, dir } = fixture(t);
  store.set("company", { name: "Before restore" });
  const initial = store.getAll();
  assert.throws(() => store.restore({ ...initial, clients: null }), /clients/);
  assert.equal(store.get("company").name, "Before restore");
  const replacement = getDefaultStore();
  replacement.company.name = "Imported";
  store.restore(replacement);
  assert.equal(store.get("company").name, "Imported");
  const saved = fs
    .readdirSync(store.backupDirectory)
    .find((n) => n.startsWith("before-restore-"));
  assert.ok(saved);
  assert.equal(
    store.readSnapshot(path.join(store.backupDirectory, saved)).company.name,
    "Before restore",
  );
  const selection = new BackupSelection();
  const file = selection.select(path.join(store.backupDirectory, saved), (p) =>
    store.readSnapshot(p),
  );
  const preview = await selection.preview(file.token, "");
  assert.equal(preview.company, "Before restore");
});
test("corrupt database fails closed and recovery preserves the original bytes", (t) => {
  const { store, dir } = fixture(t);
  store.initialize();
  store.close();
  const original = store.file;
  fs.writeFileSync(original, "broken SQLite database");
  const bytes = fs.readFileSync(original);
  assert.throws(() => store.initialize());
  assert.deepEqual(fs.readFileSync(original), bytes);
  const data = getDefaultStore();
  data.company.name = "Recovered";
  store.recover(data);
  assert.equal(store.get("company").name, "Recovered");
  assert.notEqual(store.file, original);
  assert.deepEqual(fs.readFileSync(original), bytes);
  store.close();
  const reopened = new DatabaseStore(dir, codec);
  t.after(() => reopened.close());
  assert.equal(reopened.get("company").name, "Recovered");
  reopened.close();
});
test("future database versions are rejected without downgrading", (t) => {
  const { store } = fixture(t);
  store.initialize();
  store.close();
  const db = new Database(store.file);
  db.pragma("user_version = 99");
  db.close();
  assert.throws(() => store.initialize(), /Datenbankversion/);
  const check = new Database(store.file, { readonly: true });
  assert.equal(check.pragma("user_version", { simple: true }), 99);
  check.close();
});
test("SQLite recovers committed changes and discards unfinished transactions after process exit", (t) => {
  const { store } = fixture(t);
  store.initialize();
  const file = store.file;
  store.close();
  const { spawnSync } = require("node:child_process");
  const modulePath = require.resolve("better-sqlite3");
  const result = spawnSync(
    process.execPath,
    [
      "-e",
      `const Database=require(${JSON.stringify(modulePath)});const db=new Database(${JSON.stringify(file)});db.pragma('synchronous=FULL');db.prepare('UPDATE metadata SET payload=? WHERE key=?').run(JSON.stringify({name:'Committed'}),'company');db.exec('BEGIN IMMEDIATE');db.prepare('UPDATE metadata SET payload=? WHERE key=?').run(JSON.stringify({name:'Uncommitted'}),'company');process.exit(0);`,
    ],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" } },
  );
  assert.equal(result.status, 0, result.stderr.toString());
  store.initialize();
  assert.equal(store.get("company").name, "Committed");
});
test("restore rejects dangerous keys and broken references", (t) => {
  const { store } = fixture(t);
  const before = store.getAll();
  const bad = JSON.parse(JSON.stringify(before));
  bad.invoices[0].client_id = "missing";
  assert.throws(() => store.restore(bad), /fehlenden/);
  const injected = JSON.parse(JSON.stringify(before));
  injected.company = JSON.parse('{"__proto__":{"polluted":true}}');
  assert.throws(() => store.restore(injected), /Schlüssel/);
  assert.equal({}.polluted, undefined);
  assert.deepEqual(store.getAll(), before);
});

test("a missing database cannot silently re-import stale legacy JSON", (t) => {
  const { store } = fixture(t, getDefaultStore());
  store.initialize();
  store.set("company", { name: "Newest data" });
  store.close();
  fs.unlinkSync(store.file);
  assert.throws(() => store.initialize(), /Datenbank fehlt/);
  assert.equal(fs.existsSync(store.file), false);
});
