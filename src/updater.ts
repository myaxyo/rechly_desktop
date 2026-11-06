import * as https from "node:https";
import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { URL } from "node:url";
import { app, shell } from "electron";
import type { AppUpdateInfo, AppUpdateProgress } from "./types";

export interface GitHubAsset {
    name: string;
    browser_download_url: string;
    size: number;
    content_type?: string;
}

export interface GitHubRelease {
    tag_name: string;
    name?: string;
    body?: string;
    published_at?: string;
    created_at?: string;
    html_url?: string;
    assets: GitHubAsset[];
}

/**
 * Cleanly compares two semver strings (e.g. "1.3.1" and "1.3.2").
 * Returns true if candidate is strictly newer than current.
 */
export function isNewerVersion(current: string, candidate: string): boolean {
    const cleanCurrent = (current || "0.0.0").replace(/^v/, "").trim();
    const cleanCandidate = (candidate || "0.0.0").replace(/^v/, "").trim();
    const curParts = cleanCurrent.split(".").map(p => parseInt(p, 10) || 0);
    const candParts = cleanCandidate.split(".").map(p => parseInt(p, 10) || 0);
    const maxLen = Math.max(curParts.length, candParts.length);

    for (let i = 0; i < maxLen; i++) {
        const cur = curParts[i] || 0;
        const cand = candParts[i] || 0;
        if (cand > cur) return true;
        if (cand < cur) return false;
    }
    return false;
}

/**
 * Picks the matching asset from a GitHub Release based on platform and CPU architecture.
 */
export function matchPlatformAsset(
    assets: GitHubAsset[],
    platform: NodeJS.Platform = process.platform,
    arch: string = process.arch
): GitHubAsset | undefined {
    if (!assets || assets.length === 0) return undefined;

    if (platform === "win32") {
        return assets.find(a => a.name.endsWith(".exe") && a.name.includes(arch)) ||
               assets.find(a => a.name.endsWith(".exe"));
    }

    if (platform === "darwin") {
        const isArm = arch === "arm64";
        if (isArm) {
            return assets.find(a => a.name.endsWith(".dmg") && a.name.includes("arm64")) ||
                   assets.find(a => a.name.endsWith(".zip") && a.name.includes("arm64")) ||
                   assets.find(a => a.name.endsWith(".dmg"));
        } else {
            return assets.find(a => a.name.endsWith(".dmg") && (a.name.includes("x64") || a.name.includes("intel"))) ||
                   assets.find(a => a.name.endsWith(".zip") && !a.name.includes("arm64")) ||
                   assets.find(a => a.name.endsWith(".dmg"));
        }
    }

    if (platform === "linux") {
        return assets.find(a => a.name.endsWith(".AppImage")) ||
               assets.find(a => a.name.endsWith(".deb"));
    }

    return assets[0];
}

/**
 * Performs an HTTPS GET with automatic redirect following.
 */
function fetchWithRedirects(
    targetUrl: string,
    options: https.RequestOptions = {},
    maxRedirects = 5
): Promise<http.IncomingMessage> {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) {
            return reject(new Error("Zu viele Weiterleitungen"));
        }

        const urlObj = new URL(targetUrl);
        const protocol = urlObj.protocol === "http:" ? http : https;

        const req = protocol.get(targetUrl, options, (res) => {
            const statusCode = res.statusCode || 200;
            if ([301, 302, 303, 307, 308].includes(statusCode) && res.headers.location) {
                const nextUrl = new URL(res.headers.location, targetUrl).toString();
                // Consume response data to free up memory
                res.resume();
                return resolve(fetchWithRedirects(nextUrl, options, maxRedirects - 1));
            }
            resolve(res);
        });

        req.on("error", reject);
        req.setTimeout(30000, () => {
            req.destroy(new Error("Zeitüberschreitung beim Netzwerkzugriff (30s)"));
        });
    });
}

/**
 * Checks GitHub Releases for updates without any backend requirement.
 */
