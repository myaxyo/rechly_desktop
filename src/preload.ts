import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type {
    AiSettings,
    Client,
    Company,
    Draft,
    Expense,
    CompleteOnboardingRequest,
    Invoice,
    Offer,
    OllamaPullProgress,
    Product,
} from "./types";

const api = {
    isDesktop: true,
    platform: process.platform,

    // Store & Data
    getStore: () => ipcRenderer.invoke("store:get"),
    getCompany: () => ipcRenderer.invoke("company:get"),
    saveCompany: (data: Company) => ipcRenderer.invoke("company:save", data),

    // Invoices
    getInvoices: () => ipcRenderer.invoke("invoices:getAll"),
    createInvoice: (data: Draft<Invoice>) => ipcRenderer.invoke("invoices:create", data),
    updateInvoice: (id: string, data: Draft<Invoice>) =>
        ipcRenderer.invoke("invoices:update", id, data),
    deleteInvoice: (id: string) => ipcRenderer.invoke("invoices:delete", id),

    // Clients
    getClients: () => ipcRenderer.invoke("clients:getAll"),
    createClient: (data: Draft<Client>) => ipcRenderer.invoke("clients:create", data),
    updateClient: (id: string, data: Draft<Client>) =>
        ipcRenderer.invoke("clients:update", id, data),
    deleteClient: (id: string) => ipcRenderer.invoke("clients:delete", id),

    // Products
    getProducts: () => ipcRenderer.invoke("products:getAll"),
    createProduct: (data: Draft<Product>) => ipcRenderer.invoke("products:create", data),
    updateProduct: (id: string, data: Draft<Product>) =>
        ipcRenderer.invoke("products:update", id, data),
    deleteProduct: (id: string) => ipcRenderer.invoke("products:delete", id),

    // Offers
    getOffers: () => ipcRenderer.invoke("offers:getAll"),
    createOffer: (data: Draft<Offer>) => ipcRenderer.invoke("offers:create", data),
    updateOffer: (id: string, data: Draft<Offer>) =>
        ipcRenderer.invoke("offers:update", id, data),
    convertOffer: (id: string) => ipcRenderer.invoke("offers:convert", id),
    deleteOffer: (id: string) => ipcRenderer.invoke("offers:delete", id),

    // Expenses
    getExpenses: () => ipcRenderer.invoke("expenses:getAll"),
    createExpense: (data: Draft<Expense>) => ipcRenderer.invoke("expenses:create", data),
    updateExpense: (id: string, data: Draft<Expense>) =>
        ipcRenderer.invoke("expenses:update", id, data),
    deleteExpense: (id: string) => ipcRenderer.invoke("expenses:delete", id),

    // AI & Integrations (Ollama, OpenAI, Claude)
    getAiSettings: () => ipcRenderer.invoke("ai:getSettings"),
    saveAiSettings: (settings: Partial<AiSettings>) =>
        ipcRenderer.invoke("ai:saveSettings", settings),
    checkOllama: (host?: string) => ipcRenderer.invoke("ai:checkOllama", host),
    testOpenAi: (key: string, model?: string) => ipcRenderer.invoke("ai:testOpenAi", key, model),
    testAnthropic: (key: string, model?: string) =>
        ipcRenderer.invoke("ai:testAnthropic", key, model),
    parseInvoiceDraft: (
        prompt: string,
        clients: Pick<Client, "id" | "name">[],
        isSmallBusiness: boolean
    ) => ipcRenderer.invoke("ai:parseDraft", prompt, clients, isSmallBusiness),

    // First-run setup assistant
    getAppInfo: () => ipcRenderer.invoke("app:getInfo"),
    detectOllama: () => ipcRenderer.invoke("setup:detectOllama"),
    launchOllama: () => ipcRenderer.invoke("setup:launchOllama"),
    pullModel: (host?: string, model?: string) => ipcRenderer.invoke("ai:pullModel", host, model),
    onPullProgress: (callback: (progress: OllamaPullProgress) => void) => {
        const listener = (_e: IpcRendererEvent, progress: OllamaPullProgress) => callback(progress);
        ipcRenderer.on("ai:pullProgress", listener);
        return () => {
            ipcRenderer.removeListener("ai:pullProgress", listener);
        };
    },
    completeOnboarding: (req: CompleteOnboardingRequest) => ipcRenderer.invoke("onboarding:complete", req),
    setCloudAiOptIn: (allowed: boolean) => ipcRenderer.invoke("onboarding:setCloudOptIn", allowed),

    // Native Export Dialogs
    exportPdf: (invoiceId: string) => ipcRenderer.invoke("export:pdf", invoiceId),
    exportXRechnung: (invoiceId: string) => ipcRenderer.invoke("export:xrechnung", invoiceId),
    exportDatev: () => ipcRenderer.invoke("export:datev"),
    printPage: () => ipcRenderer.invoke("native:print"),

    // Backup & Restore
    exportBackup: () => ipcRenderer.invoke("backup:export"),
    importBackup: () => ipcRenderer.invoke("backup:import"),
};

/** Type of `window.rechly` in the renderer. */
export type RechlyApi = typeof api;

contextBridge.exposeInMainWorld("rechly", api);
