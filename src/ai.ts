/**
 * Rechly Desktop AI Engine
 * Supports:
 * 1. Local On-Device Ollama (featuring jonprompter/Rechly-DE-3B)
 * 2. OpenAI Cloud API (GPT-4o-mini, GPT-4o, etc.)
 * 3. Anthropic Claude Cloud API (Claude 3.5 Sonnet, Claude 3.5 Haiku)
 * 4. Deterministic German Regex / Rule-Based Heuristic Fallback
 */

import * as http from "node:http";
import * as https from "node:https";
import {
    type AiSettings,
    type Client,
    type ModelTierId,
    type OllamaPullProgress,
    type OllamaStatus,
    RECHLY_MODEL_FAMILY,
} from "./types";

export type { OllamaStatus } from "./types";

type ClientRef = Pick<Client, "id" | "name">;

export interface DraftItem {
    description: string;
    quantity: number;
    unit_of_measure: string;
    price: number;
    tax_rate_percent: number;
    total?: number;
}

export interface ParsedDraft {
    client_id: string | null;
    client_name: string | null;
    due_days: number;
    payment_terms: string;
    items: DraftItem[];
}

export interface DraftResult {
    parsed: ParsedDraft;
    source: string;
    model: string;
}

/** Shape the LLMs are asked to return; any field may be missing or null. */
type LlmDraft = Partial<{ [K in keyof ParsedDraft]: ParsedDraft[K] | null }>;

interface LlmResult {
    parsed: LlmDraft;
    source: string;
    model: string;
}

interface HttpResponse {
    status: number | undefined;
    body: string;
}

interface RequestOptions {
    method?: string;
    headers?: Record<string, string>;
}

export interface ConnectionTestResult {
    success: boolean;
    message?: string;
    error?: string;
}

const errorMessage = (err: unknown): string =>
    err instanceof Error ? err.message : String(err);

export const DEFAULT_OLLAMA_HOST = "http://localhost:11434";
export const FEATURED_MODEL = RECHLY_MODEL_FAMILY["3b"].modelIdentifier;
export const OLLAMA_URL = `https://ollama.com/${FEATURED_MODEL}`;
export const HF_URL = RECHLY_MODEL_FAMILY["3b"].hfUrl;

export function matchModelToTier(name: string): ModelTierId | undefined {
    if (!name) return undefined;
    const lower = name.toLowerCase().trim();
    if (lower === "3b" || lower === "1.5b" || lower === "0.5b") {
        return lower as ModelTierId;
    }
    for (const tierId of ["3b", "1.5b", "0.5b"] as const) {
        const id = RECHLY_MODEL_FAMILY[tierId].modelIdentifier.toLowerCase();
        if (
            lower === id ||
            lower === `${id}:latest` ||
            lower.startsWith(`${id}:`) ||
            lower.includes(`rechly-de-${tierId}`) ||
            lower.includes(`rechly-${tierId}`)
        ) {
            return tierId;
        }
    }
    return undefined;
}

function makeHttpRequest(
    urlString: string,
    options: RequestOptions = {},
    postData: string | object | null = null
): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
        try {
            const parsed = new URL(urlString);
            const client = parsed.protocol === "https:" ? https : http;
            const payload = postData
                ? (typeof postData === "string" ? postData : JSON.stringify(postData))
                : null;
            const headers: Record<string, string> = { ...(options.headers || {}) };
            if (payload && !headers["Content-Length"]) {
                headers["Content-Length"] = String(Buffer.byteLength(payload));
            }
            const reqOptions: http.RequestOptions = {
                hostname: parsed.hostname,
                port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
                path: parsed.pathname + parsed.search,
                method: options.method || "GET",
                headers,
                timeout: 15000,
            };

            const req = client.request(reqOptions, (res) => {
                let data = "";
                res.on("data", (chunk) => {
                    data += chunk;
                });
                res.on("end", () => {
                    resolve({ status: res.statusCode, body: data });
                });
            });

            req.on("error", (err) => reject(err));
            req.on("timeout", () => {
                req.destroy();
                reject(new Error("Timeout bei der Verbindung zur KI-Schnittstelle (15s)"));
            });

            if (payload) {
                req.write(payload);
            }
            req.end();
        } catch (err) {
            reject(err);
        }
    });
}

