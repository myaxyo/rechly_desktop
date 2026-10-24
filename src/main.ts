import {
    app,
    BrowserWindow,
    Menu,
    dialog,
    shell,
    ipcMain,
    type MenuItemConstructorOptions,
} from "electron";
import * as path from "node:path";
import * as fs from "node:fs";

import store from "./store";
import { generateXRechnungXML, generateDatevExport } from "./eRechnung";
import { checkOllama, testOpenAi, testAnthropic, parseInvoiceDraft, pullOllamaModel } from "./ai";
import { detectOllama, launchOllama } from "./setup";
import type {
    AiSettings,
    AppInfo,
    Client,
    Company,
    CompleteOnboardingRequest,
    Draft,
    Expense,
    ExportResult,
    Invoice,
    OnboardingState,
    Offer,
    Product,
} from "./types";

/** Records created by the default vault so first-time users can try the app. */
const SAMPLE_IDS = {
    invoices: ["inv-sample-1"],
    clients: ["client-sample-1"],
    expenses: ["exp-1"],
};

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1320,
        height: 880,
        minWidth: 980,
        minHeight: 650,
        title: "Rechly Desktop",
        titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
        trafficLightPosition: { x: 16, y: 16 },
        backgroundColor: "#f8fafc",
        show: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    // Load local offline desktop UI (compiled code lives in out/, UI in ui/)
    mainWindow.loadFile(path.join(__dirname, "..", "ui", "index.html"));

    mainWindow.once("ready-to-show", () => {
        mainWindow?.show();
    });

    mainWindow.on("closed", () => {
        mainWindow = null;
    });

    // Open external links in user default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
    });
};

// ─── Native Menus ─────────────────────────────────────────────────────────────

const buildMenu = () => {
    const isMac = process.platform === "darwin";
    const macAppMenu: MenuItemConstructorOptions[] = isMac
        ? [
              {
                  label: "Rechly",
                  submenu: [
                      { role: "about", label: "Über Rechly Desktop" },
                      { type: "separator" },
                      { role: "hide", label: "Ausblenden" },
                      { role: "hideOthers", label: "Andere ausblenden" },
                      { role: "unhide", label: "Alle einblenden" },
                      { type: "separator" },
                      { role: "quit", label: "Rechly beenden" },
                  ],
              },
          ]
        : [];
    const template: MenuItemConstructorOptions[] = [
        ...macAppMenu,
        {
            label: "Datei",
            submenu: [
                {
                    label: "Neue Rechnung",
                    accelerator: "CmdOrCtrl+N",
                    click: () => mainWindow?.webContents.send("nav:new-invoice"),
                },
                {
                    label: "Drucken",
                    accelerator: "CmdOrCtrl+P",
                    click: () => mainWindow?.webContents.print(),
                },
                { type: "separator" },
                {
                    label: "DATEV Export erstellen…",
                    click: async () => exportDatevHandler(),
                },
                {
                    label: "Datenbank sichern (Backup)…",
                    click: async () => exportBackupHandler(),
                },
                { type: "separator" },
                isMac ? { role: "close", label: "Fenster schließen" } : { role: "quit", label: "Beenden" },
            ],
        },
        {
            label: "Bearbeiten",
            submenu: [
                { role: "undo", label: "Rückgängig" },
                { role: "redo", label: "Wiederholen" },
                { type: "separator" },
                { role: "cut", label: "Ausschneiden" },
                { role: "copy", label: "Kopieren" },
                { role: "paste", label: "Einfügen" },
                { role: "selectAll", label: "Alles auswählen" },
            ],
        },
        {
            label: "Ansicht",
            submenu: [
                { role: "reload", label: "Neu laden", accelerator: "CmdOrCtrl+R" },
                { role: "forceReload", label: "Neu laden erzwingen", accelerator: "CmdOrCtrl+Shift+R" },
                { role: "toggleDevTools", label: "Entwicklertools (DevTools)", accelerator: "CmdOrCtrl+Alt+I" },
                { type: "separator" },
                { role: "resetZoom", label: "Normalgröße" },
                { role: "zoomIn", label: "Vergrößern" },
                { role: "zoomOut", label: "Verkleinern" },
                { type: "separator" },
                { role: "togglefullscreen", label: "Vollbild" },
            ],
        },
        {
            label: "Hilfe",
            submenu: [
                {
                    label: "jonprompter/Rechly-DE-3B auf Ollama",
                    click: () => shell.openExternal("https://ollama.com/jonprompter/Rechly-DE-3B"),
                },
                {
                    label: "jonprompter/rechly-de-3b auf Hugging Face",
                    click: () => shell.openExternal("https://huggingface.co/jonprompter/rechly-de-3b"),
                },
                { type: "separator" },
                {
                    label: "Rechly Web Plattform",
                    click: () => shell.openExternal("https://rechly.de"),
                },
            ],
        },
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

// ─── Export Helpers ──────────────────────────────────────────────────────────

async function exportDatevHandler(): Promise<ExportResult> {
    if (!mainWindow) return { success: false };
    const invoices = store.get("invoices") || [];
    const company: Company = store.get("company") || {};

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: "DATEV Buchungsstapel exportieren",
        defaultPath: `EXTF_DATEV_Buchungen_${new Date().toISOString().slice(0, 10)}.csv`,
        filters: [{ name: "CSV / DATEV", extensions: ["csv", "txt"] }],
    });

    if (canceled || !filePath) return { success: false };

    const csvContent = generateDatevExport(invoices, company);
    fs.writeFileSync(filePath, csvContent, "latin1"); // DATEV standard encoding
    shell.showItemInFolder(filePath);
    return { success: true, filePath };
}

