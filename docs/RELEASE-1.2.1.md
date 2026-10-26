# Rechly Desktop 1.2.1 — Wartung & Laufzeit-Aktualisierung

This maintenance release upgrades core runtime dependencies, resolves reported upstream security advisories, and optimizes packaged desktop distributions:

- **Laufzeit & Framework-Upgrades:** Electron 45, electron-builder 26, and better-sqlite3 13 (N-API). Resolves all upstream security advisories reported against earlier Electron runtimes (0 vulnerabilities in audit).
- **Optimierte Paketierung:** Excludes unused better-sqlite3 platform prebuilds (Linux and non-target architectures) and C++ source dependencies from packaged distributions, reducing application bundle size by ~26 MB per platform.
- **macOS Ad-hoc Signatur-Kompatibilität:** Updated custom signer configuration for electron-builder 26 to reliably maintain bundle signature integrity across local and CI builds.
- **Plattform-Verifikation:** Verified build and packaging across macOS Apple Silicon (arm64), macOS Intel (x64), and Windows (x64).

See [local build instructions](LOCAL-BUILDS.md) and the [product roadmap](PRODUCT-DIRECTION.md). Native CI builds and verifies installers before publication.
