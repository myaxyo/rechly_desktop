import { randomUUID } from "node:crypto";
import {
  decryptBackup,
  isEncryptedBackup,
  readBackupFile,
} from "./backupCrypto";
import { validateStore, collectionNames, rowsOf } from "./storageValidation";
import type { StoreData } from "./types";

/** One selected immutable file at a time; previews expire and reveal no credentials. */
export class BackupSelection {
  private selected: {
    token: string;
    bytes: Buffer;
    expires: number;
    data?: StoreData;
  } | null = null;
  select(file: string, readSnapshot?: (file: string) => StoreData) {
    const bytes = readBackupFile(file),
      token = randomUUID();
    const sqlite =
      bytes.subarray(0, 16).toString("binary") === "SQLite format 3\x00";
    if (sqlite && !readSnapshot)
      throw new Error(
        "Diese lokale Datenbanksicherung wird nicht unterstützt.",
      );
    this.selected = {
      token,
      bytes,
      expires: Date.now() + 15 * 60 * 1000,
      ...(sqlite ? { data: readSnapshot!(file) } : {}),
    };
    return { token, encrypted: isEncryptedBackup(bytes) };
  }
  private require(token: unknown) {
    if (
      !this.selected ||
      this.selected.token !== token ||
      Date.now() > this.selected.expires
    )
      throw new Error(
        "Die Dateiauswahl ist abgelaufen. Bitte wählen Sie die Sicherung erneut.",
      );
    return this.selected;
  }
  async preview(token: unknown, password: string) {
    const selected = this.require(token);
    const plain = selected.data
      ? null
      : isEncryptedBackup(selected.bytes)
        ? await decryptBackup(selected.bytes, password)
        : selected.bytes;
    const data =
      selected.data || validateStore(JSON.parse(plain!.toString("utf8")));
    if (this.require(token) !== selected)
      throw new Error("Die Auswahl hat sich geändert.");
    selected.data = data;
    return {
      company: data.company.name || "Ohne Firmenname",
      counts: Object.fromEntries(
        collectionNames.map((name) => [name, rowsOf(data, name).length]),
      ),
      containsApiKeys: Boolean(
        data.aiSettings.openai_key || data.aiSettings.anthropic_key,
      ),
    };
  }
  take(token: unknown): StoreData {
    const selected = this.require(token);
    if (!selected.data) throw new Error("Bitte die Sicherung zuerst prüfen.");
    return structuredClone(selected.data);
  }
  clear() {
    this.selected = null;
  }
}
