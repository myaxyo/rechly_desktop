const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("rechly", {
    isDesktop: true,
    platform: process.platform,

    // Store & Data
    getStore: () => ipcRenderer.invoke("store:get"),
    getCompany: () => ipcRenderer.invoke("company:get"),
    saveCompany: (data) => ipcRenderer.invoke("company:save", data),

    // Invoices
    getInvoices: () => ipcRenderer.invoke("invoices:getAll"),
    createInvoice: (data) => ipcRenderer.invoke("invoices:create", data),
    updateInvoice: (id, data) => ipcRenderer.invoke("invoices:update", id, data),
    deleteInvoice: (id) => ipcRenderer.invoke("invoices:delete", id),

    // Clients
    getClients: () => ipcRenderer.invoke("clients:getAll"),
    createClient: (data) => ipcRenderer.invoke("clients:create", data),
    updateClient: (id, data) => ipcRenderer.invoke("clients:update", id, data),
    deleteClient: (id) => ipcRenderer.invoke("clients:delete", id),

    // Products
    getProducts: () => ipcRenderer.invoke("products:getAll"),
    createProduct: (data) => ipcRenderer.invoke("products:create", data),
    updateProduct: (id, data) => ipcRenderer.invoke("products:update", id, data),
    deleteProduct: (id) => ipcRenderer.invoke("products:delete", id),

    // Offers
    getOffers: () => ipcRenderer.invoke("offers:getAll"),
    createOffer: (data) => ipcRenderer.invoke("offers:create", data),
    updateOffer: (id, data) => ipcRenderer.invoke("offers:update", id, data),
    convertOffer: (id) => ipcRenderer.invoke("offers:convert", id),

    // Expenses
    getExpenses: () => ipcRenderer.invoke("expenses:getAll"),
    createExpense: (data) => ipcRenderer.invoke("expenses:create", data),
    updateExpense: (id, data) => ipcRenderer.invoke("expenses:update", id, data),
    deleteExpense: (id) => ipcRenderer.invoke("expenses:delete", id),

    // AI & Integrations (Ollama, OpenAI, Claude)
    getAiSettings: () => ipcRenderer.invoke("ai:getSettings"),
    saveAiSettings: (settings) => ipcRenderer.invoke("ai:saveSettings", settings),
    checkOllama: (host) => ipcRenderer.invoke("ai:checkOllama", host),
    testOpenAi: (key, model) => ipcRenderer.invoke("ai:testOpenAi", key, model),
    testAnthropic: (key, model) => ipcRenderer.invoke("ai:testAnthropic", key, model),
    parseInvoiceDraft: (prompt, clients, isSmallBusiness) =>
        ipcRenderer.invoke("ai:parseDraft", prompt, clients, isSmallBusiness),

    // Native Native Export Dialogs
    exportPdf: (invoiceId) => ipcRenderer.invoke("export:pdf", invoiceId),
    exportXRechnung: (invoiceId) => ipcRenderer.invoke("export:xrechnung", invoiceId),
    exportDatev: () => ipcRenderer.invoke("export:datev"),
    printPage: () => ipcRenderer.invoke("native:print"),

    // Backup & Restore
    exportBackup: () => ipcRenderer.invoke("backup:export"),
    importBackup: () => ipcRenderer.invoke("backup:import"),
});
