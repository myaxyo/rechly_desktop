/**
 * Rechly Universal Data Migration & Competitor Import Engine (Desktop)
 * 100% compatible with Rechly Web Cloud (`src/lib/migration/importer.ts`,
 * `/api/migration/backup`, `/api/migration/import`, `/api/migration/parse-einvoice`).
 *
 * Supports:
 * - Lexware Office (lexoffice)
 * - sevdesk
 * - FastBill
 * - Papierkram / Billomat / WISO MeinBüro
 * - DATEV (EXTF / ASCII)
 * - XRechnung (.xml) & ZUGFeRD (.pdf) batch import
 * - Generic CSV / Excel exports
 * - Rechly Full Account Backup (.json) (1-click Web ⇄ Desktop portability)
 */

import { randomUUID } from "node:crypto";
import * as zlib from "node:zlib";
import type {
    Client,
    Company,
    Expense,
    Invoice,
    InvoiceItem,
    Offer,
    Product,
    StoreData,
} from "./types";

export type MigrationEntityType =
    | "clients"
    | "products"
    | "invoices"
    | "expenses"
    | "full_backup";

export type MigrationSourceId =
    | "lexoffice"
    | "sevdesk"
    | "fastbill"
    | "papierkram"
    | "datev"
    | "einvoice"
    | "rechly_backup"
    | "generic";

export interface MigrationSourceGuide {
    id: MigrationSourceId;
    name: string;
    subtitle: string;
    badge: string;
    supportedFormats: string[];
    stepsDe: string[];
    stepsEn: string[];
    tipsDe: string;
    tipsEn: string;
}

export const MIGRATION_SOURCES: MigrationSourceGuide[] = [
    {
        id: "lexoffice",
        name: "Lexware Office (lexoffice)",
        subtitle: "Kunden, Artikel, Ausgangsrechnungen & Belege per CSV oder XRechnung",
        badge: "Beliebt",
        supportedFormats: [".csv", ".xml", ".pdf"],
        stepsDe: [
            "Öffne in Lexware Office den Bereich „Kontakte“ → klicke oben rechts auf „Exportieren“ (CSV-Datei).",
            "Exportiere deine Produkte unter „Artikel / Leistungen“ → „Exportieren“.",
            "Für Rechnungen & Belege: Gehe auf „Steuerberater / Export“ → „Datenexport“ (CSV oder E-Rechnungen).",
            "Ziehe alle exportierten Dateien einfach unten in das Upload-Feld.",
        ],
        stepsEn: [
            "In Lexware Office, open 'Contacts' -> click 'Export' (CSV file) in the top right.",
            "Export your products under 'Articles / Services' -> 'Export'.",
            "For invoices & expenses: Go to 'Tax Advisor / Export' -> 'Data Export'.",
            "Drag and drop all exported files into the upload zone below.",
        ],
        tipsDe: "Rechly erkennt Lexware-Spalten wie „Kundennummer“, „Firmenname“, „XRechnung Leitweg-ID“ und „Umsatzsteuer-ID“ vollautomatisch.",
        tipsEn: "Rechly automatically detects Lexware columns like customer number, company name, Leitweg-ID, and VAT ID.",
    },
    {
        id: "sevdesk",
        name: "sevdesk",
        subtitle: "Kontakte, Artikel, Rechnungen & Ausgaben nahtlos übernehmen",
        badge: "1-Klick Erkennung",
        supportedFormats: [".csv", ".xml", ".pdf"],
        stepsDe: [
            "Gehe in sevdesk auf „Kontakte“ → klicke oben rechts auf „Export“ → „CSV-Export“.",
            "Gehe auf „Artikel“ → „Export“ → „CSV-Export“.",
            "Gehe auf „Rechnungen“ bzw. „Belege“ → wähle „CSV-Export“ oder lade deine E-Rechnungen (XML/PDF) herunter.",
            "Lade alle Dateien hier gleichzeitig hoch – Rechly ordnet Kontakte, Artikel und Rechnungen automatisch zu.",
        ],
        stepsEn: [
            "In sevdesk, go to 'Contacts' -> click 'Export' -> 'CSV Export'.",
            "Go to 'Articles' -> 'Export' -> 'CSV Export'.",
            "Go to 'Invoices' or 'Expenses' -> select 'CSV Export' or download your E-Invoices (XML/PDF).",
            "Upload all files simultaneously below.",
        ],
        tipsDe: "Auch sevdesk-spezifische Felder wie „Organisation“, „Familienname“, „Preis (Netto)“ und „Steuersatz“ werden direkt erkannt.",
        tipsEn: "sevdesk-specific headers like 'Organisation', 'Familienname', and net/gross prices are mapped automatically.",
    },
    {
        id: "fastbill",
        name: "FastBill",
        subtitle: "Kundenstamm, Artikel & Rechnungsarchiv importieren",
        badge: "Voll kompatibel",
        supportedFormats: [".csv", ".xml", ".pdf"],
        stepsDe: [
            "Öffne in FastBill „Kunden“ → klicke rechts auf „Export (CSV)“.",
            "Öffne „Artikel“ → „Export (CSV)“.",
            "Öffne „Rechnungen“ bzw. „Ausgaben“ → „Datenexport“.",
            "Lade die CSV-Dateien oder ZUGFeRD-PDFs unten hoch.",
        ],
        stepsEn: [
            "In FastBill, open 'Customers' -> click 'Export (CSV)'.",
            "Open 'Items' -> 'Export (CSV)'.",
            "Open 'Invoices' or 'Expenses' -> 'Data Export'.",
            "Upload the CSV files or ZUGFeRD PDFs below.",
        ],
        tipsDe: "FastBill-Exporte im UTF-8 oder Windows-1252 Format werden automatisch entschlüsselt und korrekt mit Umlauten dargestellt.",
        tipsEn: "Both UTF-8 and Windows-1252 (ANSI) FastBill exports are decoded automatically with German umlauts preserved.",
    },
    {
        id: "papierkram",
        name: "Papierkram / Billomat / WISO",
        subtitle: "CSV-Listen & E-Rechnungen aus jedem deutschen Rechnungsprogramm",
        badge: "Universal",
        supportedFormats: [".csv", ".xml", ".pdf"],
        stepsDe: [
            "Exportiere deine Kunden, Produkte, Rechnungen oder Ausgaben als CSV- oder Excel-CSV-Datei.",
            "Ziehe die Dateien in den Importer.",
            "Prüfe in der Vorschau die automatische Spalten-Zuordnung oder passe einzelne Spalten per Dropdown an.",
        ],
        stepsEn: [
            "Export your clients, products, invoices, or expenses as CSV files.",
            "Drop the files into the importer below.",
            "Verify the automatic column mapping in the preview or customize individual columns via dropdown.",
        ],
        tipsDe: "Du kannst jede beliebige Spaltenüberschrift im Schritt „Spalten-Zuordnung“ mit einem Klick anpassen.",
        tipsEn: "You can customize any column mapping with a single click in the Column Mapping step.",
    },
    {
        id: "einvoice",
        name: "XRechnung & ZUGFeRD Batch-Import",
        subtitle: "Bestehende Rechnungen (.xml / .pdf) inkl. Kunden & Positionen einlesen",
        badge: "EN 16931",
        supportedFormats: [".xml", ".pdf"],
        stepsDe: [
            "Wähle beliebig viele XRechnung-Dateien (.xml) oder ZUGFeRD-/Factur-X-PDFs (.pdf) von deinem Computer aus.",
            "Wähle, ob es sich um eigene Ausgangsrechnungen (legt automatisch Kunden + Rechnungen an) oder Eingangsrechnungen (Ausgaben) handelt.",
            "Starte den Import – alle Rechnungspositionen, Steuersätze, IBANs und Leitweg-IDs werden übernommen.",
        ],
        stepsEn: [
            "Select any number of XRechnung (.xml) or ZUGFeRD/Factur-X (.pdf) files from your computer.",
            "Choose whether they are outgoing invoices (creates clients + invoices) or incoming bills (expenses).",
            "Run the import – all line items, VAT rates, IBANs, and Leitweg-IDs are extracted.",
        ],
        tipsDe: "Ideal, wenn du bisher Rechnungen in einem anderen Tool erstellt hast und deine Kunden + Rechnungsnummern ohne CSV-Gefummel übernehmen willst!",
        tipsEn: "Ideal if you want to migrate existing invoices and customers directly from your invoice PDFs or XMLs!",
    },
    {
        id: "datev",
        name: "DATEV (EXTF / Buchungsstapel)",
        subtitle: "Debitoren, Kreditoren & Buchungsstapel aus DATEV übernehmen",
        badge: "Steuerberater",
        supportedFormats: [".csv"],
        stepsDe: [
            "Exportiere aus DATEV Rechnungswesen oder deinem Vorprogramm den Buchungsstapel oder die Debitorenstammdaten als CSV.",
            "Lade die CSV-Datei unten hoch (auch mit EXTF-Kopfzeile in Zeile 1).",
            "Rechly überspringt automatisch die DATEV-Metadatenzeile und liest die echten Spalten ab Zeile 2.",
        ],
        stepsEn: [
            "Export your booking batch or debtor master data as CSV from DATEV.",
            "Upload the CSV file below (even with an EXTF header row in line 1).",
            "Rechly automatically skips the DATEV metadata header and reads the actual columns.",
        ],
        tipsDe: "Unterstützt deutsche Zahlenformate (1.234,56) und DATEV-Datumsformate (TTMM oder TT.MM.JJJJ).",
        tipsEn: "Supports German number formatting (1.234,56) and DATEV date formats.",
    },
    {
        id: "rechly_backup",
        name: "Rechly Komplett-Backup (Web ⇄ Desktop)",
        subtitle: "Vollständiger Umzug oder Wiederherstellung aus einer Rechly .json Datei",
        badge: "100% Verlustfrei",
        supportedFormats: [".json"],
        stepsDe: [
            "Klicke in deiner bisherigen Rechly-Instanz (Web oder Desktop) auf „Komplett-Backup herunterladen (.json)“.",
            "Ziehe die heruntergeladene `rechly-backup-YYYY-MM-DD.json` Datei unten in das Upload-Feld.",
            "Alle Firmendaten, Kunden, Produkte, Rechnungen (inkl. Positionen), Angebote und Ausgaben werden 1:1 wiederhergestellt.",
        ],
        stepsEn: [
            "In your previous Rechly instance (Web or Desktop), click 'Download Full Backup (.json)'.",
            "Drop the `rechly-backup-YYYY-MM-DD.json` file into the upload zone below.",
            "All company settings, clients, products, invoices (with line items), offers, and expenses are restored 1:1.",
        ],
        tipsDe: "Perfekt für den Wechsel zwischen Rechly Cloud und Rechly Desktop oder als lokale Sicherheitskopie.",
        tipsEn: "Perfect for switching between Rechly Cloud and Rechly Desktop or keeping a local safety backup.",
    },
    {
        id: "generic",
        name: "Eigene CSV / Excel-Tabelle",
        subtitle: "Freier Import mit intelligenter Spalten-Erkennung & Muster-Vorlagen",
        badge: "Flexibel",
        supportedFormats: [".csv"],
        stepsDe: [
            "Speichere deine Excel- oder Numbers-Tabelle als „CSV (Trennzeichen-getrennt)“ (.csv) ab.",
            "Oder lade dir eine unserer fertigen Muster-Vorlagen herunter.",
            "Lade die Datei hoch und prüfe die Spalten-Zuordnung in der Live-Vorschau.",
        ],
        stepsEn: [
            "Save your Excel or Numbers spreadsheet as a CSV file (.csv).",
            "Or download one of our ready-to-use sample CSV templates.",
            "Upload the file and verify the column mapping in the live preview.",
        ],
        tipsDe: "Semikolon (;), Komma (,) und Tabulator werden automatisch als Trennzeichen erkannt.",
        tipsEn: "Semicolon (;), comma (,), and tab delimiters are auto-detected.",
    },
];

// ─── Normalized Target Shapes ──────────────────────────────────────────────

export interface NormalizedMigrationClient {
    name: string;
    client_type: "company" | "person";
    contact_person?: string;
    email?: string;
    phone?: string;
    address_line1: string;
    address_line2?: string;
    postal_code: string;
    city: string;
    country: string;
    vat_id?: string;
    tax_number?: string;
    leitweg_id?: string;
    payment_terms_days?: number;
    notes?: string;
    source_reference?: string;
}

export interface NormalizedMigrationProduct {
    name: string;
    description?: string;
    price: number;
    tax_rate_percent: number;
    unit_of_measure: string;
}

export interface NormalizedMigrationInvoiceItem {
    description: string;
    quantity: number;
    unit_of_measure: string;
    price: number;
    tax_rate_percent: number;
    discount_percent: number;
    subtotal: number;
    tax_amount: number;
    total: number;
}

export interface NormalizedMigrationInvoice {
    invoice_number: string;
    issue_date: string;
    due_date: string;
    delivery_date?: string;
    status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
    client_name: string;
    client_email?: string;
    client_address?: string;
    client_postal_code?: string;
    client_city?: string;
    client_country?: string;
    client_vat_id?: string;
    client_leitweg_id?: string;
    subtotal: number;
    total_vat: number;
    total_gross: number;
    notes?: string;
    payment_terms?: string;
    items: NormalizedMigrationInvoiceItem[];
}