async function exportBackupHandler(): Promise<ExportResult> {
    if (!mainWindow) return { success: false };
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: "Rechly Offline Tresor sichern",
        defaultPath: `Rechly_Backup_${new Date().toISOString().slice(0, 10)}.rechly-backup`,
        filters: [{ name: "Rechly Backup", extensions: ["rechly-backup", "json"] }],
    });

    if (canceled || !filePath) return { success: false };

    store.exportBackup(filePath);
    shell.showItemInFolder(filePath);
    return { success: true, filePath };
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

ipcMain.handle("store:get", () => store.getAll());
ipcMain.handle("company:get", () => store.get("company"));
ipcMain.handle("company:save", (_e, data: Company) => {
    store.set("company", data);
    return true;
});

// Invoices
ipcMain.handle("invoices:getAll", () => store.get("invoices") || []);
ipcMain.handle("invoices:create", (_e, data: Draft<Invoice>) => {
    const invoices = store.get("invoices") || [];
    const newInvoice: Invoice = {
        id: `inv-${Date.now()}`,
        created_at: Date.now(),
        ...data,
    };
    invoices.unshift(newInvoice);
    store.set("invoices", invoices);
    return newInvoice;
});
ipcMain.handle("invoices:update", (_e, id: string, data: Draft<Invoice>) => {
    const invoices = store.get("invoices") || [];
    const idx = invoices.findIndex((i) => i.id === id);
    if (idx !== -1) {
        invoices[idx] = { ...invoices[idx], ...data, updated_at: Date.now() };
        store.set("invoices", invoices);
        return invoices[idx];
    }
    return null;
});
ipcMain.handle("invoices:delete", (_e, id: string) => {
    let invoices = store.get("invoices") || [];
    invoices = invoices.filter((i) => i.id !== id);
    store.set("invoices", invoices);
    return true;
});

// Clients
ipcMain.handle("clients:getAll", () => store.get("clients") || []);
ipcMain.handle("clients:create", (_e, data: Draft<Client>) => {
    const clients = store.get("clients") || [];
    const newClient: Client = {
        id: `client-${Date.now()}`,
        created_at: Date.now(),
        ...data,
    };
    clients.unshift(newClient);
    store.set("clients", clients);
    return newClient;
});
ipcMain.handle("clients:update", (_e, id: string, data: Draft<Client>) => {
    const clients = store.get("clients") || [];
    const idx = clients.findIndex((c) => c.id === id);
    if (idx !== -1) {
        clients[idx] = { ...clients[idx], ...data };
        store.set("clients", clients);
        return clients[idx];
    }
    return null;
});
ipcMain.handle("clients:delete", (_e, id: string) => {
    let clients = store.get("clients") || [];
    clients = clients.filter((c) => c.id !== id);
    store.set("clients", clients);
    return true;
});

