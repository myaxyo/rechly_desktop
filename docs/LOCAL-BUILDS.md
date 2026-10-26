# Build Rechly 1.2.1 on your MacBook

These instructions build the source in your checkout. Downloading the existing GitHub release does not install changes from this checkout. The installed version is visible in the sidebar footer and **Hilfe → Über Rechly Desktop**. Updates are installed manually.

## Start and check the app

Install Node.js 22 LTS and Xcode Command Line Tools (`xcode-select --install`). In the project folder:

```bash
npm ci
npm run typecheck
npm run build
npm test
npm start
```

The `npm ci` postinstall rebuilds the native SQLite addon for Electron. If a prebuilt binary is unavailable, compilation needs the platform C++ build tools. Run tests with `npm test`, which uses Electron's Node runtime so the addon ABI matches.

The app is for one local user. Back up your existing vault from Rechly before trying a new build with real business data. For a separate demo profile, run `npx electron . --user-data-dir=/tmp/rechly-demo-121` after building.

## Build a Mac installer

For an M1/M2/M3/M4 or newer Apple Silicon Mac:

```bash
npm run dist:mac -- --arm64 --publish never
node scripts/verify-macos.cjs
```

For Intel, replace `--arm64` with `--x64`. To build both architectures, omit that flag. Output is in `dist/`, including `Rechly-Desktop-mac-arm64.dmg` or `Rechly-Desktop-mac-x64.dmg` and ZIP archives. Choose the architecture matching the Mac that will run the app.

The custom signer preserves Electron's per-file entitlements, signs nested code, and checks bundle integrity. Without an available certificate, it uses an **ad-hoc signature for local builds**. This does **not** identify a trusted publisher and does **not** notarize the app. A successful integrity check alone is not proof that Gatekeeper will accept a downloaded copy.

### Distribute to other Mac users

Install your **Developer ID Application** certificate with its private key in Keychain. Configure notarization credentials using `xcrun notarytool store-credentials` and an Apple app-specific password, then use the saved profile name:

```bash
export APPLE_KEYCHAIN_PROFILE=rechly-notary
export RECHLY_REQUIRE_NOTARIZATION=1
npm run dist:mac -- --publish never -c.mac.identity="Your Name (TEAMID)"
node scripts/verify-macos.cjs --distribution
```

`electron-builder.yml` sets `mac.identity: "-"` (ad-hoc), so a distribution build must override it with your Developer ID Application certificate name, without the `Developer ID Application:` prefix. If you forget the override while notarization is required, the signing hook stops the build instead of producing an ad-hoc app. `rechly-notary` must be the profile you actually created. Credentials stay in Keychain; do not commit certificates or passwords. Electron Builder submits and staples the app when notarization is configured. The distribution check additionally requires a valid stapled ticket and a passing Gatekeeper assessment. Build failure must be resolved before distributing.

Mount the generated DMG, copy the app to Applications, and verify that installed copy too:

```bash
node scripts/verify-macos.cjs '/Applications/Rechly Desktop.app' --distribution
```

Launch the installed copy on the target architecture and test a downloaded DMG on a separate Mac before publishing. The current Linux development environment cannot run Apple's signing tools; the new signing hook has automated configuration tests, but native signing and Gatekeeper behavior must be verified on a Mac.

### If macOS says “damaged”

The previous 1.1.0 Intel archive had no bundle signature manifests. That finding does not establish that every launch failure has the same cause. Rebuild from this checkout and run the verification script against the app you are actually opening. If integrity fails, rebuild or download a fresh verified artifact. If integrity passes but distribution verification fails, complete Developer ID signing and notarization. Do not edit files inside a signed `.app` after packaging. Removing quarantine or disabling Gatekeeper is not part of this build process.

## Build a Windows EXE

```bash
npm run dist:win -- --x64 --publish never
```

The NSIS installer is `dist/Rechly-Desktop-Setup-win-x64.exe`. The SQLite addon (`better-sqlite3` 13, N-API) ships prebuilt Windows and Mac binaries, and packaging uses them without recompiling (`npmRebuild: false`), so the EXE can also be cross-built on a Mac. An EXE cannot be launch-tested on macOS, so native Windows builds remain the recommended route for verification. If cross-packaging fails, use the existing **Desktop validation and installers** GitHub Actions workflow or a Windows machine. The native Windows job builds and exercises the actual Windows application. Windows signing requires a separately configured certificate; an unsigned installer may trigger SmartScreen.

`npm run dist` packages for the host OS; it does not automatically build every platform. All commands above use `--publish never` to avoid uploads. The existing workflow still publishes a new package version after a push to `main` and successful native checks; a manual run on another branch produces artifacts without a release.

## Run the desktop workflow tests

On a graphical desktop:

```bash
npm install --prefix .ci-tools --no-save --package-lock=false playwright-core@1.57.0
export RECHLY_PLAYWRIGHT_PATH="$PWD/.ci-tools/node_modules/playwright-core"
node scripts/run-desktop-tests.cjs tests/business.electron.cjs tests/calendar.electron.cjs tests/core.electron.cjs tests/worklog.electron.cjs tests/storage.electron.cjs
```

Tests use temporary profiles and sample data. After packaging on your target OS, set `RECHLY_EXECUTABLE` to the packaged executable (the `Contents/MacOS/Rechly Desktop` binary inside the Mac app) and run the suites again. CI includes packaged calendar, time-billing and storage/recovery tests.