export interface NormalizedMigrationExpense {
    date: string;
    vendor_name: string;
    description: string;
    category:
        | "office"
        | "software"
        | "travel"
        | "hardware"
        | "marketing"
        | "consulting"
        | "telecommunication"
        | "insurance"
        | "other";
    amount_net: number;
    vat_rate_percent: number;
    vat_amount: number;
    amount_gross: number;
    payment_method: "bank_transfer" | "card" | "cash" | "paypal" | "direct_debit";
    invoice_number?: string;
}

export interface RechlyBackupBundle {
    rechlyBackupVersion: number;
    exportedAt: string;
    sourceApp: string;
    company?: Record<string, unknown> | null;
    clients: NormalizedMigrationClient[];
    products: NormalizedMigrationProduct[];
    invoices: NormalizedMigrationInvoice[];
    offers?: Array<{
        offer_number: string;
        issue_date: string;
        valid_until: string;
        status: string;
        client_name: string;
        client_email?: string;
        subtotal: number;
        total_vat: number;
        total_gross: number;
        notes?: string;
        payment_terms?: string;
        items: NormalizedMigrationInvoiceItem[];
    }>;
    expenses: NormalizedMigrationExpense[];
}

export interface MigrationImportResult {
    companyUpdated: boolean;
    clients: { inserted: number; skipped: number };
    products: { inserted: number; skipped: number };
    invoices: { inserted: number; skipped: number };
    offers: { inserted: number; skipped: number };
    expenses: { inserted: number; skipped: number };
    errors: string[];
}

export interface MigrationImportPayload {
    skipDuplicates?: boolean;
    company?: Record<string, unknown> | null;
    clients?: NormalizedMigrationClient[];
    products?: NormalizedMigrationProduct[];
    invoices?: NormalizedMigrationInvoice[];
    offers?: RechlyBackupBundle["offers"];
    expenses?: NormalizedMigrationExpense[];
}

// ─── Field Definitions & Competitor Header Synonyms ─────────────────────────

export interface MigrationFieldDefinition {
    key: string;
    labelDe: string;
    labelEn: string;
    required?: boolean;
    aliases: string[];
}

export const CLIENT_FIELD_DEFINITIONS: MigrationFieldDefinition[] = [
    {
        key: "name",
        labelDe: "Firmenname / Name *",
        labelEn: "Company / Client Name *",
        required: true,
        aliases: [
            "name",
            "firmenname",
            "firma",
            "unternehmen",
            "organisation",
            "organization",
            "company",
            "companyname",
            "kundenname",
            "kunde",
            "rechnungsempfaenger",
            "empfaenger",
            "geschaeftspartner",
            "debitor",
            "anzeigename",
            "displayname",
        ],
    },
    {
        key: "first_name",
        labelDe: "Vorname (falls Privatperson / Kontakt)",
        labelEn: "First Name",
        aliases: [
            "vorname",
            "firstname",
            "givenname",
            "ansprechpartnervorname",
            "kontaktvorname",
        ],
    },
    {
        key: "last_name",
        labelDe: "Nachname (falls Privatperson / Kontakt)",
        labelEn: "Last Name",
        aliases: [
            "nachname",
            "familienname",
            "zunamename",
            "lastname",
            "surname",
            "familyname",
            "ansprechpartnernachname",
            "kontaktnachname",
        ],
    },
    {
        key: "contact_person",
        labelDe: "Ansprechpartner",
        labelEn: "Contact Person",
        aliases: [
            "ansprechpartner",
            "kontaktperson",
            "kontakt",
            "contactperson",
            "contact",
            "zuhaenden",
            "zh",
        ],
    },
    {
        key: "email",
        labelDe: "E-Mail-Adresse",
        labelEn: "Email Address",
        aliases: [
            "email",
            "emailadresse",
            "email1",
            "emailgeschäftlich",
            "mail",
            "epost",
            "rechnungsemail",
        ],
    },
    {
        key: "phone",
        labelDe: "Telefonnummer",
        labelEn: "Phone",
        aliases: [
            "telefon",
            "telefonnummer",
            "telefon1",
            "phone",
            "phonenumber",
            "tel",
            "mobil",
            "mobiltelefon",
            "mobile",
            "handy",
        ],
    },
    {
        key: "address_line1",
        labelDe: "Straße & Hausnummer",
        labelEn: "Street & Number",
        aliases: [
            "strasse",
            "str",
            "straße",
            "strasseundhausnummer",
            "anschrift",
            "adresse",
            "address",
            "addressline1",
            "street",
            "rechnungsadresse",
            "chnungsadresse",
        ],
    },
    {
        key: "house_number",
        labelDe: "Hausnummer (falls eigene Spalte)",
        labelEn: "House Number (if separate)",
        aliases: ["hausnummer", "hausnr", "hnr", "housenumber", "streetnumber"],
    },
    {
        key: "address_line2",
        labelDe: "Adresszusatz",
        labelEn: "Address Line 2",
        aliases: [
            "adresszusatz",
            "zusatz",
            "addressline2",
            "address2",
            "co",
            "abteilung",
        ],
    },
    {
        key: "postal_code",
        labelDe: "PLZ",
        labelEn: "Postal Code",
        aliases: [
            "plz",
            "postleitzahl",
            "zip",
            "zipcode",
            "postalcode",
            "postcode",
            "rechnungsplz",
        ],
    },
    {
        key: "city",
        labelDe: "Ort / Stadt",
        labelEn: "City",
        aliases: [
            "ort",
            "stadt",
            "wohnort",
            "city",
            "town",
            "locality",
            "rechnungsort",
        ],
    },
    {
        key: "country",
        labelDe: "Land",
        labelEn: "Country",
        aliases: [
            "land",
            "country",
            "staat",
            "laendercode",
            "countrycode",
            "iso",
        ],
    },
    {
        key: "vat_id",
        labelDe: "USt-IdNr.",
        labelEn: "VAT ID",
        aliases: [
            "ustidnr",
            "ustid",
            "umsatzsteuerid",
            "umsatzsteueridentifikationsnummer",
            "vat",
            "vatid",
            "vatnumber",
            "uid",
        ],
    },
    {
        key: "tax_number",
        labelDe: "Steuernummer",
        labelEn: "Tax Number",
        aliases: [
            "steuernummer",
            "stnr",
            "taxnumber",
            "taxid",
            "finanzamtsteuernummer",
        ],
    },
    {
        key: "leitweg_id",
        labelDe: "Leitweg-ID (XRechnung)",
        labelEn: "Leitweg-ID (XRechnung)",
        aliases: [
            "leitwegid",
            "xrechnungleitwegid",
            "leitweg",
            "buyerreference",
            "kaeuferreferenz",
            "peppolid",
        ],
    },
    {
        key: "payment_terms_days",
        labelDe: "Zahlungsziel (Tage)",
        labelEn: "Payment Terms (Days)",
        aliases: [
            "zahlungsziel",
            "zahlungszieltage",
            "zahlungsfrist",
            "paymentterms",
            "paymentdays",
            "faelligkeitstage",
        ],
    },
    {
        key: "notes",
        labelDe: "Notizen / Bemerkung",
        labelEn: "Notes",
        aliases: [
            "notizen",
            "notiz",
            "bemerkung",
            "bemerkungen",
            "kommentar",
            "notes",
            "comment",
            "info",
        ],
    },
    {
        key: "source_reference",
        labelDe: "Kundennummer (Altsystem)",
        labelEn: "Customer Number (Legacy)",
        aliases: [
            "kundennummer",
            "kundennr",
            "kdnnr",
            "kdnr",
            "customernumber",
            "customerid",
            "debitorennummer",
            "debitorennr",
            "kontaktnummer",
        ],
    },
];

export const PRODUCT_FIELD_DEFINITIONS: MigrationFieldDefinition[] = [
    {
        key: "name",
        labelDe: "Bezeichnung / Artikelname *",
        labelEn: "Product / Service Name *",
        required: true,
        aliases: [
            "name",
            "bezeichnung",
            "artikelname",
            "artikelbezeichnung",
            "artikel",
            "leistung",
            "produkt",
            "produktname",
            "title",
            "titel",
            "productname",
            "servicename",
        ],
    },
    {
        key: "description",
        labelDe: "Beschreibung",
        labelEn: "Description",
        aliases: [
            "beschreibung",
            "artikelbeschreibung",
            "leistungsbeschreibung",
            "description",
            "details",
            "langtext",
            "text",
            "zusatztext",
        ],
    },
    {
        key: "price",
        labelDe: "Einzelpreis (Netto)",
        labelEn: "Unit Price (Net)",
        required: true,
        aliases: [
            "preis",
            "nettopreis",
            "preisnetto",
            "vknetto",
            "verkaufspreis",
            "verkaufspreisnetto",
            "einzelpreis",
            "standardpreis",
            "stundensatz",
            "price",
            "unitprice",
            "netprice",
            "betrag",
        ],
    },
    {
        key: "gross_price",
        labelDe: "Bruttopreis (falls kein Nettopreis vorhanden)",
        labelEn: "Gross Price (fallback)",
        aliases: [
            "bruttopreis",
            "preisbrutto",
            "vkbrutto",
            "verkaufspreisbrutto",
            "grossprice",
        ],
    },
    {
        key: "tax_rate_percent",
        labelDe: "Steuersatz (%)",
        labelEn: "Tax Rate (%)",
        aliases: [
            "steuersatz",
            "mwst",
            "mwstsatz",
            "ust",
            "umsatzsteuer",
            "umsatzsteuerin",
            "taxrate",
            "vatrate",
            "vat",
            "steuer",
        ],
    },
    {
        key: "unit_of_measure",
        labelDe: "Einheit (Stück, Stunde, etc.)",
        labelEn: "Unit of Measure",
        aliases: [
            "einheit",
            "mengeneinheit",
            "verkaufseinheit",
            "unit",
            "unitofmeasure",
            "uom",
        ],
    },
];

export const INVOICE_FIELD_DEFINITIONS: MigrationFieldDefinition[] = [
    {
        key: "invoice_number",
        labelDe: "Rechnungsnummer *",
        labelEn: "Invoice Number *",
        required: true,
        aliases: [
            "rechnungsnummer",
            "rechnungsnr",
            "renr",
            "belegnummer",
            "belegnr",
            "belegfeld1",
            "invoicenumber",
            "invoiceno",
            "dokumentnummer",
            "nummer",
        ],
    },
    {
        key: "issue_date",
        labelDe: "Rechnungsdatum *",
        labelEn: "Issue Date *",
        required: true,
        aliases: [
            "rechnungsdatum",
            "belegdatum",
            "datum",
            "ausstellungsdatum",
            "issuedate",
            "invoicedate",
            "date",
            "erstellungsdatum",
        ],
    },
    {
        key: "due_date",
        labelDe: "Fälligkeitsdatum",
        labelEn: "Due Date",
        aliases: [
            "faelligkeitsdatum",
            "faelligkeit",
            "faelligam",
            "zahlbarbis",
            "duedate",
            "paymentduedate",
        ],
    },
    {
        key: "delivery_date",
        labelDe: "Leistungsdatum / Lieferdatum",
        labelEn: "Delivery / Service Date",
        aliases: [
            "leistungsdatum",
            "lieferdatum",
            "leistungszeitraum",
            "deliverydate",
            "servicedate",
        ],
    },
    {
        key: "client_name",
        labelDe: "Kunde / Empfänger *",
        labelEn: "Client Name *",
        required: true,
        aliases: [
            "kunde",
            "kundenname",
            "firmenname",
            "firma",
            "empfaenger",
            "rechnungsempfaenger",
            "client",
            "clientname",
            "customer",
            "customername",
            "debitor",
            "kontakt",
        ],
    },
    {
        key: "client_email",
        labelDe: "Kunden E-Mail",
        labelEn: "Client Email",
        aliases: ["kundenemail", "email", "clientemail", "customeremail"],
    },
    {
        key: "subtotal",
        labelDe: "Nettobetrag",
        labelEn: "Net Amount",
        aliases: [
            "netto",
            "nettobetrag",
            "nettosumme",
            "summenetto",
            "gesamtnetto",
            "betragnetto",
            "subtotal",
            "netamount",
            "nettotal",
        ],
    },
    {
        key: "total_vat",
        labelDe: "Steuerbetrag (MwSt.)",
        labelEn: "VAT Amount",
        aliases: [
            "steuerbetrag",
            "mwstbetrag",
            "ustbetrag",
            "umsatzsteuerbetrag",
            "mehrwertsteuer",
            "vatamount",
            "taxamount",
            "totalvat",
        ],
    },
    {
        key: "total_gross",
        labelDe: "Bruttobetrag / Gesamtbetrag",
        labelEn: "Gross Amount / Total",
        aliases: [
            "brutto",
            "bruttobetrag",
            "bruttosumme",
            "gesamtbetrag",
            "gesamtsumme",
            "rechnungsbetrag",
            "endbetrag",
            "umsatz",
            "umsatzohnesollhabenkz",
            "total",
            "totalgross",
            "grossamount",
            "amount",
        ],
    },
    {
        key: "tax_rate_percent",
        labelDe: "Steuersatz (%)",
        labelEn: "Tax Rate (%)",
        aliases: [
            "steuersatz",
            "mwstsatz",
            "mwst",
            "ust",
            "taxrate",
            "vatrate",
        ],
    },
    {
        key: "status",
        labelDe: "Status (Bezahlt, Offen, Entwurf)",
        labelEn: "Status",
        aliases: [
            "status",
            "zahlungsstatus",
            "rechnungsstatus",
            "state",
            "bezahlt",
        ],
    },
    {
        key: "item_description",
        labelDe: "Positionsbeschreibung / Buchungstext",
        labelEn: "Line Item Description",
        aliases: [
            "position",
            "positionsbeschreibung",
            "beschreibung",
            "leistung",
            "buchungstext",
            "verwendungszweck",
            "betreff",
            "itemdescription",
            "description",
        ],
    },
    {
        key: "item_quantity",
        labelDe: "Menge",
        labelEn: "Quantity",
        aliases: ["menge", "anzahl", "quantity", "qty"],
    },
    {
        key: "item_unit",
        labelDe: "Einheit",
        labelEn: "Unit",
        aliases: ["einheit", "mengeneinheit", "unit"],
    },
    {
        key: "item_price",
        labelDe: "Einzelpreis",
        labelEn: "Unit Price",
        aliases: ["einzelpreis", "preis", "unitprice"],
    },
];

