# Rechly Desktop (100% Offline & On-Device)

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/myaxyo/rechly_desktop)](https://github.com/myaxyo/rechly_desktop/releases/latest)

**Rechly Desktop** is the standalone, fully offline, privacy-first desktop edition of [Rechly](https://rechly.de) for macOS and Windows. It is free and open source under the AGPL-3.0.

---

## ⬇️ Download

| Platform | Download |
| --- | --- |
| Windows 10/11 (64-bit) | [Rechly-Desktop-Setup-win-x64.exe](https://github.com/myaxyo/rechly_desktop/releases/latest/download/Rechly-Desktop-Setup-win-x64.exe) |
| macOS Apple Silicon (M1 and newer) | [Rechly-Desktop-mac-arm64.dmg](https://github.com/myaxyo/rechly_desktop/releases/latest/download/Rechly-Desktop-mac-arm64.dmg) |
| macOS Intel | [Rechly-Desktop-mac-x64.dmg](https://github.com/myaxyo/rechly_desktop/releases/latest/download/Rechly-Desktop-mac-x64.dmg) |

All versions: [Releases](https://github.com/myaxyo/rechly_desktop/releases).

> **Windows:** The installer is not code-signed yet. If SmartScreen shows "Windows protected your PC", click **More info → Run anyway**.
>
> **macOS:** If macOS says the app can't be verified, right-click the app in *Applications*, choose **Open**, and confirm.

---

## 🌟 Key Desktop Features

* **100% Offline & On-Device (GoBD & DSGVO compliant):**
  - All invoices, clients, products, offers, expenses, and company profiles are stored locally in a secure, single-file vault (`rechly_vault.json`).
  - No internet connection, cloud login, or remote Appwrite server required.
* **Featured AI Model: [`jonprompter/Rechly-DE-3B`](https://ollama.com/jonprompter/Rechly-DE-3B):**
  - Pre-configured to connect to local Ollama on `http://localhost:11434`.
  - Natural Language **"Text-zu-Rechnung"** (type e.g. *"Rechnung an Müller GmbH: 10 Std. Beratung à 120€, zahlbar in 14 Tagen mit 2% Skonto"* and the AI populates the invoice draft in 1 click).
  - Also available on [Hugging Face](https://huggingface.co/jonprompter/rechly-de-3b).
  - Terminal 1-liner to run:
    ```bash
    ollama run jonprompter/Rechly-DE-3B
    ```
* **Official E-Rechnung 2025/2028:**
  - One-click export of EN 16931 / XRechnung 3.0 CII XML and ZUGFeRD 2.3 XML.
  - Native file save dialog directly to your preferred folder.
* **DATEV Buchungsstapel Export:**
  - Generates standard DATEV EXTF format 700 CSV files for German tax consultants (*Steuerberater*).
* **Native Desktop Experience:**
  - macOS frameless window with native traffic-light controls.
  - Collapsible Linear/Notion-style desktop sidebar.
  - Keyboard shortcuts (`⌘N` for New Invoice, `⌘F` for Search, `⌘P` for Print/PDF).
  - 1-Click Vault Backup & Restore.

---

## Business Workspace

The app now opens in a German-language business cockpit alongside the existing invoice workflows:

- **Documents:** create business letters, meeting minutes and notes from editable templates, link them to projects, search their contents and export A4 PDF or UTF-8 text files.
- **Projects:** connect work to customers, set target dates and planned budgets, and track completion from linked tasks.
- **Tasks:** organize work across Offen, In Arbeit and Erledigt; record responsible people, priorities and deadlines.
- **Overview:** see active projects, open and overdue tasks, upcoming work and document counts.

Choose **Speichern** to persist edits. Closing an editor with unsaved changes asks before discarding them. Tasks and documents must be unlinked before their project can be deleted. These records use the existing local JSON vault and are included in vault backups. Older vaults start with empty workspace collections.

This workspace is designed for a single local user. Responsible-person fields are labels, not user accounts or notifications. Documents currently contain plain text; DOCX/XLSX editing, spreadsheets, real-time collaboration and role-based access are not implemented. Project budgets are planning figures, not recognized revenue or accounting entries.

## Persönlicher Offline-Kalender

- Monats-, Wochen-, Tages- und Agendaansicht mit deutscher Wochenstruktur (Montag zuerst).
- Termine mit Ort, Notizen, Kategorien, ganztägigen Zeiträumen und Suchfunktion.
- Tägliche, wöchentliche, monatliche oder jährliche Serien mit Intervall und optionalem Enddatum. Einzelne Vorkommen oder ganze Serien lassen sich löschen; Bearbeitungen betreffen die gesamte Serie.
- Aufgaben und offene Rechnungsfristen können eingeblendet werden; die verknüpften Einträge öffnen ihren ursprünglichen Arbeitsbereich.
- Lokale Systemerinnerungen, solange Rechly läuft. Das Betriebssystem muss Benachrichtigungen erlauben. Nach längerer Schließzeit werden verpasste Erinnerungen nicht nachträglich gesammelt angezeigt.
- ICS-Import mit Vorschau der Anzahl und Bestätigung, Duplikaterkennung anhand der UID und ICS-Export. Unterstützt werden lokale Zeiten, einzelne UTC-Termine und einfache Wiederholungen. TZID-Zeitzonen, COUNT/BYDAY-Regeln, einzelne Serienänderungen und zusätzliche Serientermine werden mit einer Fehlermeldung abgelehnt, damit keine Terminsemantik verloren geht.

Termine verwenden die Gerätezeitzone. Es gibt keine Konten, Teilnehmer-Einladungen, Freigaben oder Synchronisierung. Bei ganztägigen Terminen ist das Enddatum im Editor einschließlich; intern und im ICS-Export ist das Ende wie im Kalenderstandard ausschließlich. Ein Termin kann bis zu 31 Tage dauern. Alle Kalenderdaten sind Bestandteil der lokalen Tresor-Sicherung.

## Desktop builds

GitHub Actions builds Windows x64, macOS Intel and macOS Apple Silicon on native runners. Each job runs type checking, unit tests, desktop workflow tests, builds its installer and launches the packaged app for a calendar smoke test. Successful installers are retained as build artifacts for release publication. These builds are unsigned / not Apple-notarized unless signing is separately configured; OS warnings are expected, as with the existing 1.0.0 release.

## 🚀 Running the App Locally

Requires [Node.js](https://nodejs.org) 20 or newer.

```bash
git clone https://github.com/myaxyo/rechly_desktop.git
cd rechly_desktop
npm install
npm start
```
The main process is written in TypeScript (`src/`) and compiled to `out/` by `npm run build`; `npm start` and the `dist` scripts build automatically. Use `npm run typecheck` for a type check without emitting files.

---

## 📦 Building Installers (.dmg / .exe)

To produce production installers for your operating system:

```bash
# Package for macOS (.dmg and .zip for Apple Silicon & Intel)
npm run dist:mac

# Package for Windows (.exe installer)
npm run dist:win

# Package for all platforms
npm run dist
```

Installers will be generated in the `dist/` directory.

---

## 🤝 Contributing

Bug reports, feature ideas and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 📄 License

Copyright © 2026 Rechly

Rechly Desktop is free software: you can redistribute it and/or modify it under the terms of the [GNU Affero General Public License v3.0](LICENSE) as published by the Free Software Foundation (version 3 only).

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the [LICENSE](LICENSE) for details.
