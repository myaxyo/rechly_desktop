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

export interface AiSettings {
    active_provider: AiProvider;
    ollama_host: string;
    ollama_model: string;
    openai_key: string;
    openai_model: string;
    anthropic_key: string;
    anthropic_model: string;
    featured_model: string;
    ollama_url: string;
    hf_url: string;
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
}

/** Fields the renderer may send when creating or updating a record. */
export type Draft<T extends { id: string }> = Omit<Partial<T>, "id">;

export interface ExportResult {
    success: boolean;
    filePath?: string;
    error?: string;
}
