# Rechly Desktop 1.2.0 — Arbeit & Ertrag

This source version adds a connected workflow for small service businesses:

- **Zeiten & Abrechnung:** persistent timer, manual entries, billable/internal work, billing and cost rates, project/status/search filters and CSV export.
- **Time-to-invoice:** selected project work becomes a customer invoice draft. Billed entries are locked against editing and duplicate billing. Deleting the linked draft releases them again; linked non-draft invoices cannot be deleted through this operation.
- **Projektcontrolling:** recorded work value, estimated labor costs, project expenses, unbilled work, invoice totals and amounts marked paid, with project details and planned-budget comparison.
- **Expense integration:** assign expenses to projects, retain descriptions and correctly preserve 0% VAT when editing.
- **Discoverability:** workflow entry points on the start page, a global running-timer indicator and visible installed version.
- **Single-user reliability:** reopening the same profile focuses the existing app, preventing two processes from writing different vault snapshots.
- **Build integrity:** macOS custom signing hook, explicit signature checks and instructions for local builds versus Developer ID/notarized distribution.

Storage has also been upgraded:

- **SQLite:** changed records commit in transactions with WAL and full synchronous writes; database integrity is checked on startup.
- **Migration:** existing JSON files are validated and migrated automatically. Original files remain untouched for recovery.
- **Encrypted portable backups:** password-based AES-256-GCM encryption, validated restore previews and protection against wrong passwords or tampered files.
- **Recovery:** local daily snapshots and pre-restore copies; a dedicated recovery screen preserves damaged databases and creates a separate replacement.
- **Credentials:** API keys use the OS secure store and are excluded from portable backups. Business database files, local recovery snapshots and legacy JSON files remain unencrypted; use device disk encryption.

All new records stay in the local database and are included in portable backups. There are no new accounts or online services. Older vaults start with no time entries and no running timer. Take a vault backup before upgrading.

The timer includes elapsed time while the app is closed; review the duration before saving. Project contributions are estimates, not tax profit. Payment amounts follow manually maintained invoice statuses. The generated invoice is a draft for review, with 19% VAT by default or 0% under the existing small-business setting.

Local validation covers compilation, domain/store/signing-configuration tests and five Electron workflow suites. Native Mac signature verification and Gatekeeper acceptance require a Mac. Ad-hoc signatures are for local integrity; they do not provide Apple notarization. Windows signing remains separately configured.

See [local build instructions](LOCAL-BUILDS.md) and the [product roadmap](PRODUCT-DIRECTION.md). Native CI builds and tests installers before publication. See the build results for the platform-specific validation status.