export const EXPENSE_FIELD_DEFINITIONS: MigrationFieldDefinition[] = [
    {
        key: "date",
        labelDe: "Belegdatum *",
        labelEn: "Expense Date *",
        required: true,
        aliases: [
            "belegdatum",
            "datum",
            "rechnungsdatum",
            "buchungsdatum",
            "zahldatum",
            "date",
            "expensedate",
        ],
    },
    {
        key: "vendor_name",
        labelDe: "Lieferant / Händler *",
        labelEn: "Vendor / Supplier *",
        required: true,
        aliases: [
            "lieferant",
            "haendler",
            "geschaeftspartner",
            "kreditor",
            "empfaenger",
            "auftraggeber",
            "vendor",
            "supplier",
            "merchant",
            "firma",
            "name",
        ],
    },
    {
        key: "description",
        labelDe: "Beschreibung / Verwendungszweck",
        labelEn: "Description",
        aliases: [
            "beschreibung",
            "verwendungszweck",
            "buchungstext",
            "zweck",
            "notiz",
            "bezeichnung",
            "description",
            "memo",
            "text",
        ],
    },
    {
        key: "category",
        labelDe: "Kategorie / Konto",
        labelEn: "Category",
        aliases: [
            "kategorie",
            "belegkategorie",
            "kostenart",
            "konto",
            "sachkonto",
            "category",
            "account",
        ],
    },
    {
        key: "amount_net",
        labelDe: "Nettobetrag",
        labelEn: "Net Amount",
        aliases: [
            "netto",
            "nettobetrag",
            "betragnetto",
            "amountnet",
            "netamount",
        ],
    },
    {
        key: "vat_rate_percent",
        labelDe: "Vorsteuer-Satz (%)",
        labelEn: "VAT Rate (%)",
        aliases: [
            "steuersatz",
            "vorsteuersatz",
            "mwst",
            "mwstsatz",
            "ust",
            "vatrate",
            "taxrate",
        ],
    },
    {
        key: "vat_amount",
        labelDe: "Steuerbetrag (Vorsteuer)",
        labelEn: "VAT Amount",
        aliases: [
            "steuerbetrag",
            "vorsteuer",
            "mwstbetrag",
            "vatamount",
            "taxamount",
        ],
    },
    {
        key: "amount_gross",
        labelDe: "Bruttobetrag *",
        labelEn: "Gross Amount *",
        required: true,
        aliases: [
            "brutto",
            "bruttobetrag",
            "gesamtbetrag",
            "betrag",
            "zahlbetrag",
            "umsatz",
            "amount",
            "amountgross",
            "grossamount",
            "total",
        ],
    },
    {
        key: "invoice_number",
        labelDe: "Belegnummer / Rechnungs-Nr.",
        labelEn: "Receipt / Invoice Number",
        aliases: [
            "belegnummer",
            "belegnr",
            "rechnungsnummer",
            "fremdbelegnr",
            "referenz",
            "invoicenumber",
            "receiptnumber",
        ],
    },
];

export function getFieldDefinitions(
    entityType: Exclude<MigrationEntityType, "full_backup">,
): MigrationFieldDefinition[] {
    switch (entityType) {
        case "clients":
            return CLIENT_FIELD_DEFINITIONS;
        case "products":
            return PRODUCT_FIELD_DEFINITIONS;
        case "invoices":
            return INVOICE_FIELD_DEFINITIONS;
        case "expenses":
            return EXPENSE_FIELD_DEFINITIONS;
    }
}

// ─── Normalization & Parsing Utilities ───────────────────────────────────────

export function normalizeHeaderToken(header: string): string {
    return (header || "")
        .trim()
        .toLowerCase()
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss")
        .replace(/[^a-z0-9]/g, "");
}

/**
 * Decodes an ArrayBuffer or Uint8Array into a string, automatically falling back
 * to Windows-1252 (ISO-8859-1) if UTF-8 decoding produces replacement characters ().
 */
export function decodeFileBuffer(buffer: ArrayBuffer | Uint8Array): string {
    const bytes =
        buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

    // Strip UTF-8 BOM if present
    if (
        bytes.length >= 3 &&
        bytes[0] === 0xef &&
        bytes[1] === 0xbb &&
        bytes[2] === 0xbf
    ) {
        return new TextDecoder("utf-8").decode(bytes.subarray(3));
    }

    const utf8Text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (utf8Text.includes("\uFFFD")) {
        try {
            return new TextDecoder("windows-1252").decode(bytes);
        } catch {
            return new TextDecoder("iso-8859-1").decode(bytes);
        }
    }
    return utf8Text;
}

/**
 * Parses German ("1.234,56 €", "-45,90", "19 %") and English ("1,234.56") numbers reliably.
 */
export function parseFlexibleNumber(
    raw: string | number | null | undefined,
    fallback = 0,
): number {
    if (typeof raw === "number") {
        return Number.isFinite(raw) ? raw : fallback;
    }
    if (!raw) return fallback;
    const cleaned = String(raw)
        .trim()
        .replace(/[€$£%\s\u00A0]/g, "");
    if (!cleaned) return fallback;

    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");

    let normalized = cleaned;
    if (lastComma > lastDot) {
        // German format: 1.234,56 -> 1234.56
        normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else if (lastDot > lastComma && lastComma !== -1) {
        // US/UK format: 1,234.56 -> 1234.56
        normalized = cleaned.replace(/,/g, "");
    } else if (lastComma !== -1 && lastDot === -1) {
        normalized = cleaned.replace(",", ".");
    }

    const num = Number(normalized);
    return Number.isFinite(num) ? Math.round(num * 100) / 100 : fallback;
}

/**
 * Parses common German & ISO date formats into YYYY-MM-DD:
 * - "24.10.2026" -> "2026-10-24"
 * - "24.10.26"   -> "2026-10-24"
 * - "2026-10-24" -> "2026-10-24"
 * - "20261024"   -> "2026-10-24"
 * - "10/24/2026" -> "2026-10-24"
 */
export function parseFlexibleDate(
    raw: string | null | undefined,
    fallback?: string,
): string {
    const defaultDate = fallback || new Date().toISOString().slice(0, 10);
    if (!raw) return defaultDate;
    const str = String(raw).trim().split(" ")[0].split("T")[0];
    if (!str) return defaultDate;

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str;
    }

    // DD.MM.YYYY or D.M.YYYY or DD.MM.YY
    const deMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (deMatch) {
        const day = deMatch[1].padStart(2, "0");
        const month = deMatch[2].padStart(2, "0");
        let year = deMatch[3];
        if (year.length === 2) {
            year = Number(year) > 70 ? `19${year}` : `20${year}`;
        }
        return `${year}-${month}-${day}`;
    }

    // YYYYMMDD (CII / DATEV)
    const compactMatch = str.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compactMatch) {
        return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
    }

    // DD/MM/YYYY
    const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
        const p1 = Number(slashMatch[1]);
        const p2 = Number(slashMatch[2]);
        const year = slashMatch[3];
        if (p1 > 12) {
            return `${year}-${String(p2).padStart(2, "0")}-${String(p1).padStart(2, "0")}`;
        }
        return `${year}-${String(p1).padStart(2, "0")}-${String(p2).padStart(2, "0")}`;
    }

    const parsed = new Date(str);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
    }

    return defaultDate;
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
    const d = new Date(`${isoDate}T12:00:00Z`);
    if (Number.isNaN(d.getTime())) {
        return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    }
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

export function normalizeCountry(raw: string | undefined): string {
    const val = (raw || "").trim();
    if (!val) return "Deutschland";
    const upper = val.toUpperCase();
    if (upper === "DE" || upper === "DEU" || upper === "GERMANY") {
        return "Deutschland";
    }
    if (upper === "AT" || upper === "AUT" || upper === "AUSTRIA") {
        return "Österreich";
    }
    if (upper === "CH" || upper === "CHE" || upper === "SWITZERLAND") {
        return "Schweiz";
    }
    return val;
}

export function normalizeUnitOfMeasure(raw: string | undefined): string {
    const val = (raw || "").trim();
    if (!val) return "Stück";
    const lower = val.toLowerCase().replace(/\.$/, "");
    const map: Record<string, string> = {
        stk: "Stück",
        stueck: "Stück",
        stück: "Stück",
        pc: "Stück",
        pcs: "Stück",
        piece: "Stück",
        h87: "Stück",
        c62: "Stück",
        std: "Stunde",
        stunde: "Stunde",
        stunden: "Stunde",
        h: "Stunde",
        hr: "Stunde",
        hur: "Stunde",
        tag: "Tag",
        tage: "Tag",
        pt: "Tag",
        personentag: "Tag",
        day: "Tag",
        psch: "Pauschal",
        pauschal: "Pauschal",
        pauschale: "Pauschal",
        ls: "Pauschal",
        monat: "Monat",
        monate: "Monat",
        mon: "Monat",
        kg: "kg",
        kgm: "kg",
        km: "km",
        mtr: "m",
        m: "m",
        l: "Liter",
        ltr: "Liter",
        liter: "Liter",
    };
    return map[lower] || val;
}

export function normalizeTaxRate(raw: string | number | undefined): number {
    if (raw === undefined || raw === null || raw === "") return 19;
    const num = parseFlexibleNumber(raw, 19);
    if (num === 0 || num === 7 || num === 19) return num;
    if (num > 0 && num < 1) {
        return Math.round(num * 100);
    }
    return num;
}

export function normalizeInvoiceStatus(
    raw: string | undefined,
): NormalizedMigrationInvoice["status"] {
    const val = (raw || "").trim().toLowerCase();
    if (!val) return "paid";
    if (
        val.includes("bezahlt") ||
        val.includes("paid") ||
        val.includes("abgeschlossen") ||
        val.includes("gebucht") ||
        val === "1" ||
        val === "ja" ||
        val === "true"
    ) {
        return "paid";
    }
    if (
        val.includes("storn") ||
        val.includes("cancel") ||
        val.includes("gutschrift")
    ) {
        return "cancelled";
    }
    if (
        val.includes("entwurf") ||
        val.includes("draft") ||
        val.includes("proforma")
    ) {
        return "draft";
    }
    if (
        val.includes("ueberfaellig") ||
        val.includes("überfällig") ||
        val.includes("overdue") ||
        val.includes("mahnung")
    ) {
        return "overdue";
    }
    if (
        val.includes("offen") ||
        val.includes("open") ||
        val.includes("sent") ||
        val.includes("versendet") ||
        val.includes("gestellt") ||
        val === "nein" ||
        val === "false"
    ) {
        return "sent";
    }
    return "paid";
}

