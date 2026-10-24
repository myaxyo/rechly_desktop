import { app } from "electron";
import * as path from "node:path";
import * as fs from "node:fs";
import type { AiSettings, StoreData } from "./types";

/**
 * Rechly Desktop Offline Store
 * Single-file atomic JSON vault stored in OS application data directory:
 * - macOS:   ~/Library/Application Support/Rechly/rechly_vault.json
 * - Windows: %APPDATA%/Rechly/rechly_vault.json
 * - Linux:   ~/.config/Rechly/rechly_vault.json
 */

const getStorePath = (): string => {
    const userDataPath = app.getPath("userData");
    if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
    }
    return path.join(userDataPath, "rechly_vault.json");
};

const getBackupPath = (): string => {
    return path.join(app.getPath("userData"), "rechly_vault.backup.json");
};

const getDefaultStore = (): StoreData => ({
    version: 1,
    initialized_at: new Date().toISOString(),
    company: {
        name: "Meine Firma",
        legal_form: "Einzelunternehmen",
        address_line1: "Musterstraße 123",
        postal_code: "10115",
        city: "Berlin",
        country: "DE",
        email: "kontakt@meinefirma.de",
        phone: "+49 30 12345678",
        vat_id: "DE123456789",
        tax_number: "21/123/45678",
        bank_name: "Berliner Sparkasse",
        bank_iban: "DE89370501981234567890",
        bank_bic: "BELADEB1XXX",
        payment_terms_default: "Zahlbar innerhalb von 14 Tagen ohne Abzug.",
        is_small_business: false,
        invoice_template: "classic",
    },
    invoices: [
        {
            id: "inv-sample-1",
            invoice_number: "RE-2026-001",
            client_id: "client-sample-1",
            issue_date: new Date().toISOString().slice(0, 10),
            due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
            status: "sent",
            notes: "Vielen Dank für Ihren Auftrag und die angenehme Zusammenarbeit.",
            payment_terms: "Zahlbar innerhalb von 14 Tagen ohne Abzug.",
            items: [
                {
                    id: "item-1",
                    description: "Strategische Beratung & Projektmanagement",
                    quantity: 8,
                    unit_of_measure: "Stunde",
                    price: 110,
                    tax_rate_percent: 19,
                    discount_percent: 0,
                    total: 880,
                },
                {
                    id: "item-2",
                    description: "Setup Webplattform & Hosting-Bereitstellung",
                    quantity: 1,
                    unit_of_measure: "Pauschal",
                    price: 350,
                    tax_rate_percent: 19,
                    discount_percent: 0,
                    total: 350,
                },
            ],
            subtotal: 1230,
            total_vat: 233.7,
            total_gross: 1463.7,
            created_at: Date.now() - 86400000,
        },
    ],
    clients: [
        {
            id: "client-sample-1",
            name: "Müller & Partner GmbH",
            contact_person: "Herr Dr. Thomas Müller",
            address_line1: "Friedrichstraße 45",
            postal_code: "10117",
            city: "Berlin",
            country: "DE",
            email: "rechnung@mueller-partner.de",
            phone: "+49 30 98765432",
            vat_id: "DE987654321",
            tax_number: "21/876/54321",
            leitweg_id: "04011000-12345-12",
            created_at: Date.now() - 86400000 * 2,
        },
    ],
    products: [
        {
            id: "prod-1",
            name: "Beratung / Consulting",
            description: "Fachliche Beratung pro Stunde",
            price: 110,
            tax_rate_percent: 19,
            unit_of_measure: "Stunde",
        },
        {
            id: "prod-2",
            name: "Entwicklung & Design",
            description: "Technische Umsetzung",
            price: 95,
            tax_rate_percent: 19,
            unit_of_measure: "Stunde",
        },
        {
            id: "prod-3",
            name: "Wartungspauschale",
            description: "Monatlicher Support und Backups",
            price: 180,
            tax_rate_percent: 19,
            unit_of_measure: "Monat",
        },
    ],
    offers: [],
    expenses: [
        {
            id: "exp-1",
            vendor_name: "Telekom Deutschland",
            category: "Telefon & Internet",
            amount_gross: 49.9,
            vat_rate: 19,
            date: new Date().toISOString().slice(0, 10),
            description: "Büro-Internetanschluss",
        },
    ],
    aiSettings: {
        active_provider: "ollama",
        ollama_host: "http://localhost:11434",
        ollama_model: "jonprompter/Rechly-DE-3B",
        openai_key: "",
        openai_model: "gpt-4o-mini",
        anthropic_key: "",
        anthropic_model: "claude-3-5-sonnet-20241022",
        featured_model: "jonprompter/Rechly-DE-3B",
        ollama_url: "https://ollama.com/jonprompter/Rechly-DE-3B",
        hf_url: "https://huggingface.co/jonprompter/rechly-de-3b",
    },
});

