const {
    app,
    BrowserWindow,
    Menu,
    dialog,
    shell,
    ipcMain,
} = require("electron");
const path = require("path");
const fs = require("fs");

const store = require("./store");
const { generateXRechnungXML, generateDatevExport } = require("./eRechnung");
const { checkOllama, parseInvoiceDraft } = require("./ai");

let mainWindow = null;

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

    // Load local offline desktop UI
    mainWindow.loadFile(path.join(__dirname, "ui", "index.html"));

    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
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
    const template = [
        ...(isMac
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
            : []),
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
                { role: "reload", label: "Neu laden" },
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

async function exportDatevHandler() {
    if (!mainWindow) return { success: false };
    const invoices = store.get("invoices") || [];
    const company = store.get("company") || {};

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

async function exportBackupHandler() {
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
ipcMain.handle("company:save", (_e, data) => {
    store.set("company", data);
    return true;
});

// Invoices
ipcMain.handle("invoices:getAll", () => store.get("invoices") || []);
ipcMain.handle("invoices:create", (_e, data) => {
    const invoices = store.get("invoices") || [];
    const newInvoice = {
        id: `inv-${Date.now()}`,
        created_at: Date.now(),
        ...data,
    };
    invoices.unshift(newInvoice);
    store.set("invoices", invoices);
    return newInvoice;
});
ipcMain.handle("invoices:update", (_e, id, data) => {
    const invoices = store.get("invoices") || [];
    const idx = invoices.findIndex((i) => i.id === id);
    if (idx !== -1) {
        invoices[idx] = { ...invoices[idx], ...data, updated_at: Date.now() };
        store.set("invoices", invoices);
        return invoices[idx];
    }
    return null;
});
ipcMain.handle("invoices:delete", (_e, id) => {
    let invoices = store.get("invoices") || [];
    invoices = invoices.filter((i) => i.id !== id);
    store.set("invoices", invoices);
    return true;
});

// Clients
ipcMain.handle("clients:getAll", () => store.get("clients") || []);
ipcMain.handle("clients:create", (_e, data) => {
    const clients = store.get("clients") || [];
    const newClient = {
        id: `client-${Date.now()}`,
        created_at: Date.now(),
        ...data,
    };
    clients.unshift(newClient);
    store.set("clients", clients);
    return newClient;
});
ipcMain.handle("clients:update", (_e, id, data) => {
    const clients = store.get("clients") || [];
    const idx = clients.findIndex((c) => c.id === id);
    if (idx !== -1) {
        clients[idx] = { ...clients[idx], ...data };
        store.set("clients", clients);
        return clients[idx];
    }
    return null;
});
ipcMain.handle("clients:delete", (_e, id) => {
    let clients = store.get("clients") || [];
    clients = clients.filter((c) => c.id !== id);
    store.set("clients", clients);
    return true;
});

// Products
ipcMain.handle("products:getAll", () => store.get("products") || []);
ipcMain.handle("products:create", (_e, data) => {
    const products = store.get("products") || [];
    const newProduct = {
        id: `prod-${Date.now()}`,
        ...data,
    };
    products.push(newProduct);
    store.set("products", products);
    return newProduct;
});
ipcMain.handle("products:delete", (_e, id) => {
    let products = store.get("products") || [];
    products = products.filter((p) => p.id !== id);
    store.set("products", products);
    return true;
});

// Offers
ipcMain.handle("offers:getAll", () => store.get("offers") || []);
ipcMain.handle("offers:create", (_e, data) => {
    const offers = store.get("offers") || [];
    const newOffer = { id: `off-${Date.now()}`, created_at: Date.now(), ...data };
    offers.unshift(newOffer);
    store.set("offers", offers);
    return newOffer;
});
ipcMain.handle("offers:convert", (_e, id) => {
    const offers = store.get("offers") || [];
    const offer = offers.find((o) => o.id === id);
    if (!offer) return null;

    const invoices = store.get("invoices") || [];
    const newInvoice = {
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
ipcMain.handle("expenses:create", (_e, data) => {
    const expenses = store.get("expenses") || [];
    const newExpense = { id: `exp-${Date.now()}`, ...data };
    expenses.unshift(newExpense);
    store.set("expenses", expenses);
    return newExpense;
});
ipcMain.handle("expenses:delete", (_e, id) => {
    let expenses = store.get("expenses") || [];
    expenses = expenses.filter((e) => e.id !== id);
    store.set("expenses", expenses);
    return true;
});

// AI & Ollama (jonprompter/Rechly-DE-3B)
ipcMain.handle("ai:checkOllama", (_e, host) => checkOllama(host));
ipcMain.handle("ai:parseDraft", (_e, prompt, clients, isSmallBusiness) => {
    const aiSettings = store.get("aiSettings") || {};
    return parseInvoiceDraft(
        prompt,
        clients,
        isSmallBusiness,
        aiSettings.base_url || "http://localhost:11434",
        aiSettings.model || "jonprompter/Rechly-DE-3B"
    );
});

// Native Exports
ipcMain.handle("export:pdf", async (_e, invoiceId) => {
    if (!mainWindow) return { success: false };
    const invoices = store.get("invoices") || [];
    const inv = invoices.find((i) => i.id === invoiceId);
    const filename = `${inv?.invoice_number || "Rechnung"}.pdf`;

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: "Rechnung als PDF speichern",
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

ipcMain.handle("export:xrechnung", async (_e, invoiceId) => {
    if (!mainWindow) return { success: false };
    const invoices = store.get("invoices") || [];
    const clients = store.get("clients") || [];
    const company = store.get("company") || {};

    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return { success: false, error: "Rechnung nicht gefunden" };
    const client = clients.find((c) => c.id === inv.client_id) || { name: "Kunde" };

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

ipcMain.handle("backup:import", async () => {
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
        return { success: false, error: err.message };
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