export function normalizeExpenseCategory(
    rawCategory: string | undefined,
    descriptionFallback = "",
): NormalizedMigrationExpense["category"] {
    const combined = `${rawCategory || ""} ${descriptionFallback}`.toLowerCase();
    if (
        combined.includes("software") ||
        combined.includes("saas") ||
        combined.includes("hosting") ||
        combined.includes("cloud") ||
        combined.includes("lizenz") ||
        combined.includes("domain") ||
        combined.includes("github") ||
        combined.includes("openai") ||
        combined.includes("adobe")
    ) {
        return "software";
    }
    if (
        combined.includes("reise") ||
        combined.includes("fahrt") ||
        combined.includes("bahn") ||
        combined.includes("hotel") ||
        combined.includes("flug") ||
        combined.includes("tank") ||
        combined.includes("taxi") ||
        combined.includes("bewirtung") ||
        combined.includes("travel")
    ) {
        return "travel";
    }
    if (
        combined.includes("hardware") ||
        combined.includes("computer") ||
        combined.includes("laptop") ||
        combined.includes("apple") ||
        combined.includes("monitor") ||
        combined.includes("geraet") ||
        combined.includes("gerät")
    ) {
        return "hardware";
    }
    if (
        combined.includes("marketing") ||
        combined.includes("werbung") ||
        combined.includes("ads") ||
        combined.includes("google ads") ||
        combined.includes("meta") ||
        combined.includes("linkedin")
    ) {
        return "marketing";
    }
    if (
        combined.includes("beratung") ||
        combined.includes("steuerberater") ||
        combined.includes("rechtsanwalt") ||
        combined.includes("notar") ||
        combined.includes("buchhaltung") ||
        combined.includes("consulting") ||
        combined.includes("datev")
    ) {
        return "consulting";
    }
    if (
        combined.includes("telefon") ||
        combined.includes("internet") ||
        combined.includes("mobilfunk") ||
        combined.includes("telekom") ||
        combined.includes("vodafone") ||
        combined.includes("o2")
    ) {
        return "telecommunication";
    }
    if (
        combined.includes("versicherung") ||
        combined.includes("haftpflicht") ||
        combined.includes("insurance")
    ) {
        return "insurance";
    }
    if (
        combined.includes("buero") ||
        combined.includes("büro") ||
        combined.includes("miete") ||
        combined.includes("porto") ||
        combined.includes("papier") ||
        combined.includes("office")
    ) {
        return "office";
    }
    return "other";
}

// ─── Column Auto-Detection & Entity Type Classifier ──────────────────────────

export function detectEntityTypeFromHeaders(
    headers: string[],
): Exclude<MigrationEntityType, "full_backup"> {
    const tokens = headers.map(normalizeHeaderToken);

    const hasAny = (candidates: string[]) =>
        candidates.some((c) => tokens.some((t) => t === c || t.includes(c)));

    if (
        hasAny([
            "artikelnummer",
            "artikelnr",
            "artikelbezeichnung",
            "verkaufspreis",
            "vknetto",
            "einzelpreis",
            "mengeneinheit",
        ]) &&
        !hasAny(["rechnungsnummer", "rechnungsdatum", "belegdatum"])
    ) {
        return "products";
    }

    if (
        hasAny([
            "lieferant",
            "kreditor",
            "vorsteuer",
            "ausgabe",
            "belegkategorie",
            "kostenart",
        ])
    ) {
        return "expenses";
    }

    if (
        hasAny([
            "rechnungsnummer",
            "rechnungsnr",
            "rechnungsdatum",
            "faelligkeitsdatum",
            "belegfeld1",
        ])
    ) {
        return "invoices";
    }

    return "clients";
}

export function detectSourceFromHeaders(headers: string[]): MigrationSourceId {
    const joined = headers.join(" ").toLowerCase();
    if (
        joined.includes("xrechnung leitweg-id") ||
        joined.includes("kundennummer") && joined.includes("ust-idnr")
    ) {
        return "lexoffice";
    }
    if (joined.includes("organisation") && joined.includes("familienname")) {
        return "sevdesk";
    }
    if (joined.includes("belegfeld 1") || joined.includes("soll/haben")) {
        return "datev";
    }
    return "generic";
}

/**
 * Automatically maps target field keys to CSV column headers.
 * Returns Record<targetFieldKey, csvColumnHeader>
 */
export function autoDetectColumnMapping(
    csvHeaders: string[],
    entityType: Exclude<MigrationEntityType, "full_backup">,
): Record<string, string> {
    const definitions = getFieldDefinitions(entityType);
    const mapping: Record<string, string> = {};
    const usedHeaders = new Set<string>();

    const normalizedHeaders = csvHeaders.map((raw) => ({
        raw,
        norm: normalizeHeaderToken(raw),
    }));

    // Pass 1: Exact normalized match
    for (const def of definitions) {
        for (const alias of def.aliases) {
            const normAlias = normalizeHeaderToken(alias);
            const match = normalizedHeaders.find(
                (h) => !usedHeaders.has(h.raw) && h.norm === normAlias,
            );
            if (match) {
                mapping[def.key] = match.raw;
                usedHeaders.add(match.raw);
                break;
            }
        }
    }

    // Pass 2: Substring match for remaining unmapped fields
    for (const def of definitions) {
        if (mapping[def.key]) continue;
        for (const alias of def.aliases) {
            const normAlias = normalizeHeaderToken(alias);
            if (normAlias.length < 4) continue;
            const match = normalizedHeaders.find(
                (h) =>
                    !usedHeaders.has(h.raw) &&
                    (h.norm.includes(normAlias) || normAlias.includes(h.norm)),
            );
            if (match) {
                mapping[def.key] = match.raw;
                usedHeaders.add(match.raw);
                break;
            }
        }
    }

    return mapping;
}

// ─── RFC-4180 CSV Parsing & Row Normalization ────────────────────────────────

export interface ParsedCsvData {
    headers: string[];
    rows: Record<string, string>[];
    detectedEntityType: Exclude<MigrationEntityType, "full_backup">;
    detectedSource: MigrationSourceId;
}

function detectDelimiter(sampleLine: string): string {
    let inQuotes = false;
    const counts: Record<string, number> = { ";": 0, ",": 0, "\t": 0 };
    for (let i = 0; i < sampleLine.length; i++) {
        const ch = sampleLine[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (!inQuotes && (ch === ";" || ch === "," || ch === "\t")) {
            counts[ch]++;
        }
    }
    if (counts[";"] >= counts[","] && counts[";"] >= counts["\t"] && counts[";"] > 0) {
        return ";";
    }
    if (counts["\t"] > counts[","] && counts["\t"] > 0) {
        return "\t";
    }
    return ",";
}

function parseCsvRowsRaw(text: string, delimiter: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') {
                    currentField += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                currentField += ch;
            }
        } else {
            if (ch === '"' && currentField.trim() === "") {
                inQuotes = true;
                currentField = "";
            } else if (ch === delimiter) {
                currentRow.push(currentField.trim());
                currentField = "";
            } else if (ch === "\r" || ch === "\n") {
                if (ch === "\r" && i + 1 < text.length && text[i + 1] === "\n") {
                    i++;
                }
                currentRow.push(currentField.trim());
                if (currentRow.some((cell) => cell !== "")) {
                    rows.push(currentRow);
                }
                currentRow = [];
                currentField = "";
            } else {
                currentField += ch;
            }
        }
    }

    if (inQuotes || currentField !== "" || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.some((cell) => cell !== "")) {
            rows.push(currentRow);
        }
    }

    return rows;
}

export function parseCsvTextToRows(csvText: string): ParsedCsvData {
    let cleanedText = csvText.replace(/^\uFEFF/, "").trim();

    // Handle DATEV EXTF files where row 1 is `"EXTF";700;21;"Buchungsstapel"...` and row 2 has actual headers
    const rawLines = cleanedText.split(/\r?\n/);
    if (
        rawLines.length >= 2 &&
        (rawLines[0].startsWith('"EXTF"') ||
            rawLines[0].startsWith("EXTF;") ||
            rawLines[0].startsWith('"DTVF"'))
    ) {
        cleanedText = rawLines.slice(1).join("\n");
    }

    const firstLine = cleanedText.split(/\r?\n/)[0] || "";
    const delimiter = detectDelimiter(firstLine);
    const matrix = parseCsvRowsRaw(cleanedText, delimiter);

    if (matrix.length === 0) {
        return {
            headers: [],
            rows: [],
            detectedEntityType: "clients",
            detectedSource: "generic",
        };
    }

    // Deduplicate empty or repeated headers
    const rawHeaders = matrix[0];
    const headers: string[] = [];
    const seenHeaders = new Map<string, number>();
    for (let i = 0; i < rawHeaders.length; i++) {
        const base = rawHeaders[i].trim() || `Spalte_${i + 1}`;
        const count = seenHeaders.get(base) || 0;
        seenHeaders.set(base, count + 1);
        headers.push(count === 0 ? base : `${base}_${count + 1}`);
    }

    const rows: Record<string, string>[] = [];
    for (let r = 1; r < matrix.length; r++) {
        const line = matrix[r];
        const rowObj: Record<string, string> = {};
        let hasNonEmpty = false;
        for (let c = 0; c < headers.length; c++) {
            const val = (line[c] ?? "").trim();
            rowObj[headers[c]] = val;
            if (val !== "") hasNonEmpty = true;
        }
        if (hasNonEmpty) {
            rows.push(rowObj);
        }
    }

    const detectedEntityType = detectEntityTypeFromHeaders(headers);
    const detectedSource = detectSourceFromHeaders(headers);

    return {
        headers,
        rows,
        detectedEntityType,
        detectedSource,
    };
}

function readMappedCell(
    row: Record<string, string>,
    mapping: Record<string, string>,
    fieldKey: string,
): string {
    const col = mapping[fieldKey];
    if (!col) return "";
    return (row[col] ?? "").trim();
}

export function mapRowsToClients(
    rows: Record<string, string>[],
    mapping: Record<string, string>,
): NormalizedMigrationClient[] {
    const result: NormalizedMigrationClient[] = [];

    for (const row of rows) {
        const companyOrName = readMappedCell(row, mapping, "name");
        const firstName = readMappedCell(row, mapping, "first_name");
        const lastName = readMappedCell(row, mapping, "last_name");
        const explicitContact = readMappedCell(row, mapping, "contact_person");

        const fullPersonName = [firstName, lastName].filter(Boolean).join(" ").trim();
        const finalName = companyOrName || fullPersonName;
        if (!finalName) continue;

        const isCompany = Boolean(
            companyOrName &&
                (fullPersonName ||
                    explicitContact ||
                    readMappedCell(row, mapping, "vat_id") ||
                    /gmbh|ug|ag|kg|ohg|gbr|e\.k\.|ltd|inc|llc|haftungsbeschr|partg|stiftung|verein|behörde|stadt|ministerium/i.test(
                        companyOrName,
                    )),
        );

        const contactPerson =
            explicitContact || (companyOrName && fullPersonName ? fullPersonName : "");

        const street = readMappedCell(row, mapping, "address_line1");
        const houseNo = readMappedCell(row, mapping, "house_number");
        const fullStreet = [street, houseNo].filter(Boolean).join(" ").trim();

        const paymentDaysRaw = readMappedCell(row, mapping, "payment_terms_days");
        const paymentDays = paymentDaysRaw
            ? Math.max(0, Math.round(parseFlexibleNumber(paymentDaysRaw, 14)))
            : undefined;

        result.push({
            name: finalName,
            client_type: isCompany ? "company" : "person",
            contact_person: contactPerson || undefined,
            email: readMappedCell(row, mapping, "email") || undefined,
            phone: readMappedCell(row, mapping, "phone") || undefined,
            address_line1: fullStreet || "—",
            address_line2: readMappedCell(row, mapping, "address_line2") || undefined,
            postal_code: readMappedCell(row, mapping, "postal_code") || "00000",
            city: readMappedCell(row, mapping, "city") || "Unbekannt",
            country: normalizeCountry(readMappedCell(row, mapping, "country")),
            vat_id: readMappedCell(row, mapping, "vat_id") || undefined,
            tax_number: readMappedCell(row, mapping, "tax_number") || undefined,
            leitweg_id: readMappedCell(row, mapping, "leitweg_id") || undefined,
            payment_terms_days: paymentDays,
            notes: readMappedCell(row, mapping, "notes") || undefined,
            source_reference: readMappedCell(row, mapping, "source_reference") || undefined,
        });
    }

    return result;
}

export function mapRowsToProducts(
    rows: Record<string, string>[],
    mapping: Record<string, string>,
): NormalizedMigrationProduct[] {
    const result: NormalizedMigrationProduct[] = [];

    for (const row of rows) {
        const name = readMappedCell(row, mapping, "name");
        const description = readMappedCell(row, mapping, "description");
        const finalName = name || description;
        if (!finalName) continue;

        const taxRate = normalizeTaxRate(
            readMappedCell(row, mapping, "tax_rate_percent"),
        );
        const netPriceRaw = readMappedCell(row, mapping, "price");
        const grossPriceRaw = readMappedCell(row, mapping, "gross_price");

        let netPrice = parseFlexibleNumber(netPriceRaw, NaN);
        if (Number.isNaN(netPrice)) {
            const gross = parseFlexibleNumber(grossPriceRaw, 0);
            netPrice =
                taxRate > 0
                    ? Math.round((gross / (1 + taxRate / 100)) * 100) / 100
                    : gross;
        }

        result.push({
            name: finalName,
            description: description && description !== finalName ? description : undefined,
            price: Math.max(0, netPrice),
            tax_rate_percent: taxRate,
            unit_of_measure: normalizeUnitOfMeasure(
                readMappedCell(row, mapping, "unit_of_measure"),
            ),
        });
    }

    return result;
}

