/**
 * Shared data model for the Rechly SQLite store and portable backups.
 * Most fields are optional because historical records are partial and
 * records are created from partial form data in the renderer.
 */

export interface Company {
    name?: string;
    legal_form?: string;
    address_line1?: string;
    postal_code?: string;
    city?: string;
    country?: string;
    email?: string;
    phone?: string;
    vat_id?: string;
    tax_number?: string;
    bank_name?: string;
    bank_iban?: string;
    bank_bic?: string;
    payment_terms_default?: string;
    is_small_business?: boolean;
    invoice_template?: string;
}

export interface InvoiceItem {
    id?: string;
    description: string;
    quantity: number;
    unit_of_measure?: string;
    price: number;
    tax_rate_percent?: number;
    discount_percent?: number;
    total?: number;
}

export interface Invoice {
    project_id?: string;
    id: string;
    invoice_number?: string;
    client_id?: string | null;
    issue_date?: string;
    due_date?: string;
    delivery_date?: string;
    status?: string;
    notes?: string;
    payment_terms?: string;
    items?: InvoiceItem[];
    subtotal?: number;
    total_vat?: number;
    total_gross?: number;
    created_at?: number;
    updated_at?: number;
}

export interface Client {
    id: string;
    name?: string;
    contact_person?: string;
    address_line1?: string;
    postal_code?: string;
    city?: string;
    country?: string;
    email?: string;
    phone?: string;
    vat_id?: string;
    tax_number?: string;
    leitweg_id?: string;
    created_at?: number;
}

export interface Product {
    id: string;
    name?: string;
    description?: string;
    price?: number;
    tax_rate_percent?: number;
    unit_of_measure?: string;
}

export interface Offer {
    id: string;
    offer_number?: string;
    issue_date?: string;
    valid_until?: string;
    client_id?: string | null;
    status?: string;
    items?: InvoiceItem[];
    subtotal?: number;
    total_vat?: number;
    total_gross?: number;
    notes?: string;
    payment_terms?: string;
    created_at?: number;
}

export interface Expense {
    project_id?: string;
    id: string;
    vendor_name?: string;
    category?: string;
    amount_gross?: number;
    vat_rate?: number;
    date?: string;
    description?: string;
}

export type AiProvider = "ollama" | "openai" | "anthropic";

export type ModelTierId = "3b" | "1.5b" | "0.5b";

export interface ModelTier {
    id: "3b" | "1.5b" | "0.5b";
    name: string;
    tag: string;
    modelIdentifier: string; // Ollama pull identifier
    paramSize: string;
    downloadSize: string;
    ramRequired: string;
    badge: string;
    description: string;
    recommendedFor: string;
    hfUrl: string;
    minRamGb: number;
}

export const RECHLY_MODEL_FAMILY: Record<ModelTierId, ModelTier> = {
    "3b": {
        id: "3b",
        name: "Rechly-DE-3B (Flagship)",
        tag: "Flagship",
        modelIdentifier: "jonprompter/rechly-de-3b",
        paramSize: "3B Parameter",
        downloadSize: "1.93 GB",
        ramRequired: "~2.5 GB RAM",
        badge: "Maximale Präzision (100% Benchmark)",
        description: "Vollständige deutsche Steuer- & GoBD-Prüfung, komplexe XRechnung/ZUGFeRD-Parsing-Fälle und DATEV-Kontierung.",
        recommendedFor: "Apple Silicon (M1–M4), Workstations, PCs mit ≥ 8 GB RAM",
        hfUrl: "https://huggingface.co/jonprompter/rechly-de-3b",
        minRamGb: 8,
    },
    "1.5b": {
        id: "1.5b",
        name: "Rechly-DE-1.5B (Slim)",
        tag: "Slim",
        modelIdentifier: "jonprompter/rechly-de-1.5b",
        paramSize: "1.5B Parameter",
        downloadSize: "986 MB",
        ramRequired: "~1.1 GB RAM",
        badge: "Ausgewogen & Schnell",
        description: "Optimiert für Standard-Rechnungen, UStG-Pflichtangaben und DATEV SKR03/04 Kontierung.",
        recommendedFor: "Laptops, Intel MacBooks, PCs mit 4–8 GB RAM, 1 GB VPS",
        hfUrl: "https://huggingface.co/jonprompter/rechly-de-1.5b",
        minRamGb: 4,
    },
    "0.5b": {
        id: "0.5b",
        name: "Rechly-DE-0.5B (Nano)",
        tag: "Nano",
        modelIdentifier: "jonprompter/rechly-de-0.5b",
        paramSize: "0.5B Parameter",
        downloadSize: "398 MB",
        ramRequired: "~512 MB RAM",
        badge: "Ultra-Leicht & Sparsam",
        description: "Extrem sparsam im Arbeitsspeicher, blitzschnelle Antwortzeiten für Basis-Rechnungserfassung.",
        recommendedFor: "Ältere Geräte, Thin Clients, Micro-Instanzen, RAM < 4 GB",
        hfUrl: "https://huggingface.co/jonprompter/rechly-de-0.5b",
        minRamGb: 2,
    },
};

