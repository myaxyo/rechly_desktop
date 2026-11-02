# Rechly Desktop 1.3.0 — Multi-Tier Local AI Family (3B / 1.5B / 0.5B)

This release expands the Rechly on-device AI model family into 3 specialized production tiers, introducing automated hardware detection and seamless hot-switching for local invoice processing:

- **Multi-Tier Local AI Family:**
  - **Rechly-DE-3B (Flagship):** Maximum precision (100% benchmark score) for complex German tax (§ 14 UStG), GoBD verification, DATEV SKR03/SKR04 account assignment, and XRechnung/ZUGFeRD edge cases (1.93 GB download, ~2.5 GB RAM, recommended for Apple Silicon M1–M4 and systems with ≥ 8 GB RAM).
  - **Rechly-DE-1.5B (Slim):** Balanced & fast for standard invoices, required VAT disclosures, and everyday billing (986 MB download, ~1.1 GB RAM, recommended for laptops and systems with 4–8 GB RAM).
  - **Rechly-DE-0.5B (Nano):** Ultra-light & memory-efficient for low-resource environments, thin clients, and quick entry (< 4 GB RAM, 398 MB download, ~512 MB RAM).

- **Hardware Auto-Detection Engine:**
  - Automatically inspects CPU architecture, Apple Silicon unified memory, and physical RAM on macOS, Windows, and Linux.
  - Recommends the optimal model tier for the user's specific hardware with clear technical rationale.

- **Enhanced Setup Assistant & Settings UI:**
  - **Onboarding Wizard:** Dedicated hardware detection banner with 3-tier card selection, spec breakdown, instant activation for existing models, and streaming downloads with real-time percentage progress and byte counts.
  - **Settings & AI Configuration:** Side-by-side comparison cards with live status indicators (`Aktiv 🟢`, `Installiert (Bereit) ⚪`, `Nicht geladen 📥`), 1-click model hot-switching without restart, and model deletion to free disk space.
  - **Dynamic Titlebar Indicator:** Immediate status pill reflecting active local model tier (`🟢 Rechly-DE-3B (Lokal)`, `🟢 Rechly-DE-1.5B (Slim)`, `🟢 Rechly-DE-0.5B (Nano)`) with direct focus navigation to AI settings on click.

- **Platform Verification & Local Builds:**
  - Verified across macOS Apple Silicon (arm64), macOS Intel (x64), and Windows (x64).
  - All unit tests and automated regression suites pass.

See [local build instructions](LOCAL-BUILDS.md) and the [product roadmap](PRODUCT-DIRECTION.md). Native CI builds and verifies installers before publication.