export function mapRowsToInvoices(
    rows: Record<string, string>[],
    mapping: Record<string, string>,
): NormalizedMigrationInvoice[] {
    const grouped = new Map<string, NormalizedMigrationInvoice>();

    for (const row of rows) {
        const invoiceNumber = readMappedCell(row, mapping, "invoice_number");
        if (!invoiceNumber) continue;

        const issueDate = parseFlexibleDate(
            readMappedCell(row, mapping, "issue_date"),
        );
        const dueDateRaw = readMappedCell(row, mapping, "due_date");
        const dueDate = dueDateRaw
            ? parseFlexibleDate(dueDateRaw, addDaysToIsoDate(issueDate, 14))
            : addDaysToIsoDate(issueDate, 14);
        const deliveryDateRaw = readMappedCell(row, mapping, "delivery_date");
        const deliveryDate = deliveryDateRaw
            ? parseFlexibleDate(deliveryDateRaw, issueDate)
            : issueDate;

        const clientName =
            readMappedCell(row, mapping, "client_name") || "Importierter Kunde";
        const clientEmail = readMappedCell(row, mapping, "client_email") || undefined;
        const status = normalizeInvoiceStatus(readMappedCell(row, mapping, "status"));

        const taxRate = normalizeTaxRate(
            readMappedCell(row, mapping, "tax_rate_percent"),
        );
        const netRaw = readMappedCell(row, mapping, "subtotal");
        const vatRaw = readMappedCell(row, mapping, "total_vat");
        const grossRaw = readMappedCell(row, mapping, "total_gross");

        const qty = Math.max(
            0.01,
            parseFlexibleNumber(readMappedCell(row, mapping, "item_quantity"), 1),
        );
        const unit = normalizeUnitOfMeasure(
            readMappedCell(row, mapping, "item_unit"),
        );
        const itemDesc =
            readMappedCell(row, mapping, "item_description") ||
            `Rechnung ${invoiceNumber}`;

        let lineNet = parseFlexibleNumber(netRaw, NaN);
        let lineVat = parseFlexibleNumber(vatRaw, NaN);
        let lineGross = parseFlexibleNumber(grossRaw, NaN);
        const explicitUnitPrice = parseFlexibleNumber(
            readMappedCell(row, mapping, "item_price"),
            NaN,
        );

        if (Number.isNaN(lineNet) && !Number.isNaN(explicitUnitPrice)) {
            lineNet = Math.round(explicitUnitPrice * qty * 100) / 100;
        }
        if (Number.isNaN(lineNet) && !Number.isNaN(lineGross)) {
            if (!Number.isNaN(lineVat)) {
                lineNet = Math.round((lineGross - lineVat) * 100) / 100;
            } else {
                lineNet =
                    Math.round((lineGross / (1 + taxRate / 100)) * 100) / 100;
            }
        }
        if (Number.isNaN(lineNet)) lineNet = 0;

        if (Number.isNaN(lineVat)) {
            if (!Number.isNaN(lineGross) && lineGross >= lineNet) {
                lineVat = Math.round((lineGross - lineNet) * 100) / 100;
            } else {
                lineVat = Math.round(lineNet * (taxRate / 100) * 100) / 100;
            }
        }
        if (Number.isNaN(lineGross)) {
            lineGross = Math.round((lineNet + lineVat) * 100) / 100;
        }

        const unitPrice = !Number.isNaN(explicitUnitPrice)
            ? explicitUnitPrice
            : Math.round((lineNet / qty) * 100) / 100;

        const item: NormalizedMigrationInvoiceItem = {
            description: itemDesc,
            quantity: qty,
            unit_of_measure: unit,
            price: unitPrice,
            tax_rate_percent: taxRate,
            discount_percent: 0,
            subtotal: lineNet,
            tax_amount: lineVat,
            total: lineGross,
        };

        const existing = grouped.get(invoiceNumber);
        if (existing) {
            existing.items.push(item);
            existing.subtotal =
                Math.round((existing.subtotal + lineNet) * 100) / 100;
            existing.total_vat =
                Math.round((existing.total_vat + lineVat) * 100) / 100;
            existing.total_gross =
                Math.round((existing.total_gross + lineGross) * 100) / 100;
        } else {
            grouped.set(invoiceNumber, {
                invoice_number: invoiceNumber,
                issue_date: issueDate,
                due_date: dueDate,
                delivery_date: deliveryDate,
                status,
                client_name: clientName,
                client_email: clientEmail,
                subtotal: lineNet,
                total_vat: lineVat,
                total_gross: lineGross,
                items: [item],
            });
        }
    }

    return Array.from(grouped.values());
}

export function mapRowsToExpenses(
    rows: Record<string, string>[],
    mapping: Record<string, string>,
): NormalizedMigrationExpense[] {
    const result: NormalizedMigrationExpense[] = [];

    for (const row of rows) {
        const vendor = readMappedCell(row, mapping, "vendor_name");
        const desc = readMappedCell(row, mapping, "description");
        const finalVendor = vendor || desc;
        if (!finalVendor) continue;

        const date = parseFlexibleDate(readMappedCell(row, mapping, "date"));
        const taxRate = normalizeTaxRate(
            readMappedCell(row, mapping, "vat_rate_percent"),
        );

        const netRaw = readMappedCell(row, mapping, "amount_net");
        const vatRaw = readMappedCell(row, mapping, "vat_amount");
        const grossRaw = readMappedCell(row, mapping, "amount_gross");

        let net = parseFlexibleNumber(netRaw, NaN);
        let vat = parseFlexibleNumber(vatRaw, NaN);
        let gross = parseFlexibleNumber(grossRaw, NaN);

        if (Number.isNaN(gross) && !Number.isNaN(net)) {
            if (!Number.isNaN(vat)) {
                gross = Math.round((net + vat) * 100) / 100;
            } else {
                vat = Math.round(net * (taxRate / 100) * 100) / 100;
                gross = Math.round((net + vat) * 100) / 100;
            }
        } else if (!Number.isNaN(gross) && Number.isNaN(net)) {
            if (!Number.isNaN(vat)) {
                net = Math.round((gross - vat) * 100) / 100;
            } else {
                net = Math.round((gross / (1 + taxRate / 100)) * 100) / 100;
                vat = Math.round((gross - net) * 100) / 100;
            }
        }

        if (Number.isNaN(gross) || gross <= 0) continue;
        if (Number.isNaN(net)) net = gross;
        if (Number.isNaN(vat)) vat = Math.max(0, Math.round((gross - net) * 100) / 100);

        const category = normalizeExpenseCategory(
            readMappedCell(row, mapping, "category"),
            `${finalVendor} ${desc}`,
        );

        result.push({
            date,
            vendor_name: finalVendor,
            description: desc || `Beleg von ${finalVendor}`,
            category,
            amount_net: Math.abs(net),
            vat_rate_percent: taxRate,
            vat_amount: Math.abs(vat),
            amount_gross: Math.abs(gross),
            payment_method: "bank_transfer",
            invoice_number:
                readMappedCell(row, mapping, "invoice_number") || undefined,
        });
    }

    return result;
}

// ─── Zero-Dependency XML & ZUGFeRD PDF Parser for E-Invoices ────────────────

export interface ParsedMigrationEInvoice {
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    deliveryDate?: string;
    currency: string;
    seller: NormalizedMigrationClient;
    buyer: NormalizedMigrationClient;
    subtotal: number;
    totalVat: number;
    totalGross: number;
    taxRatePercent: number;
    notes?: string;
    items: NormalizedMigrationInvoiceItem[];
}

function decodeXmlEntities(text: string): string {
    return text
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number(dec)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&amp;/g, "&");
}

function parseXmlAttributes(attrStr: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const regex = /([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(attrStr)) !== null) {
        const key = m[1].replace(/^.*:/, "");
        const val = decodeXmlEntities(m[2] ?? m[3] ?? "");
        attrs[`@_${key}`] = val;
    }
    return attrs;
}

/**
 * Lightweight recursive-descent XML to object tree parser that strips namespace prefixes
 * and preserves attributes as `@_attr` and text content as `#text` (or string when no attributes).
 */
export function parseXmlToObject(xmlString: string): Record<string, any> {
    const cleaned = xmlString
        .replace(/^\uFEFF/, "")
        .replace(/<\?xml[\s\S]*?\?>/gi, "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<!DOCTYPE[\s\S]*?>/gi, "");

    interface StackFrame {
        tag: string;
        attrs: Record<string, string>;
        children: Record<string, any>;
        text: string;
    }

    const rootFrame: StackFrame = {
        tag: "__root__",
        attrs: {},
        children: {},
        text: "",
    };
    const stack: StackFrame[] = [rootFrame];

    const tagRegex = /<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z_][\w:.-]*)([^>]*?)(\/?)>/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    const finalizeFrame = (frame: StackFrame): any => {
        const hasChildren = Object.keys(frame.children).length > 0;
        const hasAttrs = Object.keys(frame.attrs).length > 0;
        const trimmedText = decodeXmlEntities(frame.text.trim());

        if (!hasChildren && !hasAttrs) {
            return trimmedText;
        }
        const out: Record<string, any> = { ...frame.attrs, ...frame.children };
        if (trimmedText) {
            out["#text"] = trimmedText;
        }
        return out;
    };

    const attachChild = (parent: StackFrame, tag: string, value: any) => {
        if (Object.prototype.hasOwnProperty.call(parent.children, tag)) {
            if (Array.isArray(parent.children[tag])) {
                parent.children[tag].push(value);
            } else {
                parent.children[tag] = [parent.children[tag], value];
            }
        } else {
            parent.children[tag] = value;
        }
    };

    while ((match = tagRegex.exec(cleaned)) !== null) {
        if (match.index > lastIndex) {
            stack[stack.length - 1].text += cleaned.slice(lastIndex, match.index);
        }
        lastIndex = tagRegex.lastIndex;

        if (match[1] !== undefined) {
            // CDATA
            stack[stack.length - 1].text += match[1];
            continue;
        }

        const isClosing = match[2] === "/";
        const rawTagName = match[3];
        const cleanTagName = rawTagName.replace(/^.*:/, "");
        const attrPart = match[4] || "";
        const isSelfClosing = match[5] === "/";

        if (isClosing) {
            if (stack.length > 1) {
                const popped = stack.pop()!;
                const parent = stack[stack.length - 1];
                attachChild(parent, popped.tag, finalizeFrame(popped));
            }
        } else if (isSelfClosing) {
            const frame: StackFrame = {
                tag: cleanTagName,
                attrs: parseXmlAttributes(attrPart),
                children: {},
                text: "",
            };
            attachChild(stack[stack.length - 1], cleanTagName, finalizeFrame(frame));
        } else {
            stack.push({
                tag: cleanTagName,
                attrs: parseXmlAttributes(attrPart),
                children: {},
                text: "",
            });
        }
    }

    while (stack.length > 1) {
        const popped = stack.pop()!;
        attachChild(stack[stack.length - 1], popped.tag, finalizeFrame(popped));
    }

    return rootFrame.children;
}

function textOf(node: unknown): string {
    if (node === null || node === undefined) return "";
    if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
        return String(node).trim();
    }
    if (Array.isArray(node)) {
        return textOf(node[0]);
    }
    if (typeof node === "object") {
        const rec = node as Record<string, unknown>;
        return String(rec["#text"] ?? rec["@_value"] ?? "").trim();
    }
    return "";
}

function attrOf(node: unknown, attrName: string): string {
    if (!node || typeof node !== "object") return "";
    if (Array.isArray(node)) return attrOf(node[0], attrName);
    const rec = node as Record<string, unknown>;
    return String(rec[`@_${attrName}`] ?? rec[attrName] ?? "").trim();
}

function asArray<T = Record<string, any>>(val: unknown): T[] {
    if (!val) return [];
    return (Array.isArray(val) ? val : [val]) as T[];
}

export function parseEInvoiceXmlForMigration(
    xmlContent: string,
): ParsedMigrationEInvoice | null {
    try {
        const obj = parseXmlToObject(xmlContent);

        if (
            obj.CrossIndustryInvoice ||
            obj.SupplyChainTradeTransaction
        ) {
            return parseCiiForMigration(obj);
        }

        if (obj.Invoice || obj.CreditNote) {
            return parseUblForMigration(obj);
        }

        return null;
    } catch {
        return null;
    }
}

function extractCiiParty(
    party: Record<string, any>,
    buyerReferenceFallback?: string,
): NormalizedMigrationClient {
    const name = textOf(party.Name) || "Unbekannt";
    const addr = party.PostalTradeAddress || {};
    const contact = party.DefinedTradeContact || {};

    let email = textOf(contact?.EmailURIUniversalCommunication?.URIID);
    let leitweg = buyerReferenceFallback || "";

    const uriComm = party.URIUniversalCommunication;
    if (uriComm) {
        const uriIdNode = uriComm.URIID;
        const scheme = attrOf(uriIdNode, "schemeID");
        const uriVal = textOf(uriIdNode);
        if (scheme === "EM" || uriVal.includes("@")) {
            if (!email) email = uriVal;
        } else if (scheme === "0204" && !leitweg) {
            leitweg = uriVal;
        }
    }

    let vatId = "";
    let taxNumber = "";
    for (const reg of asArray(party.SpecifiedTaxRegistration)) {
        const idNode = reg?.ID;
        const scheme = attrOf(idNode, "schemeID");
        const val = textOf(idNode);
        if (scheme === "VA" || /^[A-Z]{2}/i.test(val)) {
            vatId = val;
        } else if (scheme === "FC") {
            taxNumber = val;
        }
    }

    return {
        name,
        client_type: "company",
        contact_person: textOf(contact.PersonName) || undefined,
        email: email || undefined,
        phone: textOf(contact?.TelephoneUniversalCommunication?.CompleteNumber) || undefined,
        address_line1: textOf(addr.LineOne) || "—",
        address_line2: textOf(addr.LineTwo) || undefined,
        postal_code: textOf(addr.PostcodeCode) || "00000",
        city: textOf(addr.CityName) || "Unbekannt",
        country: normalizeCountry(textOf(addr.CountryID)),
        vat_id: vatId || undefined,
        tax_number: taxNumber || undefined,
        leitweg_id:
            leitweg && leitweg !== "N/A" && leitweg !== "XRECHNUNG"
                ? leitweg
                : undefined,
    };
}

