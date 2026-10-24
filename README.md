# Rechly Desktop (100% Offline & On-Device)

**Rechly Desktop** is the standalone, fully offline, privacy-first desktop edition of Rechly for macOS, Windows, and Linux.

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

## 🚀 Running the App Locally

```bash
cd desktop
npm install
npm start
```

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

Installers will be generated in the `desktop/dist/` directory.