// ─── 1. Ollama (Local) ────────────────────────────────────────────────────────

export async function checkOllama(
    host: string = DEFAULT_OLLAMA_HOST,
    activeTierOrModel?: string
): Promise<OllamaStatus> {
    const defaultInstalledTiers: Record<ModelTierId, boolean> = {
        "3b": false,
        "1.5b": false,
        "0.5b": false,
    };

    try {
        const res = await makeHttpRequest(`${host}/api/tags`);
        if (res.status === 200) {
            const data = JSON.parse(res.body) as { models?: { name?: string; model?: string }[] };
            const models = (data.models || []).map((m) => m.name || m.model || "").filter(Boolean);

            const installedTiers: Record<ModelTierId, boolean> = {
                "3b": false,
                "1.5b": false,
                "0.5b": false,
            };

            for (const tierId of ["3b", "1.5b", "0.5b"] as const) {
                const targetId = RECHLY_MODEL_FAMILY[tierId].modelIdentifier.toLowerCase();
                installedTiers[tierId] = models.some((m) => {
                    const lower = m.toLowerCase();
                    return (
                        lower === targetId ||
                        lower === `${targetId}:latest` ||
                        lower.startsWith(`${targetId}:`) ||
                        lower.includes(`rechly-de-${tierId}`) ||
                        lower.includes(`rechly-${tierId}`)
                    );
                });
            }

            const determinedActiveTier =
                (activeTierOrModel ? matchModelToTier(activeTierOrModel) : undefined) ||
                (installedTiers["3b"] ? "3b" : installedTiers["1.5b"] ? "1.5b" : installedTiers["0.5b"] ? "0.5b" : undefined);

            const hasFeatured =
                installedTiers["3b"] ||
                installedTiers["1.5b"] ||
                installedTiers["0.5b"] ||
                models.some((m) => m.toLowerCase().includes("rechly"));

            return {
                connected: true,
                models,
                installedTiers,
                activeTier: determinedActiveTier,
                hasFeaturedModel: hasFeatured,
                featuredModelName: FEATURED_MODEL,
                ollamaUrl: OLLAMA_URL,
                hfUrl: HF_URL,
            };
        }
        return {
            connected: false,
            installedTiers: defaultInstalledTiers,
            error: `HTTP ${res.status}`,
            hasFeaturedModel: false,
            featuredModelName: FEATURED_MODEL,
            ollamaUrl: OLLAMA_URL,
            hfUrl: HF_URL,
        };
    } catch (err) {
        return {
            connected: false,
            installedTiers: defaultInstalledTiers,
            error: errorMessage(err),
            hasFeaturedModel: false,
            featuredModelName: FEATURED_MODEL,
            ollamaUrl: OLLAMA_URL,
            hfUrl: HF_URL,
        };
    }
}

async function parseWithOllama(
    promptText: string,
    clients: ClientRef[],
    isSmallBusiness: boolean,
    host: string,
    model: string
): Promise<LlmResult> {
    const targetModel = model || FEATURED_MODEL;
    const clientList = clients
        .slice(0, 25)
        .map((c) => `- ID: "${c.id}", Name: "${c.name}"`)
        .join("\n");

    const prompt = `Du bist der Rechly KI-Rechnungsassistent für Deutschland.
Extrahiere aus folgendem Satz einen Rechnungsentwurf im exakten JSON-Format:
Eingabe: "${promptText}"
Bekannte Kunden:
${clientList}

Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt ohne Erklärungen oder Markdown-Backticks:
{
  "client_id": "Passende ID oder null",
  "client_name": "Erkannter Name oder null",
  "due_days": 14,
  "payment_terms": "Zahlungsbedingungen oder null",
  "items": [
    {
      "description": "Präzise deutsche Leistungsbezeichnung",
      "quantity": 1,
      "unit_of_measure": "Stunde | Stück | Tag | Pauschal",
      "price": 100,
      "tax_rate_percent": ${isSmallBusiness ? 0 : 19}
    }
  ]
}`;

    const res = await makeHttpRequest(
        `${host || DEFAULT_OLLAMA_HOST}/api/generate`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        },
        {
            model: targetModel,
            prompt,
            stream: false,
            format: "json",
        }
    );

    if (res.status === 200) {
        const data = JSON.parse(res.body) as { response: string };
        const parsed = JSON.parse(data.response) as LlmDraft;
        return { parsed, source: "ollama", model: targetModel };
    }
    throw new Error(`Ollama antwortete mit Status ${res.status}`);
}

