/**
 * First-run setup helpers: detect and launch a local Ollama installation.
 * Paths are resolved here in the main process only; the renderer can ask to
 * launch Ollama but never supplies the executable path itself.
 */

import { shell } from "electron";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { OllamaInstallInfo } from "./types";

export const OLLAMA_DOWNLOAD_URL = "https://ollama.com/download";

/** Desktop app bundles that start the Ollama server when opened. */
function appCandidates(): string[] {
    const home = os.homedir();
    if (process.platform === "darwin") {
        return ["/Applications/Ollama.app", path.join(home, "Applications", "Ollama.app")];
    }
    if (process.platform === "win32") {
        const localAppData = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
        return [path.join(localAppData, "Programs", "Ollama", "ollama app.exe")];
    }
    return [];
}

/** CLI binaries, started with `ollama serve`. GUI apps on macOS get a minimal PATH, so add common install dirs. */
function cliCandidates(): string[] {
    const binary = process.platform === "win32" ? "ollama.exe" : "ollama";
    const dirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
    if (process.platform !== "win32") {
        dirs.push("/usr/local/bin", "/opt/homebrew/bin", "/usr/bin", path.join(os.homedir(), ".local", "bin"));
    } else {
        const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
        dirs.push(path.join(localAppData, "Programs", "Ollama"));
    }
    return [...new Set(dirs)].map((dir) => path.join(dir, binary));
}

const exists = (p: string): boolean => {
    try {
        return fs.existsSync(p);
    } catch {
        return false;
    }
};

export function detectOllama(): OllamaInstallInfo {
    const app = appCandidates().find(exists);
    if (app) return { installed: true, launchPath: app };
    const cli = cliCandidates().find(exists);
    if (cli) return { installed: true, launchPath: cli };
    return { installed: false, launchPath: null };
}

export async function launchOllama(): Promise<{ success: boolean; error?: string }> {
    const { launchPath } = detectOllama();
    if (!launchPath) return { success: false, error: "Ollama wurde auf diesem Gerät nicht gefunden." };

    try {
        if (launchPath.endsWith(".app") || launchPath.endsWith("ollama app.exe")) {
            const error = await shell.openPath(launchPath);
            return error ? { success: false, error } : { success: true };
        }
        const child = spawn(launchPath, ["serve"], { detached: true, stdio: "ignore" });
        child.on("error", () => undefined);
        child.unref();
        return { success: true };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
}