export async function checkGitHubReleaseUpdate(
    currentVersion: string,
    repoSlug = "myaxyo/rechly_desktop"
): Promise<AppUpdateInfo> {
    const apiUrl = `https://api.github.com/repos/${repoSlug}/releases/latest`;

    try {
        const res = await fetchWithRedirects(apiUrl, {
            headers: {
                "User-Agent": `Rechly-Desktop/${currentVersion}`,
                Accept: "application/vnd.github.v3+json",
            },
        });

        if (res.statusCode !== 200) {
            res.resume();
            return {
                available: false,
                currentVersion,
                error: `GitHub API Status ${res.statusCode}`,
            };
        }

        const chunks: Buffer[] = [];
        for await (const chunk of res) {
            chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        }
        const bodyText = Buffer.concat(chunks).toString("utf8");
        const release: GitHubRelease = JSON.parse(bodyText);

        const latestVersion = (release.tag_name || "").replace(/^v/, "").trim();
        const available = isNewerVersion(currentVersion, latestVersion);
        const matchedAsset = matchPlatformAsset(release.assets || []);

        return {
            available,
            currentVersion,
            latestVersion,
            releaseName: release.name || release.tag_name,
            releaseNotes: release.body || "",
            releaseDate: release.published_at || release.created_at,
            releaseUrl: release.html_url,
            downloadUrl: matchedAsset?.browser_download_url,
        };
    } catch (err: any) {
        return {
            available: false,
            currentVersion,
            error: err?.message || "Netzwerkfehler bei der Updatesuche",
        };
    }
}

let activeDownloadPath: string | null = null;

/**
 * Downloads the update asset file to temp or downloads folder with real-time progress events.
 */
export async function downloadUpdateAsset(
    downloadUrl: string,
    onProgress?: (progress: AppUpdateProgress) => void
): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
        const urlObj = new URL(downloadUrl);
        const filename = path.basename(urlObj.pathname) || "Rechly-Update";
        const tempDir = app.getPath("temp");
        const destPath = path.join(tempDir, filename);

        const res = await fetchWithRedirects(downloadUrl, {
            headers: {
                "User-Agent": `Rechly-Desktop/${app.getVersion()}`,
                Accept: "application/octet-stream",
            },
        });

        if (res.statusCode !== 200) {
            res.resume();
            return {
                success: false,
                error: `Download fehlgeschlagen (HTTP ${res.statusCode})`,
            };
        }

        const total = parseInt(res.headers["content-length"] || "0", 10);
        let transferred = 0;
        let lastTime = Date.now();
        let lastTransferred = 0;
        let bytesPerSecond = 0;

        const fileStream = fs.createWriteStream(destPath);

        await new Promise<void>((resolve, reject) => {
            res.on("data", (chunk: Buffer) => {
                transferred += chunk.length;
                const now = Date.now();
                const elapsedSec = (now - lastTime) / 1000;
                if (elapsedSec >= 0.5) {
                    bytesPerSecond = Math.round((transferred - lastTransferred) / elapsedSec);
                    lastTime = now;
                    lastTransferred = transferred;
                }
                const percent = total > 0 ? Math.min(100, Math.round((transferred / total) * 100)) : 0;
                if (onProgress) {
                    onProgress({
                        percent,
                        transferred,
                        total,
                        bytesPerSecond,
                    });
                }
            });

            res.pipe(fileStream);
            fileStream.on("finish", () => {
                fileStream.close();
                resolve();
            });
            fileStream.on("error", (err) => {
                fs.unlink(destPath, () => {});
                reject(err);
            });
            res.on("error", (err) => {
                fs.unlink(destPath, () => {});
                reject(err);
            });
        });

        activeDownloadPath = destPath;
        return { success: true, filePath: destPath };
    } catch (err: any) {
        return { success: false, error: err?.message || "Fehler beim Herunterladen des Updates" };
    }
}

/**
 * Installs or launches the downloaded update file.
 */
export async function installDownloadedUpdate(targetPath?: string): Promise<{ success: boolean; error?: string }> {
    const file = targetPath || activeDownloadPath;
    if (!file || !fs.existsSync(file)) {
        return { success: false, error: "Die Installationsdatei wurde nicht gefunden." };
    }

    try {
        if (process.platform === "win32") {
            // Windows NSIS installer
            spawn(file, [], { detached: true, stdio: "ignore" }).unref();
            app.quit();
            return { success: true };
        } else if (process.platform === "darwin") {
            // macOS: Open DMG or ZIP package
            await shell.openPath(file);
            return { success: true };
        } else {
            await shell.openPath(file);
            return { success: true };
        }
    } catch (err: any) {
        return { success: false, error: err?.message || "Fehler beim Ausführen der Installationsdatei" };
    }
}