/**
 * Downloads a model through Ollama's /api/pull endpoint, reporting progress
 * from the streamed NDJSON response. Aborts if no data arrives for 2 minutes.
 */
export function pullOllamaModel(
    host: string = DEFAULT_OLLAMA_HOST,
    model: string = FEATURED_MODEL,
    onProgress: (progress: OllamaPullProgress) => void = () => undefined
): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (result: { success: boolean; error?: string }) => {
            if (!settled) {
                settled = true;
                resolve(result);
            }
        };

        let parsed: URL;
        try {
            parsed = new URL(`${host}/api/pull`);
        } catch (err) {
            return finish({ success: false, error: errorMessage(err) });
        }
        const client = parsed.protocol === "https:" ? https : http;
        const body = JSON.stringify({ model, stream: true });

        const req = client.request(
            {
                hostname: parsed.hostname,
                port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
                path: parsed.pathname,
                method: "POST",
                headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
                timeout: 120000,
            },
            (res) => {
                if (res.statusCode !== 200) {
                    let errBody = "";
                    res.on("data", (c) => (errBody += c));
                    res.on("end", () => finish({ success: false, error: `Ollama HTTP ${res.statusCode}: ${errBody}` }));
                    return;
                }
                let buffer = "";
                let lastStatus = "";
                res.setEncoding("utf8");
                res.on("data", (chunk: string) => {
                    buffer += chunk;
                    let newline: number;
                    while ((newline = buffer.indexOf("\n")) >= 0) {
                        const line = buffer.slice(0, newline).trim();
                        buffer = buffer.slice(newline + 1);
                        if (!line) continue;
                        try {
                            const msg = JSON.parse(line) as OllamaPullProgress & { error?: string };
                            if (msg.error) return finish({ success: false, error: msg.error });
                            lastStatus = msg.status;
                            const percent =
                                msg.total && msg.total > 0
                                    ? Math.min(100, Math.max(0, Math.round(((msg.completed || 0) / msg.total) * 100)))
                                    : undefined;
                            onProgress({
                                status: msg.status,
                                completed: msg.completed,
                                total: msg.total,
                                percent,
                            });
                        } catch {
                            // ignore malformed progress lines
                        }
                    }
                });
                res.on("end", () =>
                    finish(lastStatus === "success" ? { success: true } : { success: false, error: "Download abgebrochen" })
                );
            }
        );

        req.on("timeout", () => {
            req.destroy();
            finish({ success: false, error: "Keine Antwort von Ollama (Timeout)" });
        });
        req.on("error", (err) => finish({ success: false, error: err.message }));
        req.write(body);
        req.end();
    });
}

/**
 * Deletes a model from Ollama's local storage to free disk space.
 */
export async function deleteOllamaModel(
    host: string = DEFAULT_OLLAMA_HOST,
    modelIdentifier: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const res = await makeHttpRequest(
            `${host}/api/delete`,
            {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
            },
            { model: modelIdentifier }
        );
        if (res.status === 200 || res.status === 204) {
            return { success: true };
        }
        if (!modelIdentifier.includes(":")) {
            const retryRes = await makeHttpRequest(
                `${host}/api/delete`,
                {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                },
                { model: `${modelIdentifier}:latest` }
            );
            if (retryRes.status === 200 || retryRes.status === 204) {
                return { success: true };
            }
        }
        return { success: false, error: `Ollama HTTP ${res.status}: ${res.body}` };
    } catch (err) {
        return { success: false, error: errorMessage(err) };
    }
}

// ─── 2. OpenAI Cloud API ──────────────────────────────────────────────────────