function parseCiiForMigration(
    obj: Record<string, any>,
): ParsedMigrationEInvoice | null {
    const root = obj.CrossIndustryInvoice || obj;
    const tx = root.SupplyChainTradeTransaction || {};
    const headerDoc = root.ExchangedDocument || {};
    const agreement = tx.ApplicableHeaderTradeAgreement || {};
    const delivery = tx.ApplicableHeaderTradeDelivery || {};
    const settlement = tx.ApplicableHeaderTradeSettlement || {};
    const monetary =
        settlement.SpecifiedTradeSettlementHeaderMonetarySummation || {};

    const invoiceNumber =
        textOf(headerDoc.ID) || `IMP-${Date.now().toString().slice(-5)}`;
    const issueDate = parseFlexibleDate(
        textOf(headerDoc.IssueDateTime?.DateTimeString),
    );
    const deliveryDate = parseFlexibleDate(
        textOf(
            delivery.ActualDeliverySupplyChainEvent?.OccurrenceDateTime
                ?.DateTimeString,
        ),
        issueDate,
    );

    const paymentTermsNode = Array.isArray(settlement.SpecifiedTradePaymentTerms)
        ? settlement.SpecifiedTradePaymentTerms[0]
        : settlement.SpecifiedTradePaymentTerms;
    const dueDateRaw = textOf(
        paymentTermsNode?.DueDateDateTime?.DateTimeString,
    );
    const dueDate = dueDateRaw
        ? parseFlexibleDate(dueDateRaw)
        : addDaysToIsoDate(issueDate, 14);

    const buyerRef = textOf(agreement.BuyerReference);
    const seller = extractCiiParty(agreement.SellerTradeParty || {});
    const buyer = extractCiiParty(agreement.BuyerTradeParty || {}, buyerRef);

    const taxNode = Array.isArray(settlement.ApplicableTradeTax)
        ? settlement.ApplicableTradeTax[0]
        : settlement.ApplicableTradeTax;
    const headerTaxRate = normalizeTaxRate(
        textOf(taxNode?.RateApplicablePercent),
    );

    const items: NormalizedMigrationInvoiceItem[] = [];
    for (const line of asArray(tx.IncludedSupplyChainTradeLineItem)) {
        const prod = line.SpecifiedTradeProduct || {};
        const lineAgree = line.SpecifiedLineTradeAgreement || {};
        const lineDeliv = line.SpecifiedLineTradeDelivery || {};
        const lineSettle = line.SpecifiedLineTradeSettlement || {};
        const lineTax = Array.isArray(lineSettle.ApplicableTradeTax)
            ? lineSettle.ApplicableTradeTax[0]
            : lineSettle.ApplicableTradeTax;
        const lineSum =
            lineSettle.SpecifiedTradeSettlementLineMonetarySummation || {};

        const desc = textOf(prod.Name) || textOf(prod.Description) || "Position";
        const qtyNode = lineDeliv.BilledQuantity;
        const qty = Math.max(0.01, parseFlexibleNumber(textOf(qtyNode), 1));
        const unitCode = attrOf(qtyNode, "unitCode");
        const unit = normalizeUnitOfMeasure(unitCode || "Stück");
        const unitPrice = parseFlexibleNumber(
            textOf(lineAgree.NetPriceProductTradePrice?.ChargeAmount),
            0,
        );
        const rate = normalizeTaxRate(
            textOf(lineTax?.RateApplicablePercent) || headerTaxRate,
        );
        const subtotal = parseFlexibleNumber(
            textOf(lineSum.LineTotalAmount),
            Math.round(qty * unitPrice * 100) / 100,
        );
        const taxAmount = Math.round(subtotal * (rate / 100) * 100) / 100;
        const total = Math.round((subtotal + taxAmount) * 100) / 100;

        items.push({
            description: desc,
            quantity: qty,
            unit_of_measure: unit,
            price: unitPrice,
            tax_rate_percent: rate,
            discount_percent: 0,
            subtotal,
            tax_amount: taxAmount,
            total,
        });
    }

    const subtotal = parseFlexibleNumber(
        textOf(monetary.TaxBasisTotalAmount) || textOf(monetary.LineTotalAmount),
        items.reduce((s, i) => s + i.subtotal, 0),
    );
    const totalVat = parseFlexibleNumber(
        textOf(monetary.TaxTotalAmount),
        items.reduce((s, i) => s + i.tax_amount, 0),
    );
    const totalGross = parseFlexibleNumber(
        textOf(monetary.GrandTotalAmount) || textOf(monetary.DuePayableAmount),
        Math.round((subtotal + totalVat) * 100) / 100,
    );

    if (items.length === 0) {
        items.push({
            description: `Rechnung ${invoiceNumber}`,
            quantity: 1,
            unit_of_measure: "Pauschal",
            price: subtotal,
            tax_rate_percent: headerTaxRate,
            discount_percent: 0,
            subtotal,
            tax_amount: totalVat,
            total: totalGross,
        });
    }

    return {
        invoiceNumber,
        issueDate,
        dueDate,
        deliveryDate,
        currency: textOf(settlement.InvoiceCurrencyCode) || "EUR",
        seller,
        buyer,
        subtotal,
        totalVat,
        totalGross,
        taxRatePercent: headerTaxRate,
        items,
    };
}

function extractUblParty(
    partyWrapper: Record<string, any>,
    buyerReferenceFallback?: string,
): NormalizedMigrationClient {
    const party = partyWrapper?.Party || partyWrapper || {};
    const name =
        textOf(party.PartyLegalEntity?.RegistrationName) ||
        textOf(party.PartyName?.Name) ||
        "Unbekannt";
    const addr = party.PostalAddress || {};
    const contact = party.Contact || {};

    let email = textOf(contact.ElectronicMail);
    const endpoint = party.EndpointID;
    const endpointVal = textOf(endpoint);
    if (!email && endpointVal.includes("@")) {
        email = endpointVal;
    }

    const vatId = textOf(party.PartyTaxScheme?.CompanyID);

    return {
        name,
        client_type: "company",
        contact_person: textOf(contact.Name) || undefined,
        email: email || undefined,
        phone: textOf(contact.Telephone) || undefined,
        address_line1: textOf(addr.StreetName) || "—",
        address_line2: textOf(addr.AdditionalStreetName) || undefined,
        postal_code: textOf(addr.PostalZone) || "00000",
        city: textOf(addr.CityName) || "Unbekannt",
        country: normalizeCountry(textOf(addr.Country?.IdentificationCode)),
        vat_id: vatId || undefined,
        leitweg_id:
            buyerReferenceFallback &&
            buyerReferenceFallback !== "N/A" &&
            buyerReferenceFallback !== "XRECHNUNG"
                ? buyerReferenceFallback
                : undefined,
    };
}

function parseUblForMigration(
    obj: Record<string, any>,
): ParsedMigrationEInvoice | null {
    const root = obj.Invoice || obj.CreditNote || obj;
    const invoiceNumber =
        textOf(root.ID) || `IMP-${Date.now().toString().slice(-5)}`;
    const issueDate = parseFlexibleDate(textOf(root.IssueDate));
    const dueDate = parseFlexibleDate(
        textOf(root.DueDate),
        addDaysToIsoDate(issueDate, 14),
    );
    const deliveryDate = parseFlexibleDate(
        textOf(root.Delivery?.ActualDeliveryDate),
        issueDate,
    );

    const buyerRef = textOf(root.BuyerReference);
    const seller = extractUblParty(root.AccountingSupplierParty || {});
    const buyer = extractUblParty(root.AccountingCustomerParty || {}, buyerRef);

    const taxTotal = Array.isArray(root.TaxTotal)
        ? root.TaxTotal[0]
        : root.TaxTotal;
    const taxSubtotal = Array.isArray(taxTotal?.TaxSubtotal)
        ? taxTotal.TaxSubtotal[0]
        : taxTotal?.TaxSubtotal;
    const headerTaxRate = normalizeTaxRate(
        textOf(taxSubtotal?.TaxCategory?.Percent),
    );

    const monetary = root.LegalMonetaryTotal || {};
    const rawLines = asArray(root.InvoiceLine || root.CreditNoteLine);
    const items: NormalizedMigrationInvoiceItem[] = [];

    for (const line of rawLines) {
        const itemNode = line.Item || {};
        const desc =
            textOf(itemNode.Name) || textOf(itemNode.Description) || "Position";
        const qtyNode = line.InvoicedQuantity || line.CreditedQuantity;
        const qty = Math.max(0.01, parseFlexibleNumber(textOf(qtyNode), 1));
        const unit = normalizeUnitOfMeasure(
            attrOf(qtyNode, "unitCode") || "Stück",
        );
        const unitPrice = parseFlexibleNumber(
            textOf(line.Price?.PriceAmount),
            0,
        );
        const rate = normalizeTaxRate(
            textOf(itemNode.ClassifiedTaxCategory?.Percent) || headerTaxRate,
        );
        const subtotal = parseFlexibleNumber(
            textOf(line.LineExtensionAmount),
            Math.round(qty * unitPrice * 100) / 100,
        );
        const taxAmount = Math.round(subtotal * (rate / 100) * 100) / 100;
        const total = Math.round((subtotal + taxAmount) * 100) / 100;

        items.push({
            description: desc,
            quantity: qty,
            unit_of_measure: unit,
            price: unitPrice,
            tax_rate_percent: rate,
            discount_percent: 0,
            subtotal,
            tax_amount: taxAmount,
            total,
        });
    }

    const subtotal = parseFlexibleNumber(
        textOf(monetary.TaxExclusiveAmount) ||
            textOf(monetary.LineExtensionAmount),
        items.reduce((s, i) => s + i.subtotal, 0),
    );
    const totalVat = parseFlexibleNumber(
        textOf(taxTotal?.TaxAmount),
        items.reduce((s, i) => s + i.tax_amount, 0),
    );
    const totalGross = parseFlexibleNumber(
        textOf(monetary.TaxInclusiveAmount) || textOf(monetary.PayableAmount),
        Math.round((subtotal + totalVat) * 100) / 100,
    );

    if (items.length === 0) {
        items.push({
            description: `Rechnung ${invoiceNumber}`,
            quantity: 1,
            unit_of_measure: "Pauschal",
            price: subtotal,
            tax_rate_percent: headerTaxRate,
            discount_percent: 0,
            subtotal,
            tax_amount: totalVat,
            total: totalGross,
        });
    }

    return {
        invoiceNumber,
        issueDate,
        dueDate,
        deliveryDate,
        currency: textOf(root.DocumentCurrencyCode) || "EUR",
        seller,
        buyer,
        subtotal,
        totalVat,
        totalGross,
        taxRatePercent: headerTaxRate,
        items,
    };
}

/**
 * Extracts embedded XRechnung / ZUGFeRD / Factur-X XML from a PDF buffer.
 */
export function extractXmlFromPdf(pdfBuffer: Buffer): string | null {
    const rawStr = pdfBuffer.toString("utf8");
    const directXml = findXmlPayloadInString(rawStr);
    if (directXml) return directXml;

    const streamMarker = Buffer.from("stream");
    const endstreamMarker = Buffer.from("endstream");
    let offset = 0;

    while (offset < pdfBuffer.length) {
        const streamStart = pdfBuffer.indexOf(streamMarker, offset);
        if (streamStart === -1) break;

        let dataStart = streamStart + streamMarker.length;
        if (pdfBuffer[dataStart] === 0x0d && pdfBuffer[dataStart + 1] === 0x0a) {
            dataStart += 2;
        } else if (pdfBuffer[dataStart] === 0x0a || pdfBuffer[dataStart] === 0x0d) {
            dataStart += 1;
        } else {
            offset = streamStart + 6;
            continue;
        }

        const streamEnd = pdfBuffer.indexOf(endstreamMarker, dataStart);
        if (streamEnd === -1) break;

        let dataEnd = streamEnd;
        if (pdfBuffer[dataEnd - 2] === 0x0d && pdfBuffer[dataEnd - 1] === 0x0a) {
            dataEnd -= 2;
        } else if (pdfBuffer[dataEnd - 1] === 0x0a || pdfBuffer[dataEnd - 1] === 0x0d) {
            dataEnd -= 1;
        }

        const compressedChunk = pdfBuffer.subarray(dataStart, dataEnd);
        if (compressedChunk.length > 0 && compressedChunk.length < 15 * 1024 * 1024) {
            try {
                const decompressed = zlib.inflateSync(compressedChunk);
                const text = decompressed.toString("utf8");
                const found = findXmlPayloadInString(text);
                if (found) return found;
            } catch {
                try {
                    const decompressedRaw = zlib.inflateRawSync(compressedChunk);
                    const text = decompressedRaw.toString("utf8");
                    const found = findXmlPayloadInString(text);
                    if (found) return found;
                } catch {
                    // Not a FlateDecode XML stream
                }
            }
        }

        offset = streamEnd + endstreamMarker.length;
    }

    return null;
}

