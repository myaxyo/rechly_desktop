/**
 * Rechly Desktop AI Engine
 * Supports:
 * 1. Local On-Device Ollama (featuring jonprompter/Rechly-DE-3B)
 * 2. OpenAI Cloud API (GPT-4o-mini, GPT-4o, etc.)
 * 3. Anthropic Claude Cloud API (Claude 3.5 Sonnet, Claude 3.5 Haiku)
 * 4. Deterministic German Regex / Rule-Based Heuristic Fallback
 */

const http = require("http");
const https = require("https");
const { URL } = require("url");

const DEFAULT_OLLAMA_HOST = "http://localhost:11434";
const FEATURED_MODEL = "jonprompter/Rechly-DE-3B";
const OLLAMA_URL = "https://ollama.com/jonprompter/Rechly-DE-3B";
const HF_URL = "https://huggingface.co/jonprompter/rechly-de-3b";

function makeHttpRequest(urlString, options = {}, postData = null) {
    return new Promise((resolve, reject) => {
        try {
            const parsed = new URL(urlString);
            const client = parsed.protocol === "https:" ? https : http;
            const reqOptions = {
                hostname: parsed.hostname,
                port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
                path: parsed.pathname + parsed.search,
                method: options.method || "GET",
                headers: options.headers || {},
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

            if (postData) {
                req.write(typeof postData === "string" ? postData : JSON.stringify(postData));
            }
            req.end();
        } catch (err) {
            reject(err);
        }
    });
}

// ─── 1. Ollama (Local) ────────────────────────────────────────────────────────

async function checkOllama(host = DEFAULT_OLLAMA_HOST) {
    try {
        const res = await makeHttpRequest(`${host}/api/tags`);
        if (res.status === 200) {
            const data = JSON.parse(res.body);
            const models = (data.models || []).map((m) => m.name);
            const hasFeatured = models.some(
                (m) =>
                    m.toLowerCase().includes("rechly") ||
                    m.toLowerCase() === FEATURED_MODEL.toLowerCase()
            );
            return {
                connected: true,
                models,
                hasFeaturedModel: hasFeatured,
                featuredModelName: FEATURED_MODEL,
                ollamaUrl: OLLAMA_URL,
                hfUrl: HF_URL,
            };
        }
        return { connected: false, error: `HTTP ${res.status}` };
    } catch (err) {
        return {
            connected: false,
            error: err.message,
            featuredModelName: FEATURED_MODEL,
            ollamaUrl: OLLAMA_URL,
            hfUrl: HF_URL,
        };
    }
}

async function parseWithOllama(promptText, clients, isSmallBusiness, host, model) {
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
        const data = JSON.parse(res.body);
        const parsed = JSON.parse(data.response);
        return { parsed, source: "ollama", model: targetModel };
    }
    throw new Error(`Ollama antwortete mit Status ${res.status}`);
}

// ─── 2. OpenAI Cloud API ──────────────────────────────────────────────────────

async function testOpenAi(apiKey, model = "gpt-4o-mini") {
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
        return { success: false, error: err.message };
    }
}

async function parseWithOpenAi(promptText, clients, isSmallBusiness, apiKey, model = "gpt-4o-mini") {
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
        const data = JSON.parse(res.body);
        const text = data.choices[0].message.content;
        const parsed = JSON.parse(text);
        return { parsed, source: "openai", model: model || "gpt-4o-mini" };
    }
    throw new Error(`OpenAI API Fehler: HTTP ${res.status} - ${res.body}`);
}

// ─── 3. Anthropic Claude Cloud API ────────────────────────────────────────────

async function testAnthropic(apiKey, model = "claude-3-5-sonnet-20241022") {
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
        return { success: false, error: err.message };
    }
}

async function parseWithAnthropic(
    promptText,
    clients,
    isSmallBusiness,
    apiKey,
    model = "claude-3-5-sonnet-20241022"
) {
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
        const data = JSON.parse(res.body);
        let text = data.content?.[0]?.text || "{}";
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(text);
        return { parsed, source: "anthropic", model: model || "claude-3-5-sonnet" };
    }
    throw new Error(`Anthropic API Fehler: HTTP ${res.status} - ${res.body}`);
}

// ─── 4. Deterministic German Regex Fallback ───────────────────────────────────

function parseInvoiceDraftHeuristic(promptText, clients = [], isSmallBusiness = false) {
    const text = promptText.trim();
    let matchedClientId = null;
    let matchedClientName = null;

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

    const items = [];
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

async function parseInvoiceDraft(
    promptText,
    clients = [],
    isSmallBusiness = false,
    aiSettings = {}
) {
    const heuristic = parseInvoiceDraftHeuristic(promptText, clients, isSmallBusiness);
    const provider = aiSettings.active_provider || "ollama";

    try {
        let result = null;
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
            // Ollama default (featuring jonprompter/Rechly-DE-3B)
            result = await parseWithOllama(
                promptText,
                clients,
                isSmallBusiness,
                aiSettings.ollama_host || DEFAULT_OLLAMA_HOST,
                aiSettings.ollama_model || FEATURED_MODEL
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
        console.warn(`KI-Parsing mit ${provider} fehlgeschlagen, nutze Heuristik:`, err.message);
    }

    return {
        parsed: heuristic,
        source: "local-parser",
        model: "Rechly Heuristic Rule Engine",
    };
}

module.exports = {
    checkOllama,
    testOpenAi,
    testAnthropic,
    parseInvoiceDraft,
    FEATURED_MODEL,
    OLLAMA_URL,
    HF_URL,
};