export async function testOpenAi(
    apiKey: string,
    model = "gpt-4o-mini"
): Promise<ConnectionTestResult> {
    if (!apiKey || !apiKey.trim()) {
        return { success: false, error: "Kein API-Key angegeben" };
    }
    try {
        const res = await makeHttpRequest("https://api.openai.com/v1/models", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${apiKey.trim()}`,
            },
        });
        if (res.status === 200) {
            return { success: true, message: "Verbindung zu OpenAI erfolgreich!" };
        } else if (res.status === 401) {
            return { success: false, error: "Ungültiger OpenAI API-Key (401)" };
        }
        return { success: false, error: `OpenAI Status: ${res.status}` };
    } catch (err) {
        return { success: false, error: errorMessage(err) };
    }
}

async function parseWithOpenAi(
    promptText: string,
    clients: ClientRef[],
    isSmallBusiness: boolean,
    apiKey: string,
    model = "gpt-4o-mini"
): Promise<LlmResult> {
    if (!apiKey) throw new Error("OpenAI API-Key fehlt");
    const clientList = clients
        .slice(0, 30)
        .map((c) => `- ID: "${c.id}", Name: "${c.name}"`)
        .join("\n");

    const systemPrompt = `Du bist der Rechly KI-Rechnungsassistent für Deutschland.
Extrahiere Rechnungsentwürfe präzise aus natürlicher Sprache.
Antworte AUSSCHLIESSLICH im validen JSON-Format:
{
  "client_id": "Passende ID oder null",
  "client_name": "Erkannter Kundenname oder null",
  "due_days": 14,
  "payment_terms": "Zahlungsbedingungen (z.B. Skonto) oder null",
  "items": [
    {
      "description": "Präzise deutsche Leistungsbezeichnung",
      "quantity": 1,
      "unit_of_measure": "Stunde | Stück | Tag | Pauschal",
      "price": 100,
      "tax_rate_percent": ${isSmallBusiness ? 0 : 19}
    }
  ]
}`;

    const userPrompt = `Eingabe: "${promptText}"\nBekannte Kunden:\n${clientList}`;

    const res = await makeHttpRequest(
        "https://api.openai.com/v1/chat/completions",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey.trim()}`,
            },
        },
        {
            model: model || "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            temperature: 0.1,
        }
    );

    if (res.status === 200) {
        const data = JSON.parse(res.body) as { choices: { message: { content: string } }[] };
        const text = data.choices[0].message.content;
        const parsed = JSON.parse(text) as LlmDraft;
        return { parsed, source: "openai", model: model || "gpt-4o-mini" };
    }
    throw new Error(`OpenAI API Fehler: HTTP ${res.status} - ${res.body}`);
}

// ─── 3. Anthropic Claude Cloud API ────────────────────────────────────────────

export async function testAnthropic(
    apiKey: string,
    model = "claude-3-5-sonnet-20241022"
): Promise<ConnectionTestResult> {
    if (!apiKey || !apiKey.trim()) {
        return { success: false, error: "Kein API-Key angegeben" };
    }
    try {
        const res = await makeHttpRequest(
            "https://api.anthropic.com/v1/messages",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey.trim(),
                    "anthropic-version": "2023-06-01",
                },
            },
            {
                model: model || "claude-3-5-haiku-20241022",
                max_tokens: 10,
                messages: [{ role: "user", content: "ping" }],
            }
        );
        if (res.status === 200) {
            return { success: true, message: "Verbindung zu Anthropic Claude erfolgreich!" };
        } else if (res.status === 401) {
            return { success: false, error: "Ungültiger Anthropic API-Key (401)" };
        }
        return { success: false, error: `Anthropic Status: ${res.status}` };
    } catch (err) {
        return { success: false, error: errorMessage(err) };
    }
}