class OfflineStore {
    private data: StoreData | null = null;

    constructor() {
        this.load();
    }

    load(): void {
        const filePath = getStorePath();
        try {
            if (fs.existsSync(filePath)) {
                const raw = fs.readFileSync(filePath, "utf8");
                this.data = JSON.parse(raw) as StoreData;
            } else {
                this.data = getDefaultStore();
                this.save();
            }
        } catch (err) {
            console.error("Failed to load store, loading backup:", err);
            const backup = getBackupPath();
            if (fs.existsSync(backup)) {
                this.data = JSON.parse(fs.readFileSync(backup, "utf8")) as StoreData;
            } else {
                this.data = getDefaultStore();
            }
        }
    }

    save(): boolean {
        const filePath = getStorePath();
        const backup = getBackupPath();
        try {
            const raw = JSON.stringify(this.data, null, 2);
            // Write to backup first for safety
            if (fs.existsSync(filePath)) {
                fs.copyFileSync(filePath, backup);
            }
            fs.writeFileSync(filePath, raw, "utf8");
            return true;
        } catch (err) {
            console.error("Failed to save store:", err);
            return false;
        }
    }

    getVaultPath(): string {
        return getStorePath();
    }

    get<K extends keyof StoreData>(key: K): StoreData[K] | null {
        return this.data ? this.data[key] : null;
    }

    set<K extends keyof StoreData>(key: K, value: StoreData[K]): boolean {
        if (!this.data) this.data = getDefaultStore();
        this.data[key] = value;
        return this.save();
    }

    getAll(): StoreData {
        if (!this.data) this.data = getDefaultStore();
        if (!this.data.aiSettings) {
            this.data.aiSettings = getDefaultStore().aiSettings;
        }
        return this.data;
    }

    getAiSettings(): AiSettings {
        if (!this.data) this.data = getDefaultStore();
        if (!this.data.aiSettings) {
            this.data.aiSettings = getDefaultStore().aiSettings;
        }
        return this.data.aiSettings;
    }

    saveAiSettings(settings: Partial<AiSettings>): AiSettings {
        if (!this.data) this.data = getDefaultStore();
        this.data.aiSettings = { ...this.getAiSettings(), ...settings };
        this.save();
        return this.data.aiSettings;
    }

    // Backup & Restore
    exportBackup(targetPath: string): boolean {
        const raw = JSON.stringify(this.data, null, 2);
        fs.writeFileSync(targetPath, raw, "utf8");
        return true;
    }

    importBackup(sourcePath: string): boolean {
        const raw = fs.readFileSync(sourcePath, "utf8");
        const parsed = JSON.parse(raw) as Partial<StoreData>;
        if (!parsed.company || !Array.isArray(parsed.invoices)) {
            throw new Error("Ungültiges Rechly-Backup-Format");
        }
        this.data = parsed as StoreData;
        this.save();
        return true;
    }
}

const store = new OfflineStore();
export default store;
