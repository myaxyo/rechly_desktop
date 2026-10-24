/**
 * Rechly Desktop Local AI Engine
 * Directly communicates with local Ollama on http://localhost:11434
 * Features the official model: jonprompter/Rechly-DE-3B
 */

const http = require("http");
const { URL } = require("url");

const DEFAULT_HOST = "http://localhost:11434";
const FEATURED_MODEL = "jonprompter/Rechly-DE-3B";
const OLLAMA_URL = "https://ollama.com/jonprompter/Rechly-DE-3B";
const HF_URL = "https://huggingface.co/jonprompter/rechly-de-3b";

function makeRequest(urlString, options = {}, postData = null) {
    return new Promise((resolve, reject) => {
        try {
            const parsed = new URL(urlString);
            const reqOptions = {
                hostname: parsed.hostname,
                port: parsed.port || 80,
                path: parsed.pathname + parsed.search,
                method: options.method || "GET",
                headers: options.headers || {},
                timeout: 10000,
            };

            const req = http.request(reqOptions, (res) => {
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
                reject(new Error("Timeout connecting to Ollama"));
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

async function checkOllama(host = DEFAULT_HOST) {
    try {
        const res = await makeRequest(`${host}/api/tags`);
        if (res.status === 200) {
            const data = JSON.parse(res.body);
            const models = (data.models || []).map((m) => m.name);
            const hasFeatured = models.some((m) =>
                m.toLowerCase().includes("rechly") || m === FEATURED_MODEL.toLowerCase()
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
        return { connected: false, error: `Status ${res.status}` };
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

/**
 * Deterministic German invoice parser (heuristic fallback)
 */
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
        const clientMatch = text.match(/(?:rechnung\s+an|kunde|für|an)\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß0-9\s.&-]+?)(?:[:,;]|(?=\s+\d))/i);
        if (clientMatch && clientMatch[1]) {
            matchedClientName = clientMatch[1].trim();
        }
    }

    let dueDays = 14;
    const dueMatch = text.match(/(?:zahlbar\s+in|zahlungsziel|innerhalb\s+von|fällig\s+in)\s+(\d{1,3})\s*tagen?/i);
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
        .replace(/[,;.]?\s*(?:zahlbar\s+in|zahlungsziel|innerhalb\s+von|fällig\s+in)\s+\d{1,3}\s*tagen?.*$/i, "")
        .split(/(?:\s+und\s+|\s*\+\s*|;\s*|\n+)/i)
        .map((s) => s.trim())
        .filter(Boolean);

    const items = [];
    const defaultTaxRate = isSmallBusiness ? 0 : 19;

    for (const seg of segments) {
        const matchA = seg.match(/^(\d+(?:[.,]\d+)?)\s*(std\.?|stunden?|h|tage?|t|monate?|stk\.?|stück)?\s+(.+?)\s+(?:à|a|zu(?:\s+je)?|für|je|@|-)\s*(\d+(?:[.,]\d+)?)\s*(?:€|eur|euro)?/i);
        if (matchA) {
            const quantity = parseFloat(matchA[1].replace(",", ".")) || 1;
            const unit = matchA[2]?.toLowerCase().startsWith("st") ? "Stunde" : matchA[2]?.toLowerCase().startsWith("tag") ? "Tag" : "Stück";
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

        const matchB = seg.match(/^(.+?)\s+(pauschal|stunde|tag|monat|stück)?\s*(\d+(?:[.,]\d+)?)\s*(?:€|eur|euro)\b/i);
        if (matchB) {
            const description = matchB[1].trim();
            const unit = matchB[2] ? (matchB[2].toLowerCase().startsWith("p") ? "Pauschal" : "Stück") : "Pauschal";
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

async function parseInvoiceDraft(promptText, clients = [], isSmallBusiness = false, host = DEFAULT_HOST, model = FEATURED_MODEL) {
    const heuristic = parseInvoiceDraftHeuristic(promptText, clients, isSmallBusiness);

    try {
        const clientList = clients.slice(0, 25).map((c) => `- ID: "${c.id}", Name: "${c.name}"`).join("\n");
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

        const res = await makeRequest(
            `${host}/api/generate`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            },
            {
                model,
                prompt,
                stream: false,
                format: "json",
            }
        );

        if (res.status === 200) {
            const data = JSON.parse(res.body);
            const responseText = data.response;
            const parsed = JSON.parse(responseText);
            return {
                parsed: {
                    client_id: parsed.client_id || heuristic.client_id,
                    client_name: parsed.client_name || heuristic.client_name,
                    due_days: parsed.due_days || heuristic.due_days,
                    payment_terms: parsed.payment_terms || heuristic.payment_terms,
                    items: Array.isArray(parsed.items) && parsed.items.length > 0 ? parsed.items : heuristic.items,
                },
                source: "ollama",
                model,
            };
        }
    } catch (err) {
        console.warn("Local Ollama parse failed, using heuristic:", err.message);
    }

    return {
        parsed: heuristic,
        source: "local-parser",
        model: "Rechly Heuristic Rule Engine",
    };
}

module.exports = {
    checkOllama,
    parseInvoiceDraft,
    FEATURED_MODEL,
    OLLAMA_URL,
    HF_URL,
};