async function parseWithAnthropic(
    promptText: string,
    clients: ClientRef[],
    isSmallBusiness: boolean,
    apiKey: string,
    model = "claude-3-5-sonnet-20241022"
): Promise<LlmResult> {
    if (!apiKey) throw new Error("Anthropic API-Key fehlt");
    const clientList = clients
        .slice(0, 30)
        .map((c) => `- ID: "${c.id}", Name: "${c.name}"`)
        .join("\n");

    const systemPrompt = `Du bist der Rechly KI-Rechnungsassistent für Deutschland.
Extrahiere Rechnungsentwürfe präzise aus natürlicher Sprache.
Antworte AUSSCHLIESSLICH im validen JSON-Format ohne Markdown-Backticks:
{
  "client_id": "Passende ID oder null",
  "client_name": "Erkannter Kundenname oder null",
  "due_days": 14,
  "payment_terms": "Zahlungsbedingungen oder null",
  "items": [
    {
      "description": "Präzise deutsche Leistungsbezeichnung",
      "quantity": 1,
      "unit_of_measure": "Stunde | Stück | Tag | Pauschal",
      "price": 100,
      "tax_rate_percent": ${isSmallBusiness ? 0 : 19}
    }
  ]
}`;

    const userPrompt = `Eingabe: "${promptText}"\nBekannte Kunden:\n${clientList}`;

    const res = await makeHttpRequest(
        "https://api.anthropic.com/v1/messages",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey.trim(),
                "anthropic-version": "2023-06-01",
            },
        },
        {
            model: model || "claude-3-5-sonnet-20241022",
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
            temperature: 0.1,
        }
    );

    if (res.status === 200) {
        const data = JSON.parse(res.body) as { content?: { text?: string }[] };
        let text = data.content?.[0]?.text || "{}";
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(text) as LlmDraft;
        return { parsed, source: "anthropic", model: model || "claude-3-5-sonnet" };
    }
    throw new Error(`Anthropic API Fehler: HTTP ${res.status} - ${res.body}`);
}

// ─── 4. Deterministic German Regex Fallback ───────────────────────────────────

function parseInvoiceDraftHeuristic(
    promptText: string,
    clients: ClientRef[] = [],
    isSmallBusiness = false
): ParsedDraft {
    const text = promptText.trim();
    let matchedClientId: string | null = null;
    let matchedClientName: string | null = null;

    for (const c of clients) {
        if (c.name && text.toLowerCase().includes(c.name.toLowerCase())) {
            matchedClientId = c.id;
            matchedClientName = c.name;
            break;
        }
    }

    if (!matchedClientName) {
        const clientMatch = text.match(
            /(?:rechnung\s+an|kunde|für|an)\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß0-9\s.&-]+?)(?:[:,;]|(?=\s+\d))/i
        );
        if (clientMatch && clientMatch[1]) {
            matchedClientName = clientMatch[1].trim();
        }
    }

    let dueDays = 14;
    const dueMatch = text.match(
        /(?:zahlbar\s+in|zahlungsziel|innerhalb\s+von|fällig\s+in)\s+(\d{1,3})\s*tagen?/i
    );
    if (dueMatch && dueMatch[1]) {
        dueDays = parseInt(dueMatch[1], 10);
    }

    let paymentTerms = `Zahlbar innerhalb von ${dueDays} Tagen ohne Abzug.`;
    const skontoMatch = text.match(/(\d+(?:[.,]\d+)?)\s*%\s*skonto/i);
    if (skontoMatch && skontoMatch[1]) {
        paymentTerms = `Zahlbar innerhalb von ${dueDays} Tagen. ${skontoMatch[1]}% Skonto bei Zahlung innerhalb von 7 Tagen.`;
    }

    const segments = text
        .replace(/^(?:rechnung\s+an|kunde|für)\s+[^:,;]+[:,;]\s*/i, "")
        .replace(
            /[,;.]?\s*(?:zahlbar\s+in|zahlungsziel|innerhalb\s+von|fällig\s+in)\s+\d{1,3}\s*tagen?.*$/i,
            ""
        )
        .split(/(?:\s+und\s+|\s*\+\s*|;\s*|\n+)/i)
        .map((s) => s.trim())
        .filter(Boolean);

    const items: DraftItem[] = [];
    const defaultTaxRate = isSmallBusiness ? 0 : 19;

    for (const seg of segments) {
        const matchA = seg.match(
            /^(\d+(?:[.,]\d+)?)\s*(std\.?|stunden?|h|tage?|t|monate?|stk\.?|stück)?\s+(.+?)\s+(?:à|a|zu(?:\s+je)?|für|je|@|-)\s*(\d+(?:[.,]\d+)?)\s*(?:€|eur|euro)?/i
        );
        if (matchA) {
            const quantity = parseFloat(matchA[1].replace(",", ".")) || 1;
            const unit = matchA[2]?.toLowerCase().startsWith("st")
                ? "Stunde"
                : matchA[2]?.toLowerCase().startsWith("tag")
                ? "Tag"
                : "Stück";
            const description = matchA[3].replace(/^[,;-]\s*/, "").trim();
            const price = parseFloat(matchA[4].replace(",", ".")) || 0;
            if (description && price > 0) {
                items.push({
                    description,
                    quantity,
                    unit_of_measure: unit,
                    price,
                    tax_rate_percent: defaultTaxRate,
                    total: quantity * price,
                });
                continue;
            }
        }

        const matchB = seg.match(
            /^(.+?)\s+(pauschal|stunde|tag|monat|stück)?\s*(\d+(?:[.,]\d+)?)\s*(?:€|eur|euro)\b/i
        );
        if (matchB) {
            const description = matchB[1].trim();
            const unit = matchB[2]
                ? matchB[2].toLowerCase().startsWith("p")
                    ? "Pauschal"
                    : "Stück"
                : "Pauschal";
            const price = parseFloat(matchB[3].replace(",", ".")) || 0;
            if (description && price > 0) {
                items.push({
                    description,
                    quantity: 1,
                    unit_of_measure: unit,
                    price,
                    tax_rate_percent: defaultTaxRate,
                    total: price,
                });
            }
        }
    }

    return {
        client_id: matchedClientId,
        client_name: matchedClientName,
        due_days: dueDays,
        payment_terms: paymentTerms,
        items,
    };
}

