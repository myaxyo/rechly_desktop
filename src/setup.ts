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
import type { OllamaInstallInfo, SystemProfile } from "./types";

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

export interface SystemProfileInput {
    totalmem?: () => number;
    arch?: string;
    platform?: string;
    cpus?: () => { model: string }[];
}

export function getSystemProfile(input?: SystemProfileInput): SystemProfile {
    const totalMemBytes = input?.totalmem ? input.totalmem() : os.totalmem();
    const totalRamGb = Math.round(totalMemBytes / (1024 ** 3));
    const arch = input?.arch ?? process.arch;
    const platform = input?.platform ?? process.platform;
    const cpus = input?.cpus ? input.cpus() : os.cpus();
    const cpuModel = cpus[0]?.model || "Unbekannter Prozessor";
    const isAppleSilicon = platform === "darwin" && arch === "arm64";

    let recommendedTier: "3b" | "1.5b" | "0.5b";
    let recommendationReason: string;

    if (isAppleSilicon || totalRamGb >= 8) {
        recommendedTier = "3b";
        recommendationReason = isAppleSilicon
            ? "Apple Silicon mit Unified Memory erkannt – Flagship-Modell läuft mit voller GPU-Beschleunigung."
            : `${totalRamGb} GB RAM verfügbar (≥ 8 GB) – Ausreichend Speicher für das Flagship-Modell.`;
    } else if (totalRamGb >= 4) {
        recommendedTier = "1.5b";
        recommendationReason = `${totalRamGb} GB RAM erkannt (4–8 GB) – Rechly-DE-1.5B (Slim) bietet die ideale Balance aus Geschwindigkeit und Speicherbedarf.`;
    } else {
        recommendedTier = "0.5b";
        recommendationReason = `${totalRamGb} GB RAM erkannt (< 4 GB) – Rechly-DE-0.5B (Nano) ist ultra-ressourcensparend und läuft auch auf Geräten mit geringem Arbeitsspeicher.`;
    }

    return {
        totalRamGb,
        arch,
        platform,
        cpuModel,
        isAppleSilicon,
        recommendedTier,
        recommendationReason,
    };
}
