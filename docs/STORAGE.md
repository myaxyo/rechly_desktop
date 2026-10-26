# Storage, backups and recovery

## What changed

Rechly 1.2 replaces the active whole-file JSON vault with SQLite (`rechly.sqlite`). Separate tables hold invoices, customers, products, offers, expenses, projects, tasks, documents, calendar events and time entries. Each row retains a JSON payload so historical optional fields remain compatible. Settings are stored separately. The UI currently loads a snapshot into memory; this is not yet a server-scale query/reporting architecture.

SQLite uses WAL journaling and `synchronous=FULL`. Multi-record changes, including time-to-invoice creation, commit atomically. Only changed rows are written. Validation and failed SQL commits leave both the active snapshot and stored data unchanged. A single-instance lock prevents two app processes from editing the same profile. On opening the database, Rechly checks its schema version, SQLite integrity and stored data shapes. Duplicate IDs, invalid types, dangerous object keys and broken customer/project/time links are rejected.

SQLite is a reliability improvement, **not database encryption**, an immutable audit trail or a GoBD certification. Someone with access to the unlocked OS account can read business data. Use FileVault on Mac or BitLocker/device encryption on Windows, a strong login password and a separate backup location. SQLite's `-wal` and `-shm` files are managed by SQLite; do not delete them or copy only the main database while the app is running.

## Existing JSON data

At first launch without a SQLite database, Rechly validates `rechly_vault.json`, builds a temporary database, checks the resulting records and then promotes it to the active database. It preserves record IDs and ordering. A failed migration leaves the JSON untouched and shows the recovery screen. It does not overwrite an unreadable vault with sample data.

The original `rechly_vault.json` and any `rechly_vault.backup.json` remain in the profile directory. They are no longer the active store, but they still contain plaintext business data and may contain old plaintext API keys. Settings calls attention to these retained files. After checking the migrated records and successfully exporting and testing a new encrypted backup, remove obsolete plaintext copies using your OS file manager according to your retention requirements. Rechly does not silently delete the only legacy copy.

Old versions continue to read the old JSON; they cannot read the SQLite database or the new encrypted backup format. Do not switch back to an older app and expect new data to appear there.

## API keys

New persisted OpenAI/Anthropic keys are encrypted through Electron `safeStorage` (Windows DPAPI or macOS Keychain; a supported secret service on Linux). The plaintext key is available in the running app for authorized API requests. If secure storage is unavailable or Linux falls back to `basic_text`, saving a nonempty key fails instead of writing plaintext. Unlock or configure the OS credential service and retry; local Ollama does not need these keys.

Portable backups omit API keys. Re-enter them on the destination computer. Local SQLite snapshots retain OS-protected key ciphertext and are intended for recovery on the same OS account. They may not open on another computer/account with different credential storage. Prefer portable encrypted backups for transfers.

## Create and verify a portable backup

1. Open **Einstellungen & KI → Lokale Daten & Sicherungen**.
2. Choose **Tresor-Backup exportieren** and enter a password of at least 12 characters twice. A long unique passphrase is recommended.
3. Save the `.rechly-backup` file to a separate drive or another location you control. Rechly does not upload it.
4. Use a separate demo profile to test restoring it before depending on it as your only backup. Store the password in your password manager.

Format version 1 uses a binary header, random 16-byte salt, random 12-byte nonce, AES-256-GCM with a 16-byte authentication tag, and scrypt (`N=131072`, `r=8`, `p=1`, 32-byte key). Each export has a new salt and nonce. The format header is authenticated. KDF parameters are fixed rather than accepted from the file. The exported snapshot excludes API keys. No plaintext export is exposed in the UI. Exports use a temporary file, fsync and rename, with owner-only permissions where supported. Imports and exports are limited to 64 MiB.

Rechly cannot recover a forgotten password. Password protection helps if a backup is copied or stolen; it does not protect against malware running as you on an unlocked computer.

## Restore

Choose a backup, enter its password when requested, and click **Sicherung prüfen**. Rechly validates and previews the company and record counts. Nothing changes until you click **Daten ersetzen und wiederherstellen**. Restore replaces the entire dataset, including settings and a saved running timer; review elapsed timer duration afterwards. It does not merge databases. Legacy JSON and local `.sqlite` recovery snapshots are also accepted.

A wrong password, modified encrypted payload or malformed data leaves the current database unchanged. A successful restore first creates a local snapshot of the current database, then commits the replacement transaction. If the protective snapshot cannot be created, restore stops.

Local snapshots live in the profile's `recovery/` directory: up to seven daily snapshots (created when the app starts with existing data on a new UTC date) and three pre-restore snapshots. They are unencrypted business-data copies on the same disk and cannot protect against loss of that disk. Snapshot creation failures appear in Settings. Use the file picker to select a `.sqlite` snapshot for rollback.

## Damaged database or locked credential service

Rechly shows a recovery screen with the error and active path. If the problem is disk space, permissions or a locked keychain, fix that and restart first. It does not substitute sample data.

If you restore a valid backup from the recovery screen, Rechly creates `rechly-recovered-<id>.sqlite` and atomically updates the small `storage-location.json` pointer created when the database was initialized. The original database and any journal sidecars remain untouched for repair. The pointer contains only the local database filename, no business records or keys. Restart the app after successful recovery. Retained damaged files are not automatically deleted.

A newer database schema is rejected rather than downgraded. A missing database selected by the recovery pointer is also treated as an error. For manual repair or forensic work, preserve the entire profile directory before changing files.

## Build and testing notes

`better-sqlite3` 13 is an N-API addon with prebuilt binaries for Windows and macOS (x64 and arm64); the `postinstall` script still prepares it for Electron. Run `npm ci` after pulling dependency changes and run `npm test` rather than loading the native addon under a different Node ABI. Native Windows and both Mac builds run the same storage tests and packaged migration/backup/recovery workflows.
