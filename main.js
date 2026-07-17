const {
    app,
    BrowserWindow,
    Menu,
    dialog,
    shell,
    session,
} = require("electron");
const path = require("path");
const fs = require("fs");

/**
 * Rechly Desktop — thin shell around the rechly.de web app.
 *
 * Architecture decision (2026-07): wrap the hosted Next.js app instead of
 * bundling a local build. The app is always current, maintenance stays low,
 * and native value comes from the shell: menus, printing, PDF export and
 * auto-updates. Offline support arrives via the web app's local-first work.
 */

const APP_URL = process.env.RECHLY_URL || "https://rechly.de";
const APP_ORIGIN = new URL(APP_URL).origin;

// Origins the window may navigate to (OAuth needs Appwrite + Google)
const ALLOWED_ORIGINS = new Set([
    APP_ORIGIN,
    "https://fra.cloud.appwrite.io",
    "https://accounts.google.com",
]);

const isAllowedUrl = (url) => {
    try {
        const { origin, hostname } = new URL(url);
        if (ALLOWED_ORIGINS.has(origin)) return true;
        // Google auth hops across several *.google.com hosts
        return (
            hostname.endsWith(".google.com") ||
            hostname.endsWith(".googleusercontent.com")
        );
    } catch {
        return false;
    }
};

// ─── Window state persistence ────────────────────────────────────────────────

const stateFile = () => path.join(app.getPath("userData"), "window-state.json");

const loadWindowState = () => {
    try {
        return JSON.parse(fs.readFileSync(stateFile(), "utf8"));
    } catch {
        return { width: 1280, height: 840 };
    }
};

const saveWindowState = (win) => {
    try {
        if (win.isMinimized() || win.isFullScreen()) return;
        const bounds = win.getBounds();
        fs.writeFileSync(stateFile(), JSON.stringify(bounds));
    } catch {
        // Best effort only
    }
};

// ─── Main window ─────────────────────────────────────────────────────────────

let mainWindow = null;

const createWindow = () => {
    const state = loadWindowState();

    mainWindow = new BrowserWindow({
        ...state,
        minWidth: 900,
        minHeight: 600,
        show: false,
        backgroundColor: "#ffffff",
        title: "Rechly",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            spellcheck: true,
        },
    });

    mainWindow.once("ready-to-show", () => mainWindow.show());
    mainWindow.on("close", () => saveWindowState(mainWindow));
    mainWindow.on("closed", () => {
        mainWindow = null;
    });

    // Keep the app inside the allowed origins; everything else opens in the
    // default browser.
    mainWindow.webContents.on("will-navigate", (event, url) => {
        if (!isAllowedUrl(url)) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (isAllowedUrl(url)) {
            // OAuth popups must stay inside the app session
            return { action: "allow" };
        }
        shell.openExternal(url);
        return { action: "deny" };
    });

    mainWindow.loadURL(APP_URL).catch(() => {
        // Offline / unreachable: show a minimal local page with retry
        mainWindow.loadFile(path.join(__dirname, "offline.html"));
    });
    mainWindow.webContents.on(
        "did-fail-load",
        (_event, errorCode, _desc, validatedURL, isMainFrame) => {
            // -3 = aborted (e.g. redirects) — not an error
            if (isMainFrame && errorCode !== -3 && validatedURL === APP_URL) {
                mainWindow.loadFile(path.join(__dirname, "offline.html"));
            }
        }
    );
};

// ─── Printing & PDF export ───────────────────────────────────────────────────

const printCurrentPage = () => {
    mainWindow?.webContents.print({}, (success, reason) => {
        if (!success && reason !== "cancelled" && reason !== "canceled") {
            dialog.showErrorBox("Drucken fehlgeschlagen", String(reason));
        }
    });
};

const exportCurrentPageAsPdf = async () => {
    if (!mainWindow) return;
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: "Als PDF speichern",
        defaultPath: "rechly.pdf",
        filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (canceled || !filePath) return;

    try {
        const data = await mainWindow.webContents.printToPDF({
            printBackground: true,
            pageSize: "A4",
        });
        fs.writeFileSync(filePath, data);
        shell.showItemInFolder(filePath);
    } catch (error) {
        dialog.showErrorBox("PDF-Export fehlgeschlagen", String(error));
    }
};

// ─── Menu ────────────────────────────────────────────────────────────────────

const buildMenu = () => {
    const isMac = process.platform === "darwin";

    const template = [
        ...(isMac
            ? [
                  {
                      label: app.name,
                      submenu: [
                          { role: "about", label: "Über Rechly" },
                          { type: "separator" },
                          { role: "hide", label: "Rechly ausblenden" },
                          { role: "hideOthers" },
                          { role: "unhide" },
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
                    label: "Drucken…",
                    accelerator: "CmdOrCtrl+P",
                    click: printCurrentPage,
                },
                {
                    label: "Als PDF speichern…",
                    accelerator: "CmdOrCtrl+Shift+S",
                    click: exportCurrentPageAsPdf,
                },
                { type: "separator" },
                isMac
                    ? { role: "close", label: "Fenster schließen" }
                    : { role: "quit", label: "Beenden" },
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
                { role: "resetZoom", label: "Originalgröße" },
                { role: "zoomIn", label: "Vergrößern" },
                { role: "zoomOut", label: "Verkleinern" },
                { type: "separator" },
                { role: "togglefullscreen", label: "Vollbild" },
            ],
        },
        {
            label: "Fenster",
            submenu: [
                { role: "minimize", label: "Minimieren" },
                ...(isMac
                    ? [{ role: "front", label: "Alle nach vorne" }]
                    : []),
            ],
        },
        {
            label: "Hilfe",
            role: "help",
            submenu: [
                {
                    label: "Rechly im Browser öffnen",
                    click: () => shell.openExternal(APP_URL),
                },
                {
                    label: "Quellcode auf GitHub",
                    click: () =>
                        shell.openExternal("https://github.com/myaxyo"),
                },
            ],
        },
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

// ─── Auto updates ────────────────────────────────────────────────────────────

const setupAutoUpdates = () => {
    // Only meaningful in packaged builds with a configured publish target
    if (!app.isPackaged) return;
    try {
        const { autoUpdater } = require("electron-updater");
        autoUpdater.checkForUpdatesAndNotify().catch((error) => {
            console.log("Update check failed:", error?.message);
        });
    } catch (error) {
        console.log("Auto-updater unavailable:", error?.message);
    }
};

// ─── App lifecycle ───────────────────────────────────────────────────────────

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on("second-instance", () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(() => {
        // Belt and braces: strip Electron identifiers is NOT done — the web
        // app may want to detect the desktop shell via the user agent.
        session.defaultSession.setPermissionRequestHandler(
            (_webContents, permission, callback) => {
                // The invoicing app needs none of the sensitive permissions
                const allowed = ["clipboard-read", "notifications"];
                callback(allowed.includes(permission));
            }
        );

        buildMenu();
        createWindow();
        setupAutoUpdates();

        app.on("activate", () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });

    app.on("window-all-closed", () => {
        if (process.platform !== "darwin") app.quit();
    });
}