// Products
ipcMain.handle("products:getAll", () => store.get("products") || []);
ipcMain.handle("products:create", (_e, data: Draft<Product>) => {
    const products = store.get("products") || [];
    const newProduct: Product = {
        id: `prod-${Date.now()}`,
        ...data,
    };
    products.push(newProduct);
    store.set("products", products);
    return newProduct;
});
ipcMain.handle("products:update", (_e, id: string, data: Draft<Product>) => {
    const products = store.get("products") || [];
    const idx = products.findIndex((p) => p.id === id);
    if (idx !== -1) {
        products[idx] = { ...products[idx], ...data };
        store.set("products", products);
        return products[idx];
    }
    return null;
});
ipcMain.handle("products:delete", (_e, id: string) => {
    let products = store.get("products") || [];
    products = products.filter((p) => p.id !== id);
    store.set("products", products);
    return true;
});

// Offers
ipcMain.handle("offers:getAll", () => store.get("offers") || []);
ipcMain.handle("offers:create", (_e, data: Draft<Offer>) => {
    const offers = store.get("offers") || [];
    const newOffer: Offer = { id: `off-${Date.now()}`, created_at: Date.now(), ...data };
    offers.unshift(newOffer);
    store.set("offers", offers);
    return newOffer;
});
ipcMain.handle("offers:update", (_e, id: string, data: Draft<Offer>) => {
    const offers = store.get("offers") || [];
    const idx = offers.findIndex((o) => o.id === id);
    if (idx !== -1) {
        offers[idx] = { ...offers[idx], ...data };
        store.set("offers", offers);
        return offers[idx];
    }
    return null;
});
ipcMain.handle("offers:delete", (_e, id: string) => {
    store.set("offers", (store.get("offers") || []).filter((o) => o.id !== id));
    return true;
});
ipcMain.handle("offers:convert", (_e, id: string) => {
    const offers = store.get("offers") || [];
    const offer = offers.find((o) => o.id === id);
    if (!offer) return null;

    const invoices = store.get("invoices") || [];
    const newInvoice: Invoice = {
        id: `inv-${Date.now()}`,
        invoice_number: `RE-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        client_id: offer.client_id,
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        status: "draft",
        items: offer.items || [],
        subtotal: offer.subtotal || 0,
        total_vat: offer.total_vat || 0,
        total_gross: offer.total_gross || 0,
        notes: offer.notes || "",
        payment_terms: offer.payment_terms || "",
        created_at: Date.now(),
    };
    invoices.unshift(newInvoice);
    store.set("invoices", invoices);

    offer.status = "converted";
    store.set("offers", offers);
    return newInvoice;
});

// Expenses
ipcMain.handle("expenses:getAll", () => store.get("expenses") || []);
ipcMain.handle("expenses:create", (_e, data: Draft<Expense>) => {
    const expenses = store.get("expenses") || [];
    const newExpense: Expense = { id: `exp-${Date.now()}`, ...data };
    expenses.unshift(newExpense);
    store.set("expenses", expenses);
    return newExpense;
});
ipcMain.handle("expenses:update", (_e, id: string, data: Draft<Expense>) => {
    const expenses = store.get("expenses") || [];
    const idx = expenses.findIndex((e) => e.id === id);
    if (idx !== -1) {
        expenses[idx] = { ...expenses[idx], ...data };
        store.set("expenses", expenses);
        return expenses[idx];
    }
    return null;
});
ipcMain.handle("expenses:delete", (_e, id: string) => {
    let expenses = store.get("expenses") || [];
    expenses = expenses.filter((e) => e.id !== id);
    store.set("expenses", expenses);
    return true;
});

// AI & Cloud Integration (Local Ollama & Cloud OpenAI / Anthropic Claude)
ipcMain.handle("ai:getSettings", () => store.getAiSettings());
ipcMain.handle("ai:saveSettings", (_e, settings: Partial<AiSettings>) => store.saveAiSettings(settings));
ipcMain.handle("ai:checkOllama", (_e, host?: string) => checkOllama(host));
ipcMain.handle("ai:testOpenAi", (_e, key: string, model?: string) => testOpenAi(key, model));
ipcMain.handle("ai:testAnthropic", (_e, key: string, model?: string) => testAnthropic(key, model));
ipcMain.handle(
    "ai:parseDraft",
    (_e, prompt: string, clients: Pick<Client, "id" | "name">[], isSmallBusiness: boolean) => {
        const aiSettings = { ...store.getAiSettings() };
        // Cloud providers receive invoice text and client names; only use them after an explicit opt-in.
        const cloudBlocked = store.get("onboarding")?.cloud_ai_opt_in === false;
        if (cloudBlocked && aiSettings.active_provider !== "ollama") {
            aiSettings.active_provider = "ollama";
        }
        return parseInvoiceDraft(prompt, clients, isSmallBusiness, aiSettings);
    }
);

// First-run setup assistant
ipcMain.handle("app:getInfo", (): AppInfo => ({
    version: app.getVersion(),
    platform: process.platform,
    vaultPath: store.getVaultPath(),
}));
ipcMain.handle("setup:detectOllama", () => detectOllama());
ipcMain.handle("setup:launchOllama", () => launchOllama());
ipcMain.handle("ai:pullModel", (event, host?: string, model?: string) =>
    pullOllamaModel(host, model, (progress) => {
        if (!event.sender.isDestroyed()) event.sender.send("ai:pullProgress", progress);
    })
);
ipcMain.handle("onboarding:setCloudOptIn", (_e, allowed: boolean) => {
    const current = store.get("onboarding");
    if (current) store.set("onboarding", { ...current, cloud_ai_opt_in: Boolean(allowed) });
    return store.get("onboarding");
});
ipcMain.handle("onboarding:complete", (_e, req: CompleteOnboardingRequest): OnboardingState => {
    if (req.remove_sample_data) {
        store.set("invoices", (store.get("invoices") || []).filter((i) => !SAMPLE_IDS.invoices.includes(i.id)));
        store.set("clients", (store.get("clients") || []).filter((c) => !SAMPLE_IDS.clients.includes(c.id)));
        store.set("expenses", (store.get("expenses") || []).filter((e) => !SAMPLE_IDS.expenses.includes(e.id)));
    }
    const now = new Date().toISOString();
    const state: OnboardingState = {
        completed_at: now,
        storage_consent_at: now,
        cloud_ai_opt_in: Boolean(req.cloud_ai_opt_in),
    };
    store.set("onboarding", state);
    return state;
});

// Native Exports
ipcMain.handle("export:pdf", async (_e, invoiceId: string): Promise<ExportResult> => {
    if (!mainWindow) return { success: false };
    const inv = (store.get("invoices") || []).find((i) => i.id === invoiceId);
    const offer = inv ? undefined : (store.get("offers") || []).find((o) => o.id === invoiceId);
    const filename = offer
        ? `Angebot_${offer.offer_number || offer.id}.pdf`
        : `${inv?.invoice_number || "Rechnung"}.pdf`;

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: offer ? "Angebot als PDF speichern" : "Rechnung als PDF speichern",
        defaultPath: filename,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (canceled || !filePath) return { success: false };

    const data = await mainWindow.webContents.printToPDF({
        printBackground: true,
        pageSize: "A4",
    });
    fs.writeFileSync(filePath, data);
    shell.showItemInFolder(filePath);
    return { success: true, filePath };
});

ipcMain.handle("export:xrechnung", async (_e, invoiceId: string): Promise<ExportResult> => {
    if (!mainWindow) return { success: false };
    const invoices = store.get("invoices") || [];
    const clients = store.get("clients") || [];
    const company: Company = store.get("company") || {};

    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return { success: false, error: "Rechnung nicht gefunden" };
    const client: Partial<Client> = clients.find((c) => c.id === inv.client_id) || { name: "Kunde" };

    const xml = generateXRechnungXML(inv, company, client);
    const filename = `XRechnung_${inv.invoice_number}.xml`;

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: "XRechnung 3.0 XML speichern",
        defaultPath: filename,
        filters: [{ name: "XML", extensions: ["xml"] }],
    });
    if (canceled || !filePath) return { success: false };

    fs.writeFileSync(filePath, xml, "utf8");
    shell.showItemInFolder(filePath);
    return { success: true, filePath };
});

ipcMain.handle("export:datev", exportDatevHandler);
ipcMain.handle("backup:export", exportBackupHandler);

ipcMain.handle("backup:import", async (): Promise<ExportResult> => {
    if (!mainWindow) return { success: false };
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: "Rechly Backup wiederherstellen",
        filters: [{ name: "Rechly Backup", extensions: ["rechly-backup", "json"] }],
        properties: ["openFile"],
    });

    if (canceled || !filePaths[0]) return { success: false };

    try {
        store.importBackup(filePaths[0]);
        return { success: true };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
});

ipcMain.handle("native:print", () => {
    mainWindow?.webContents.print();
});

// App Lifecycle
app.whenReady().then(() => {
    buildMenu();
    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