// ─── 5. Unified Dispatcher ────────────────────────────────────────────────────

export async function parseInvoiceDraft(
    promptText: string,
    clients: ClientRef[] = [],
    isSmallBusiness = false,
    aiSettings: Partial<AiSettings> = {}
): Promise<DraftResult> {
    const heuristic = parseInvoiceDraftHeuristic(promptText, clients, isSmallBusiness);
    const provider = aiSettings.active_provider || "ollama";

    try {
        let result: LlmResult | null = null;
        if (provider === "openai" && aiSettings.openai_key) {
            result = await parseWithOpenAi(
                promptText,
                clients,
                isSmallBusiness,
                aiSettings.openai_key,
                aiSettings.openai_model
            );
        } else if (provider === "anthropic" && aiSettings.anthropic_key) {
            result = await parseWithAnthropic(
                promptText,
                clients,
                isSmallBusiness,
                aiSettings.anthropic_key,
                aiSettings.anthropic_model
            );
        } else {
            const targetOllamaModel =
                aiSettings.ollama_model ||
                (aiSettings.selected_tier ? RECHLY_MODEL_FAMILY[aiSettings.selected_tier]?.modelIdentifier : undefined) ||
                FEATURED_MODEL;
            result = await parseWithOllama(
                promptText,
                clients,
                isSmallBusiness,
                aiSettings.ollama_host || DEFAULT_OLLAMA_HOST,
                targetOllamaModel
            );
        }

        if (result && result.parsed) {
            return {
                parsed: {
                    client_id: result.parsed.client_id || heuristic.client_id,
                    client_name: result.parsed.client_name || heuristic.client_name,
                    due_days: result.parsed.due_days || heuristic.due_days,
                    payment_terms: result.parsed.payment_terms || heuristic.payment_terms,
                    items:
                        Array.isArray(result.parsed.items) && result.parsed.items.length > 0
                            ? result.parsed.items
                            : heuristic.items,
                },
                source: result.source,
                model: result.model,
            };
        }
    } catch (err) {
        console.warn(`KI-Parsing mit ${provider} fehlgeschlagen, nutze Heuristik:`, errorMessage(err));
    }

    return {
        parsed: heuristic,
        source: "local-parser",
        model: "Rechly Heuristic Rule Engine",
    };
}