export interface SystemProfile {
    totalRamGb: number;
    arch: string;
    platform: string;
    cpuModel: string;
    isAppleSilicon: boolean;
    recommendedTier: "3b" | "1.5b" | "0.5b";
    recommendationReason: string;
}

export interface AiSettings {
    active_provider: AiProvider;
    ollama_host: string;
    ollama_model: string;
    selected_tier?: "3b" | "1.5b" | "0.5b";
    openai_key: string;
    openai_model: string;
    anthropic_key: string;
    anthropic_model: string;
    featured_model: string;
    ollama_url: string;
    hf_url: string;
}

export interface OllamaStatus {
    connected: boolean;
    models?: string[];
    installedTiers: Record<"3b" | "1.5b" | "0.5b", boolean>;
    activeTier?: "3b" | "1.5b" | "0.5b";
    hasFeaturedModel?: boolean;
    featuredModelName?: string;
    ollamaUrl?: string;
    hfUrl?: string;
    error?: string;
}

export interface OnboardingState {
    completed_at: string;
    /** When the user acknowledged local storage and their backup duty. */
    storage_consent_at: string;
    /** Whether the user opted in to cloud AI providers during setup. */
    cloud_ai_opt_in: boolean;
}

export interface StoreData {
    timeEntries?: import("./worklog").TimeEntry[];
    runningTimer?: import("./worklog").RunningTimer | null;
    calendar?: import("./calendar").CalendarEvent[];
    calendarReminders?: string[];
    business?: import("./business").BusinessData;
    version: number;
    initialized_at: string;
    company: Company;
    invoices: Invoice[];
    clients: Client[];
    products: Product[];
    offers: Offer[];
    expenses: Expense[];
    aiSettings: AiSettings;
    /** Missing until the first-run setup assistant has been completed. */
    onboarding?: OnboardingState;
}

export interface CompleteOnboardingRequest {
    cloud_ai_opt_in: boolean;
    remove_sample_data: boolean;
}

export interface AppInfo {
    version: string;
    platform: NodeJS.Platform;
    vaultPath: string;
}

export interface OllamaInstallInfo {
    installed: boolean;
    /** App bundle / executable that can be launched to start the server. */
    launchPath: string | null;
}

export interface OllamaPullProgress {
    status: string;
    completed?: number;
    total?: number;
    percent?: number;
}

/** Fields the renderer may send when creating or updating a record. */
export type Draft<T extends { id: string }> = Omit<Partial<T>, "id">;

export interface ExportResult {
    success: boolean;
    filePath?: string;
    error?: string;
}

export interface AppUpdateInfo {
    available: boolean;
    currentVersion: string;
    latestVersion?: string;
    releaseName?: string;
    releaseNotes?: string;
    releaseDate?: string;
    releaseUrl?: string;
    downloadUrl?: string;
    error?: string;
}

export interface AppUpdateProgress {
    percent: number;
    bytesPerSecond: number;
    transferred: number;
    total: number;
}