function findXmlPayloadInString(text: string): string | null {
    const ciiStart = text.search(/<(?:rsm:)?CrossIndustryInvoice[\s>]/);
    if (ciiStart !== -1) {
        const endMatch = text.match(/<\/(?:rsm:)?CrossIndustryInvoice>/);
        if (endMatch && endMatch.index !== undefined) {
            return text.slice(ciiStart, endMatch.index + endMatch[0].length);
        }
    }

    const ublStart = text.search(/<(?:ubl:)?Invoice[\s>]/);
    if (ublStart !== -1) {
        const endMatch = text.match(/<\/(?:ubl:)?Invoice>/);
        if (endMatch && endMatch.index !== undefined) {
            return text.slice(ublStart, endMatch.index + endMatch[0].length);
        }
    }

    const cnStart = text.search(/<(?:ubl:)?CreditNote[\s>]/);
    if (cnStart !== -1) {
        const endMatch = text.match(/<\/(?:ubl:)?CreditNote>/);
        if (endMatch && endMatch.index !== undefined) {
            return text.slice(cnStart, endMatch.index + endMatch[0].length);
        }
    }

    return null;
}

/**
 * Generates sample CSV templates for users who want a clean template.
 */
export function generateSampleCsvTemplate(
    entityType: Exclude<MigrationEntityType, "full_backup">,
): string {
    switch (entityType) {
        case "clients":
            return [
                "Firmenname;Ansprechpartner;E-Mail;Telefon;Straße;PLZ;Ort;Land;USt-IdNr.;Leitweg-ID;Zahlungsziel (Tage)",
                "Müller Consulting GmbH;Anna Müller;rechnung@mueller-consulting.de;+49 30 1234567;Friedrichstraße 100;10117;Berlin;Deutschland;DE123456789;;14",
                "Stadtverwaltung Musterstadt;Herr Weber;poststelle@musterstadt.de;+49 89 987654;Marienplatz 1;80331;München;Deutschland;DE987654321;09162-0000-01;30",
            ].join("\r\n");
        case "products":
            return [
                "Bezeichnung;Beschreibung;Einzelpreis (Netto);Steuersatz (%);Einheit",
                "Strategie-Workshop;Ganztägiger Konzeptions-Workshop inkl. Dokumentation;1200,00;19;Tag",
                "UI/UX Design & Umsetzung;Gestaltung und Frontend-Entwicklung nach Aufwand;110,00;19;Stunde",
                "Webhosting & Wartung;Monatliche Serverbetreuung und Sicherheitsupdates;49,00;19;Monat",
            ].join("\r\n");
        case "invoices":
            return [
                "Rechnungsnummer;Rechnungsdatum;Fälligkeitsdatum;Kunde;Positionsbeschreibung;Menge;Einheit;Nettobetrag;Steuersatz (%);Steuerbetrag;Bruttobetrag;Status",
                "RE-2026-001;15.01.2026;29.01.2026;Müller Consulting GmbH;Strategie-Workshop & Konzeption;1;Pauschal;1200,00;19;228,00;1428,00;Bezahlt",
                "RE-2026-002;02.02.2026;16.02.2026;Stadtverwaltung Musterstadt;IT-Beratung Januar;10;Stunde;1100,00;19;209,00;1309,00;Offen",
            ].join("\r\n");
        case "expenses":
            return [
                "Belegdatum;Lieferant;Verwendungszweck;Kategorie;Nettobetrag;Steuersatz (%);Steuerbetrag;Bruttobetrag;Belegnummer",
                "10.01.2026;Hetzner Online GmbH;Cloud Server Hosting Januar;Software;40,00;19;7,60;47,60;H-2026-991",
                "18.01.2026;Deutsche Bahn AG;ICE Ticket Kundentermin München;Reisekosten;84,03;19;15,97;100,00;DB-88219",
            ].join("\r\n");
    }
}

// ─── Rechly Backup Export & Import for Local Desktop SQLite Store ────────────

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const finiteNum = (n: unknown, fallback = 0): number =>
    typeof n === "number" && Number.isFinite(n) ? round2(n) : parseFlexibleNumber(n as any, fallback);

/**
 * Exports the entire Desktop store as a portable `RechlyBackupBundle`
 * 100% compatible with Rechly Web Cloud (`/api/migration/backup`).
 */
export function createRechlyBackupBundle(storeData: StoreData): RechlyBackupBundle {
    const clientsById = new Map<string, Client>();
    for (const c of storeData.clients || []) {
        clientsById.set(c.id, c);
    }

    const company: Record<string, unknown> | null = storeData.company
        ? {
              name: storeData.company.name || "",
              legal_form: storeData.company.legal_form || "",
              address_line1: storeData.company.address_line1 || "",
              postal_code: storeData.company.postal_code || "",
              city: storeData.company.city || "",
              country: storeData.company.country || "DE",
              email: storeData.company.email || "",
              phone: storeData.company.phone || "",
              vat_id: storeData.company.vat_id || "",
              tax_number: storeData.company.tax_number || "",
              bank_name: storeData.company.bank_name || "",
              bank_iban: storeData.company.bank_iban || "",
              bank_bic: storeData.company.bank_bic || "",
              payment_terms_default: storeData.company.payment_terms_default || "",
              is_small_business: Boolean(storeData.company.is_small_business),
              invoice_template: storeData.company.invoice_template || "classic",
          }
        : null;

    const clients: NormalizedMigrationClient[] = (storeData.clients || []).map((c) => ({
        name: String(c.name || ""),
        client_type: "company",
        contact_person: c.contact_person || undefined,
        email: c.email || undefined,
        phone: c.phone || undefined,
        address_line1: String(c.address_line1 || "—"),
        postal_code: String(c.postal_code || "00000"),
        city: String(c.city || "Unbekannt"),
        country: normalizeCountry(c.country),
        vat_id: c.vat_id || undefined,
        tax_number: c.tax_number || undefined,
        leitweg_id: c.leitweg_id || undefined,
    }));

    const products: NormalizedMigrationProduct[] = (storeData.products || []).map((p) => ({
        name: String(p.name || ""),
        description: p.description || undefined,
        price: finiteNum(p.price, 0),
        tax_rate_percent: finiteNum(p.tax_rate_percent, 19),
        unit_of_measure: String(p.unit_of_measure || "Stück"),
    }));

    const invoices: NormalizedMigrationInvoice[] = (storeData.invoices || []).map((inv) => {
        const client = inv.client_id ? clientsById.get(inv.client_id) : undefined;
        const items: NormalizedMigrationInvoiceItem[] = (inv.items || []).map((it) => {
            const qty = finiteNum(it.quantity, 1);
            const price = finiteNum(it.price, 0);
            const rate = finiteNum(it.tax_rate_percent, 19);
            const discount = finiteNum(it.discount_percent, 0);
            const subtotal = round2(qty * price * (1 - discount / 100));
            const taxAmount = round2(subtotal * (rate / 100));
            const total = round2(subtotal + taxAmount);
            return {
                description: String(it.description || "Position"),
                quantity: qty,
                unit_of_measure: String(it.unit_of_measure || "Stück"),
                price,
                tax_rate_percent: rate,
                discount_percent: discount,
                subtotal,
                tax_amount: taxAmount,
                total,
            };
        });

        return {
            invoice_number: String(inv.invoice_number || inv.id),
            issue_date: parseFlexibleDate(inv.issue_date),
            due_date: parseFlexibleDate(inv.due_date, addDaysToIsoDate(parseFlexibleDate(inv.issue_date), 14)),
            delivery_date: inv.delivery_date ? parseFlexibleDate(inv.delivery_date) : undefined,
            status: normalizeInvoiceStatus(inv.status),
            client_name: String(client?.name || "Unbekannter Kunde"),
            client_email: client?.email || undefined,
            client_address: client?.address_line1 || undefined,
            client_postal_code: client?.postal_code || undefined,
            client_city: client?.city || undefined,
            client_country: client?.country || undefined,
            client_vat_id: client?.vat_id || undefined,
            client_leitweg_id: client?.leitweg_id || undefined,
            subtotal: finiteNum(inv.subtotal, 0),
            total_vat: finiteNum(inv.total_vat, 0),
            total_gross: finiteNum(inv.total_gross, 0),
            notes: inv.notes || undefined,
            payment_terms: inv.payment_terms || undefined,
            items,
        };
    });

    const offers: NonNullable<RechlyBackupBundle["offers"]> = (storeData.offers || []).map((off) => {
        const client = off.client_id ? clientsById.get(off.client_id) : undefined;
        const items: NormalizedMigrationInvoiceItem[] = (off.items || []).map((it) => {
            const qty = finiteNum(it.quantity, 1);
            const price = finiteNum(it.price, 0);
            const rate = finiteNum(it.tax_rate_percent, 19);
            const discount = finiteNum(it.discount_percent, 0);
            const subtotal = round2(qty * price * (1 - discount / 100));
            const taxAmount = round2(subtotal * (rate / 100));
            const total = round2(subtotal + taxAmount);
            return {
                description: String(it.description || "Position"),
                quantity: qty,
                unit_of_measure: String(it.unit_of_measure || "Stück"),
                price,
                tax_rate_percent: rate,
                discount_percent: discount,
                subtotal,
                tax_amount: taxAmount,
                total,
            };
        });

        return {
            offer_number: String(off.offer_number || off.id),
            issue_date: parseFlexibleDate(off.issue_date),
            valid_until: parseFlexibleDate(off.valid_until, addDaysToIsoDate(parseFlexibleDate(off.issue_date), 30)),
            status: String(off.status || "draft"),
            client_name: String(client?.name || "Unbekannter Kunde"),
            client_email: client?.email || undefined,
            subtotal: finiteNum(off.subtotal, 0),
            total_vat: finiteNum(off.total_vat, 0),
            total_gross: finiteNum(off.total_gross, 0),
            notes: off.notes || undefined,
            payment_terms: off.payment_terms || undefined,
            items,
        };
    });

    const expenses: NormalizedMigrationExpense[] = (storeData.expenses || []).map((e) => {
        const vatRate = finiteNum(e.vat_rate, 19);
        const gross = finiteNum(e.amount_gross, 0);
        const net = round2(gross / (1 + vatRate / 100));
        const vatAmount = round2(gross - net);
        return {
            date: parseFlexibleDate(e.date),
            vendor_name: String(e.vendor_name || "Lieferant"),
            description: String(e.description || e.vendor_name || "Ausgabe"),
            category: normalizeExpenseCategory(e.category, e.description || ""),
            amount_net: net,
            vat_rate_percent: vatRate,
            vat_amount: vatAmount,
            amount_gross: gross,
            payment_method: "bank_transfer",
        };
    });

    return {
        rechlyBackupVersion: 1,
        exportedAt: new Date().toISOString(),
        sourceApp: "Rechly",
        company,
        clients,
        products,
        invoices,
        offers,
        expenses,
    };
}

function toDesktopCountryIso(raw: string | undefined): string {
    const c = (raw || "").trim();
    if (!c) return "DE";
    if (/^[A-Za-z]{2}$/.test(c)) return c.toUpperCase();
    const lower = c.toLowerCase();
    if (lower.includes("deutschland") || lower === "germany") return "DE";
    if (lower.includes("österreich") || lower.includes("oesterreich") || lower === "austria") return "AT";
    if (lower.includes("schweiz") || lower === "switzerland") return "CH";
    return "DE";
}

function toDesktopInvoiceStatus(status: string | undefined): "draft" | "sent" | "paid" {
    const norm = normalizeInvoiceStatus(status);
    if (norm === "paid") return "paid";
    if (norm === "draft" || norm === "cancelled") return "draft";
    return "sent";
}

/**
 * Imports normalized migration entities or a full RechlyBackupBundle into the Desktop StoreData,
 * maintaining strict compatibility with `validateStore` in `storageValidation.ts`.
 */
