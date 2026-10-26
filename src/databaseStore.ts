import Database from "better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import type { AiSettings, StoreData } from "./types";
import { getDefaultStore } from "./storeDefaults";
import { collectionNames, rowsOf, validateStore } from "./storageValidation";
import {
  atomicWrite,
  encryptBackup,
  readBackupFile,
  syncDirectory,
} from "./backupCrypto";

export interface SecretCodec {
  encrypt(value: string): string;
  decrypt(value: string): string;
}
const OMIT_METADATA = new Set<string>([...collectionNames, "business"]);
const SCHEMA_VERSION = 1;
function metadata(data: StoreData): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => !OMIT_METADATA.has(key)),
  );
}

/** One database connection per app/profile. Snapshots are published only after COMMIT. */
export class DatabaseStore {
  private db: Database.Database | null = null;
  private data: StoreData | null = null;
  private warning = "";
  private migrated = false;
  file: string;
  readonly backupDirectory: string;
  constructor(
    readonly directory: string,
    private readonly secrets: SecretCodec,
  ) {
    this.file = path.join(directory, "rechly.sqlite");
    this.backupDirectory = path.join(directory, "recovery");
  }
  initialize(): void {
    if (this.db) return;
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const pointer = path.join(this.directory, "storage-location.json");
    if (fs.existsSync(pointer)) {
      const location = JSON.parse(fs.readFileSync(pointer, "utf8"));
      if (
        typeof location.file !== "string" ||
        !/^rechly(?:-recovered-[a-f0-9-]{36})?\.sqlite$/.test(location.file)
      )
        throw new Error("Ungültiger Datenbankpfad.");
      this.file = path.join(this.directory, location.file);
      if (!fs.existsSync(this.file))
        throw new Error(
          "Die ausgewählte Datenbank fehlt. Bitte aus einer Sicherung wiederherstellen.",
        );
    }
    const existing = fs.existsSync(this.file);
    if (!existing) {
      if (
        fs.existsSync(this.backupDirectory) &&
        fs
          .readdirSync(this.backupDirectory)
          .some((name) => name.endsWith(".sqlite"))
      )
        throw new Error(
          "Die Datenbank fehlt, lokale Rücksicherungen sind jedoch vorhanden. Bitte wählen Sie eine Sicherung zur Wiederherstellung.",
        );
      const legacy = path.join(this.directory, "rechly_vault.json");
      // Never replace an unreadable old vault with demo data.
      const initial = fs.existsSync(legacy)
        ? validateStore(JSON.parse(readBackupFile(legacy).toString("utf8")))
        : getDefaultStore();
      if (
        !fs.existsSync(legacy) &&
        fs.existsSync(path.join(this.directory, "rechly_vault.backup.json"))
      )
        throw new Error(
          "Die bisherige Datendatei fehlt; eine alte Sicherung ist vorhanden. Bitte stellen Sie diese wieder her.",
        );
      this.createDatabase(initial, this.file);
      this.migrated = fs.existsSync(legacy);
    }
    let opened: Database.Database | undefined;
    try {
      fs.chmodSync(this.file, 0o600);
      opened = new Database(this.file, { fileMustExist: true, timeout: 5000 });
      this.checkDatabase(opened);
      const loaded = this.read(opened);
      opened.pragma("journal_mode = WAL");
      opened.pragma("synchronous = FULL");
      if (!fs.existsSync(pointer))
        atomicWrite(
          pointer,
          Buffer.from(JSON.stringify({ file: path.basename(this.file) })),
        );
      this.db = opened;
      this.data = loaded;
    } catch (error) {
      opened?.close();
      throw error;
    }
    // Local snapshots aid mistake recovery. They do not replace off-device backups.
    if (existing || this.migrated) {
      const today = new Date().toISOString().slice(0, 10);
      const daily = path.join(this.backupDirectory, `daily-${today}.sqlite`);
      if (!fs.existsSync(daily))
        try {
          this.snapshot("daily", daily);
        } catch {
          this.warning =
            "Die automatische lokale Sicherung ist fehlgeschlagen. Bitte Speicherplatz prüfen und eine externe Sicherung erstellen.";
        }
    }
  }
  private createDatabase(initial: StoreData, target: string): void {
    const staging = path.join(
      this.directory,
      ".migration-" + randomUUID() + ".sqlite",
    );
    let temporary: Database.Database | undefined;
    try {
      fs.closeSync(fs.openSync(staging, "wx", 0o600));
      temporary = new Database(staging);
      temporary.pragma("synchronous = FULL");
      temporary.transaction(() => {
        temporary!.exec(
          "CREATE TABLE metadata (key TEXT PRIMARY KEY, payload TEXT NOT NULL CHECK(json_valid(payload)))",
        );
        for (const name of collectionNames)
          temporary!.exec(
            `CREATE TABLE ${name} (id TEXT PRIMARY KEY, position INTEGER NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload) AND json_extract(payload,'$.id')=id))`,
          );
        temporary!.pragma("user_version = " + SCHEMA_VERSION);
        this.persist(temporary!, null, initial);
      })();
      this.checkDatabase(temporary);
      const roundTrip = this.read(temporary);
      if (
        JSON.stringify(metadata(roundTrip)) !==
        JSON.stringify(metadata(validateStore(initial)))
      )
        throw new Error("Migration konnte nicht verifiziert werden.");
      for (const name of collectionNames)
        if (
          JSON.stringify(rowsOf(roundTrip, name)) !==
          JSON.stringify(rowsOf(initial, name))
        )
          throw new Error(
            "Migration der Datensätze konnte nicht verifiziert werden.",
          );
      temporary.close();
      temporary = undefined;
      fs.renameSync(staging, target);
      syncDirectory(this.directory);
    } finally {
      temporary?.close();
      if (fs.existsSync(staging)) fs.unlinkSync(staging);
    }
  }
  private checkDatabase(db: Database.Database): void {
    if (db.pragma("user_version", { simple: true }) !== SCHEMA_VERSION)
      throw new Error(
        "Nicht unterstützte Datenbankversion. Bitte die passende Rechly-Version verwenden.",
      );
    if (db.pragma("quick_check", { simple: true }) !== "ok")
      throw new Error("Die Datenbank-Integritätsprüfung ist fehlgeschlagen.");
  }
  private encode(key: string, value: unknown): string {
    if (key !== "aiSettings") return JSON.stringify(value);
    const settings = structuredClone(value) as Record<string, unknown>;
    for (const field of ["openai_key", "anthropic_key"])
      if (settings[field])
        settings[field] = {
          osProtected: this.secrets.encrypt(settings[field] as string),
        };
    return JSON.stringify(settings);
  }
  private decode(key: string, payload: string): unknown {
    const value = JSON.parse(payload);
    if (key === "aiSettings")
      for (const field of ["openai_key", "anthropic_key"]) {
        const secret = value[field];
        if (
          secret &&
          typeof secret === "object" &&
          typeof secret.osProtected === "string"
        )
          value[field] = this.secrets.decrypt(secret.osProtected);
        else if (secret)
          throw new Error("Ungeschützter API-Schlüssel in der Datenbank.");
      }
    return value;
  }
  private read(db: Database.Database): StoreData {
    const raw: Record<string, any> = {};
    for (const row of db.prepare("SELECT key,payload FROM metadata").all() as {
      key: string;
      payload: string;
    }[]) {
      if (["__proto__", "constructor", "prototype"].includes(row.key))
        throw new Error("Ungültige Datenbankschlüssel.");
      raw[row.key] = this.decode(row.key, row.payload);
    }
    raw.business = {};
    for (const name of collectionNames) {
      const rows = (
        db
          .prepare(`SELECT payload FROM ${name} ORDER BY position, id`)
          .all() as { payload: string }[]
      ).map((row) => JSON.parse(row.payload));
      if (name === "projects" || name === "tasks" || name === "documents")
        raw.business[name] = rows;
      else raw[name] = rows;
    }
    return validateStore(raw);
  }
  private persist(
    db: Database.Database,
    before: StoreData | null,
    after: StoreData,
  ): void {
    const previous = before ? metadata(before) : {},
      next = metadata(after);
    const upsert = db.prepare(
      "INSERT INTO metadata(key,payload) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload",
    );
    for (const [key, value] of Object.entries(next))
      if (JSON.stringify(value) !== JSON.stringify(previous[key]))
        upsert.run(key, this.encode(key, value));
    for (const key of Object.keys(previous))
      if (!(key in next))
        db.prepare("DELETE FROM metadata WHERE key=?").run(key);
    for (const name of collectionNames) {
      const oldRows = before ? rowsOf(before, name) : [],
        newRows = rowsOf(after, name);
      const old = new Map(
        oldRows.map((row, index) => [
          row.id,
          { index, json: JSON.stringify(row) },
        ]),
      );
      const ids = new Set(newRows.map((row) => row.id));
      const insert = db.prepare(
        `INSERT INTO ${name}(id,position,payload) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET position=excluded.position,payload=excluded.payload`,
      );
      newRows.forEach((row, index) => {
        const json = JSON.stringify(row),
          existing = old.get(row.id);
        if (existing?.index !== index || existing.json !== json)
          insert.run(row.id, index, json);
      });
      const remove = db.prepare(`DELETE FROM ${name} WHERE id=?`);
      for (const row of oldRows) if (!ids.has(row.id)) remove.run(row.id);
    }
  }
  getVaultPath(): string {
    return this.file;
  }
  getInfo() {
    this.initialize();
    return {
      engine: "SQLite",
      databasePath: this.file,
      databaseEncrypted: false,
      backupEncrypted: true,
      secretProtection: "OS credential storage",
      recoveryDirectory: this.backupDirectory,
      legacyFiles: ["rechly_vault.json", "rechly_vault.backup.json"].filter(
        (name) => fs.existsSync(path.join(this.directory, name)),
      ),
      migrated: this.migrated,
      warning: this.warning,
    };
  }
  getAll(): StoreData {
    this.initialize();
    return structuredClone(this.data!);
  }
  get<K extends keyof StoreData>(key: K): StoreData[K] | null {
    this.initialize();
    return this.data![key] === undefined
      ? null
      : structuredClone(this.data![key]);
  }
  set<K extends keyof StoreData>(key: K, value: StoreData[K]): boolean {
    this.transaction((draft) => {
      draft[key] = structuredClone(value);
    });
    return true;
  }
  transaction<T>(mutate: (draft: StoreData) => T): T {
    this.initialize();
    const draft = structuredClone(this.data!);
    const result = mutate(draft);
    const validated = validateStore(draft);
    try {
      this.db!.transaction(() =>
        this.persist(this.db!, this.data, validated),
      ).immediate();
    } catch (error) {
      throw new Error(
        "Änderungen konnten nicht gespeichert werden; die bisherigen Daten bleiben erhalten. " +
          (error instanceof Error ? error.message : String(error)),
      );
    }
    this.data = validated;
    return structuredClone(result);
  }
  getAiSettings(): AiSettings {
    return this.getAll().aiSettings;
  }
  saveAiSettings(settings: Partial<AiSettings>): AiSettings {
    this.set("aiSettings", { ...this.getAiSettings(), ...settings });
    return this.getAiSettings();
  }
  async exportBackup(target: string, password: string): Promise<void> {
    const data = this.getAll();
    data.aiSettings.openai_key = "";
    data.aiSettings.anthropic_key = "";
    const encrypted = await encryptBackup(
      Buffer.from(JSON.stringify(data), "utf8"),
      password,
    );
    this.assertExternalBackup(target);
    atomicWrite(target, encrypted);
  }
  private assertExternalBackup(target: string): void {
    const resolved = path.join(
      fs.realpathSync(path.dirname(target)),
      path.basename(target),
    );
    if (
      path.dirname(resolved) === fs.realpathSync(this.directory) ||
      path.dirname(resolved) ===
        path.join(fs.realpathSync(this.directory), "recovery") ||
      ["rechly_vault.json", "rechly_vault.backup.json"].some(
        (n) => resolved === path.join(this.directory, n),
      )
    )
      throw new Error(
        "Bitte eine andere Sicherungsdatei wählen; interne Datendateien dürfen nicht überschrieben werden.",
      );
  }
  readSnapshot(file: string): StoreData {
    const database = new Database(file, {
      readonly: true,
      fileMustExist: true,
    });
    try {
      database.pragma("trusted_schema = OFF");
      return database.transaction(() => {
        this.checkDatabase(database);
        return this.read(database);
      })();
    } finally {
      database.close();
    }
  }
  recover(data: StoreData): void {
    const validated = validateStore(data);
    this.close();
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const file = "rechly-recovered-" + randomUUID() + ".sqlite";
    this.createDatabase(validated, path.join(this.directory, file));
    // Atomic pointer switch keeps the damaged database and its WAL untouched.
    atomicWrite(
      path.join(this.directory, "storage-location.json"),
      Buffer.from(JSON.stringify({ file })),
    );
    this.file = path.join(this.directory, file);
    this.initialize();
  }
  restore(data: StoreData): void {
    const validated = validateStore(data);
    this.initialize();
    this.snapshot("before-restore");
    this.transaction((draft) => {
      for (const key of Object.keys(draft)) delete (draft as any)[key];
      Object.assign(draft, validated);
    });
  }
  snapshot(reason: "daily" | "before-restore", destination?: string): string {
    this.initialize();
    fs.mkdirSync(this.backupDirectory, { recursive: true, mode: 0o700 });
    const target =
      destination ||
      path.join(
        this.backupDirectory,
        `${reason}-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.sqlite`,
      );
    try {
      fs.closeSync(fs.openSync(target, "wx", 0o600));
      this.db!.prepare("VACUUM INTO ?").run(target);
      const verification = new Database(target, {
        readonly: true,
        fileMustExist: true,
      });
      try {
        this.checkDatabase(verification);
      } finally {
        verification.close();
      }
    } catch (error) {
      if (fs.existsSync(target)) fs.unlinkSync(target);
      throw error;
    }
    const keep = reason === "daily" ? 7 : 3;
    const old = fs
      .readdirSync(this.backupDirectory)
      .filter((n) => n.startsWith(reason + "-") && n.endsWith(".sqlite"))
      .sort()
      .reverse()
      .slice(keep);
    for (const name of old)
      try {
        fs.unlinkSync(path.join(this.backupDirectory, name));
      } catch {
        /* Retention cleanup never invalidates a completed snapshot. */
      }
    return target;
  }
  close(): void {
    this.db?.close();
    this.db = null;
    this.data = null;
  }
}
