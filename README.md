# Rechly Desktop

Thin Electron shell around [rechly.de](https://rechly.de) for macOS and Windows.

## Architecture

The desktop app loads the hosted web app — it ships no app code of its own, so
it is always up to date and maintenance stays minimal. Native value comes from
the shell:

- German application menu with **Drucken** (Cmd/Ctrl+P) and **Als PDF
  speichern** (Cmd/Ctrl+Shift+S)
- Auto-updates via GitHub Releases (electron-updater)
- Window-state persistence, single-instance lock
- Hardened webview: context isolation, sandbox, navigation restricted to
  rechly.de + OAuth providers; all other links open in the default browser
- Offline fallback page with retry

The web app can detect the shell via `window.rechlyDesktop`.

## Development

```bash
cd desktop
npm install
npm start                     # loads https://rechly.de
RECHLY_URL=http://localhost:3000 npm start   # against a local web build
```

## Building

```bash
npm run pack       # unpacked build into dist/ (smoke test)
npm run dist:mac   # dmg + zip (arm64 + x64)
npm run dist:win   # NSIS installer (x64)
```

## Release checklist

1. **Code signing** — required for auto-updates and to avoid OS warnings:
   - macOS: Developer ID certificate + notarization
     (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`)
   - Windows: code-signing certificate (`CSC_LINK`, `CSC_KEY_PASSWORD`)
2. Create the `myaxyo/rechly_desktop` GitHub repository (publish target in
   `electron-builder.yml`).
3. Bump `version` in `package.json`.
4. `GH_TOKEN=<token> npm run dist -- --publish always`
5. Installed apps pick the release up automatically on next launch.
