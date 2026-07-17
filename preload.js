const { contextBridge } = require("electron");

/**
 * Minimal bridge: the web app can detect the desktop shell and adapt
 * (e.g. hide "install app" prompts, enable desktop-specific hints).
 * No privileged APIs are exposed.
 */
contextBridge.exposeInMainWorld("rechlyDesktop", {
    isDesktop: true,
    platform: process.platform,
});