export function executeMigrationImport(
    storeData: StoreData,
    payload: MigrationImportPayload,
): { result: MigrationImportResult; updatedStore: StoreData } {
    const skipDuplicates = payload.skipDuplicates !== false;
    const nextStore = structuredClone(storeData);

    const result: MigrationImportResult = {
        companyUpdated: false,
        clients: { inserted: 0, skipped: 0 },
        products: { inserted: 0, skipped: 0 },
        invoices: { inserted: 0, skipped: 0 },
        offers: { inserted: 0, skipped: 0 },
        expenses: { inserted: 0, skipped: 0 },
        errors: [],
    };

    // 1. Optional Company profile import (when restoring backup)
    if (payload.company && typeof payload.company === "object" && payload.company.name) {
        const comp = payload.company;
        const currentIsSampleOrEmpty =
            !nextStore.company?.name ||
            nextStore.company.vat_id === "DE123456789" ||
            nextStore.company.name === "Muster Design Studio";

        if (currentIsSampleOrEmpty) {
            const updatedComp: Company = {
                ...nextStore.company,
                name: String(comp.name || ""),
                legal_form: String(comp.legal_form || nextStore.company?.legal_form || ""),
                address_line1: String(comp.address_line1 || ""),
                postal_code: String(comp.postal_code || ""),
                city: String(comp.city || ""),
                country: toDesktopCountryIso(String(comp.country || "DE")),
                email: String(comp.email || ""),
                phone: String(comp.phone || ""),
                vat_id: String(comp.vat_id || ""),
                tax_number: String(comp.tax_number || ""),
                bank_name: String(comp.bank_name || ""),
                bank_iban: String(comp.bank_iban || ""),
                bank_bic: String(comp.bank_bic || ""),
                payment_terms_default: String(
                    comp.payment_terms_default ||
                        nextStore.company?.payment_terms_default ||
                        "Zahlbar innerhalb von 14 Tagen ohne Abzug.",
                ),
                is_small_business: Boolean(comp.is_small_business),
                invoice_template: String(
                    comp.invoice_template || nextStore.company?.invoice_template || "classic",
                ),
            };
            nextStore.company = updatedComp;
            result.companyUpdated = true;
        }
    }

    // 2. Build existing client lookup maps
    if (!Array.isArray(nextStore.clients)) nextStore.clients = [];
    const clientByName = new Map<string, string>();
    const clientByEmail = new Map<string, string>();
    for (const c of nextStore.clients) {
        const nameKey = String(c.name || "").trim().toLowerCase();
        if (nameKey) clientByName.set(nameKey, c.id);
        const emailKey = String(c.email || "").trim().toLowerCase();
        if (emailKey) clientByEmail.set(emailKey, c.id);
    }

    // 3. Import Clients
    for (const c of Array.isArray(payload.clients) ? payload.clients : []) {
        if (!c?.name?.trim()) continue;
        const nameKey = c.name.trim().toLowerCase();
        const emailKey = (c.email || "").trim().toLowerCase();

        const existingId =
            (emailKey && clientByEmail.get(emailKey)) || clientByName.get(nameKey);

        if (existingId && skipDuplicates) {
            result.clients.skipped++;
            continue;
        }

        const newId = `client-${randomUUID()}`;
        const addr = [c.address_line1, c.address_line2]
            .map((s) => (s || "").trim())
            .filter((s) => s && s !== "—")
            .join(", ");

        const newClient: Client = {
            id: newId,
            name: c.name.trim(),
            contact_person: String(c.contact_person || ""),
            address_line1: addr,
            postal_code: c.postal_code && c.postal_code !== "00000" ? String(c.postal_code) : "",
            city: c.city && c.city !== "Unbekannt" ? String(c.city) : "",
            country: normalizeCountry(c.country),
            email: String(c.email || ""),
            phone: String(c.phone || ""),
            vat_id: String(c.vat_id || ""),
            tax_number: String(c.tax_number || ""),
            leitweg_id: String(c.leitweg_id || ""),
            created_at: Date.now(),
        };

        nextStore.clients.unshift(newClient);
        clientByName.set(nameKey, newId);
        if (emailKey) clientByEmail.set(emailKey, newId);
        result.clients.inserted++;
    }

    // 4. Import Products
    if (!Array.isArray(nextStore.products)) nextStore.products = [];
    const productByName = new Set<string>();
    for (const p of nextStore.products) {
        const k = String(p.name || "").trim().toLowerCase();
        if (k) productByName.add(k);
    }

    for (const p of Array.isArray(payload.products) ? payload.products : []) {
        if (!p?.name?.trim()) continue;
        const nameKey = p.name.trim().toLowerCase();
        if (productByName.has(nameKey) && skipDuplicates) {
            result.products.skipped++;
            continue;
        }

        const newProduct: Product = {
            id: `prod-${randomUUID()}`,
            name: p.name.trim(),
            description: String(p.description || ""),
            price: finiteNum(p.price, 0),
            tax_rate_percent: finiteNum(p.tax_rate_percent, 19),
            unit_of_measure: normalizeUnitOfMeasure(p.unit_of_measure),
        };
        nextStore.products.push(newProduct);
        productByName.add(nameKey);
        result.products.inserted++;
    }

    // Helper: Resolve or auto-create a Client so every Invoice/Offer has a valid `client_id`
    const resolveOrCreateClientId = (info: {
        name: string;
        email?: string;
        address_line1?: string;
        postal_code?: string;
        city?: string;
        country?: string;
        vat_id?: string;
        leitweg_id?: string;
    }): string => {
        const cleanName = (info.name || "Importierter Kunde").trim();
        const nameKey = cleanName.toLowerCase();
        const emailKey = (info.email || "").trim().toLowerCase();

        if (emailKey && clientByEmail.has(emailKey)) {
            return clientByEmail.get(emailKey)!;
        }
        if (clientByName.has(nameKey)) {
            return clientByName.get(nameKey)!;
        }

        const newId = `client-${randomUUID()}`;
        const autoClient: Client = {
            id: newId,
            name: cleanName,
            contact_person: "",
            address_line1: info.address_line1 && info.address_line1 !== "—" ? String(info.address_line1) : "",
            postal_code: info.postal_code && info.postal_code !== "00000" ? String(info.postal_code) : "",
            city: info.city && info.city !== "Unbekannt" ? String(info.city) : "",
            country: normalizeCountry(info.country),
            email: String(info.email || ""),
            phone: "",
            vat_id: String(info.vat_id || ""),
            tax_number: "",
            leitweg_id: String(info.leitweg_id || ""),
            created_at: Date.now(),
        };

        nextStore.clients.unshift(autoClient);
        clientByName.set(nameKey, newId);
        if (emailKey) clientByEmail.set(emailKey, newId);
        result.clients.inserted++;
        return newId;
    };

    // 5. Import Invoices
    if (!Array.isArray(nextStore.invoices)) nextStore.invoices = [];
    const existingInvoiceNumbers = new Set<string>();
    for (const inv of nextStore.invoices) {
        const k = String(inv.invoice_number || "").trim().toLowerCase();
        if (k) existingInvoiceNumbers.add(k);
    }

    for (const inv of Array.isArray(payload.invoices) ? payload.invoices : []) {
        if (!inv?.invoice_number?.trim()) continue;
        const invKey = inv.invoice_number.trim().toLowerCase();
        if (existingInvoiceNumbers.has(invKey) && skipDuplicates) {
            result.invoices.skipped++;
            continue;
        }

        const clientId = resolveOrCreateClientId({
            name: inv.client_name || "Importierter Kunde",
            email: inv.client_email,
            address_line1: inv.client_address,
            postal_code: inv.client_postal_code,
            city: inv.client_city,
            country: inv.client_country,
            vat_id: inv.client_vat_id,
            leitweg_id: inv.client_leitweg_id,
        });

        const issueDate = parseFlexibleDate(inv.issue_date);
        let dueDate = parseFlexibleDate(inv.due_date, addDaysToIsoDate(issueDate, 14));
        if (dueDate < issueDate) {
            dueDate = addDaysToIsoDate(issueDate, 14);
        }
        const deliveryDate = inv.delivery_date
            ? parseFlexibleDate(inv.delivery_date, issueDate)
            : issueDate;

        const rawItems =
            Array.isArray(inv.items) && inv.items.length > 0
                ? inv.items
                : [
                      {
                          description: `Rechnung ${inv.invoice_number}`,
                          quantity: 1,
                          unit_of_measure: "Pauschal",
                          price: finiteNum(inv.subtotal, 0),
                          tax_rate_percent: 19,
                          discount_percent: 0,
                          subtotal: finiteNum(inv.subtotal, 0),
                          tax_amount: finiteNum(inv.total_vat, 0),
                          total: finiteNum(inv.total_gross, 0),
                      },
                  ];

        const items: InvoiceItem[] = rawItems.map((it) => {
            const qty = Math.max(0.01, finiteNum(it.quantity, 1));
            const price = Math.max(0, finiteNum(it.price, 0));
            const tax = Math.min(100, Math.max(0, finiteNum(it.tax_rate_percent, 19)));
            const discount = Math.min(100, Math.max(0, finiteNum(it.discount_percent, 0)));
            const total = round2(qty * price * (1 - discount / 100));
            return {
                description: String(it.description || "Position").trim(),
                quantity: qty,
                unit_of_measure: normalizeUnitOfMeasure(it.unit_of_measure),
                price,
                tax_rate_percent: tax,
                discount_percent: discount,
                total,
            };
        });

        const newInvoice: Invoice = {
            id: `inv-${randomUUID()}`,
            invoice_number: inv.invoice_number.trim(),
            client_id: clientId,
            issue_date: issueDate,
            due_date: dueDate,
            delivery_date: deliveryDate,
            status: toDesktopInvoiceStatus(inv.status),
            notes: String(inv.notes || ""),
            payment_terms: String(inv.payment_terms || ""),
            items,
            subtotal: finiteNum(inv.subtotal, 0),
            total_vat: finiteNum(inv.total_vat, 0),
            total_gross: finiteNum(inv.total_gross, 0),
            created_at: Date.now(),
            updated_at: Date.now(),
        };

        nextStore.invoices.unshift(newInvoice);
        existingInvoiceNumbers.add(invKey);
        result.invoices.inserted++;
    }

    // 6. Import Offers (from full backup)
    if (!Array.isArray(nextStore.offers)) nextStore.offers = [];
    const existingOfferNumbers = new Set<string>();
    for (const off of nextStore.offers) {
        const k = String(off.offer_number || "").trim().toLowerCase();
        if (k) existingOfferNumbers.add(k);
    }

    for (const off of Array.isArray(payload.offers) ? payload.offers : []) {
        if (!off?.offer_number?.trim()) continue;
        const offKey = off.offer_number.trim().toLowerCase();
        if (existingOfferNumbers.has(offKey) && skipDuplicates) {
            result.offers.skipped++;
            continue;
        }

        const clientId = resolveOrCreateClientId({
            name: off.client_name || "Importierter Kunde",
            email: off.client_email,
        });

        const issueDate = parseFlexibleDate(off.issue_date);
        const validUntil = parseFlexibleDate(
            off.valid_until,
            addDaysToIsoDate(issueDate, 30),
        );

        const items: InvoiceItem[] = (Array.isArray(off.items) ? off.items : []).map(
            (it) => {
                const qty = Math.max(0.01, finiteNum(it.quantity, 1));
                const price = Math.max(0, finiteNum(it.price, 0));
                const tax = Math.min(100, Math.max(0, finiteNum(it.tax_rate_percent, 19)));
                const discount = Math.min(
                    100,
                    Math.max(0, finiteNum(it.discount_percent, 0)),
                );
                const total = round2(qty * price * (1 - discount / 100));
                return {
                    description: String(it.description || "Position").trim(),
                    quantity: qty,
                    unit_of_measure: normalizeUnitOfMeasure(it.unit_of_measure),
                    price,
                    tax_rate_percent: tax,
                    discount_percent: discount,
                    total,
                };
            },
        );

        const newOffer: Offer = {
            id: `off-${randomUUID()}`,
            offer_number: off.offer_number.trim(),
            issue_date: issueDate,
            valid_until: validUntil,
            client_id: clientId,
            status: String(off.status || "draft"),
            items,
            subtotal: finiteNum(off.subtotal, 0),
            total_vat: finiteNum(off.total_vat, 0),
            total_gross: finiteNum(off.total_gross, 0),
            notes: String(off.notes || ""),
            payment_terms: String(off.payment_terms || ""),
            created_at: Date.now(),
        };

        nextStore.offers.unshift(newOffer);
        existingOfferNumbers.add(offKey);
        result.offers.inserted++;
    }

    // 7. Import Expenses
    if (!Array.isArray(nextStore.expenses)) nextStore.expenses = [];
    const existingExpenseFingerprints = new Set<string>();
    for (const e of nextStore.expenses) {
        const fp = `${String(e.vendor_name || "").toLowerCase()}|${String(e.date || "").slice(0, 10)}|${finiteNum(e.amount_gross, 0).toFixed(2)}`;
        existingExpenseFingerprints.add(fp);
    }

    for (const exp of Array.isArray(payload.expenses) ? payload.expenses : []) {
        if (!exp?.vendor_name?.trim()) continue;
        const date = parseFlexibleDate(exp.date);
        const gross = finiteNum(exp.amount_gross, 0);
        const fp = `${exp.vendor_name.trim().toLowerCase()}|${date}|${gross.toFixed(2)}`;

        if (existingExpenseFingerprints.has(fp) && skipDuplicates) {
            result.expenses.skipped++;
            continue;
        }

        const newExpense: Expense = {
            id: `exp-${randomUUID()}`,
            vendor_name: exp.vendor_name.trim(),
            category: String(exp.category || "other"),
            amount_gross: gross,
            vat_rate: finiteNum(exp.vat_rate_percent, 19),
            date,
            description: String(exp.description || exp.vendor_name || "Ausgabe").trim(),
        };

        nextStore.expenses.unshift(newExpense);
        existingExpenseFingerprints.add(fp);
        result.expenses.inserted++;
    }

    return { result, updatedStore: nextStore };
}
