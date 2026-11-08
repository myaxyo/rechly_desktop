# Web parity: optional invoice payments

This change ports Rechly Web's payment QR workflow to the standalone desktop
app without requiring an account, network access or a bank API.

In **Einstellungen → Zahlungs-QR-Code**, enable **GiroCode auf unbezahlten
Rechnungen anzeigen** and save. The setting is off by default. With a valid
IBAN, company/account-holder name, optional BIC and positive amount, invoice
preview and PDF contain an EPC transfer QR code. It works with Classic, Modern
and Minimal templates. Offers, paid invoices, zero totals and negative totals
do not get a payment QR code. Invalid payment details produce a preview notice.
The customer still reviews and authorizes the transfer in their banking app;
Rechly does not initiate payments or track their completion.

QR images are generated in the main process from persisted invoice data with
the locally bundled `qrcode` dependency. The payload builder matches the web
format and validates checksum, field lengths, control characters, BIC format,
amount bounds and the EPC byte limit. The optional preference is included in
encrypted vault backups. No existing invoice data is migrated or rewritten.

Invoice exports also now preserve discounts in XML net prices and preview line
amounts, preserve fractional quantities, respect explicit 0% VAT and emit
separate CII header tax groups for mixed rates. Small-business XML explains its
exemption; previews show each position's tax rate instead of labelling all VAT
as 19%. Full desktop KoSIT validation and PDF/A-3 hybrid export remain separate
work; ordinary PDF output has not become a certified electronic invoice.

Rechly Web receives projects, tasks and document editing/export based on this
repository's business workspace, behind an optional deployment flag. There is
no automatic web/desktop synchronization. Web still lacks desktop's time billing,
project cost reports and calendar; desktop still lacks equivalent web recurring
invoice, dunning and bank-matching workflows. See the web repository's
`docs/FEATURE_PARITY.md` for the full comparison and rollout instructions.

## Tests

`npm test` builds TypeScript and runs the Electron-hosted domain/storage suite.
`tests/girocode.test.cjs` covers payload validity and opt-in/paid suppression;
`tests/eRechnung.test.cjs` covers discounted and mixed-tax XML.

After building, run `node tests/parity.electron.cjs` with Playwright Core
available (or set `RECHLY_PLAYWRIGHT_PATH`). For a headless Linux environment use
`RECHLY_HEADLESS=1`. It creates a disposable vault, exercises native IPC and all
three invoice previews, checks escaped text and discounts, and saves a real PDF.
This does not replace Windows/macOS installer testing or a real banking-app scan.
