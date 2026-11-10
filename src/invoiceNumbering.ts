import type { Company, Invoice, StoreData } from "./types";

export const DEFAULT_INVOICE_PATTERN = "RE-{YYYY}-{###}";

/**
 * Formats an invoice number based on a template pattern, sequential counter, and date.
 * Supported tokens:
 *   {YYYY} - 4-digit year (e.g. 2026)
 *   {YY}   - 2-digit year (e.g. 26)
 *   {MM}   - 2-digit month (01-12)
 *   {DD}   - 2-digit day (01-31)
 *   {###}  - Zero-padded counter (number of '#' determines padding width, min 1)
 *   {NR} / {COUNTER} - Unpadded counter
 */
export function formatInvoiceNumber(
    pattern: string = DEFAULT_INVOICE_PATTERN,
    counter: number = 1,
    date: Date = new Date()
): string {
    const cleanPattern = (pattern || DEFAULT_INVOICE_PATTERN).trim();
    const year = date.getFullYear();
    const yy = String(year).slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    let result = cleanPattern
        .replace(/\{YYYY\}/g, String(year))
        .replace(/\{YY\}/g, yy)
        .replace(/\{MM\}/g, month)
        .replace(/\{DD\}/g, day);

    const hashMatch = result.match(/\{(#+)\}/);
    if (hashMatch) {
        const width = hashMatch[1].length;
        result = result.replace(hashMatch[0], String(counter).padStart(width, "0"));
    } else if (/\{NR\}|\{COUNTER\}/i.test(result)) {
        result = result.replace(/\{NR\}|\{COUNTER\}/gi, String(counter));
    } else {
        // If no counter placeholder exists, append standard 3-digit padded counter
        const sep = result.endsWith("-") || result.endsWith("/") ? "" : "-";
        result = `${result}${sep}${String(counter).padStart(3, "0")}`;
    }

    return result;
}

/**
 * Escapes characters for regex usage.
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a regex from a pattern to extract counter numbers from existing invoice numbers.
 */
function buildPatternRegex(pattern: string, year?: number): RegExp {
    const cleanPattern = (pattern || DEFAULT_INVOICE_PATTERN).trim();
    const yr = year !== undefined ? String(year) : "\\d{4}";
    const yy = year !== undefined ? String(year).slice(-2) : "\\d{2}";

    let regexStr = escapeRegex(cleanPattern)
        .replace(/\\\{YYYY\\\}/g, yr)
        .replace(/\\\{YY\\\}/g, yy)
        .replace(/\\\{MM\\\}/g, "\\d{2}")
        .replace(/\\\{DD\\\}/g, "\\d{2}")
        .replace(/\\\{#+\\\}/g, "(\\d+)")
        .replace(/\\\{NR\\\}|\\\{COUNTER\\\}/gi, "(\\d+)");

    if (!regexStr.includes("(\\d+)")) {
        // Fallback appended counter
        regexStr = `${regexStr}[-/]?(\\d+)`;
    }

    return new RegExp(`^${regexStr}$`);
}

/**
 * Extracts the integer counter from an invoice number if it matches the pattern.
 */
export function parseInvoiceNumberCounter(
    pattern: string,
    invoiceNumber: string,
    year?: number
): number | null {
    if (!invoiceNumber || typeof invoiceNumber !== "string") return null;
    const trimmed = invoiceNumber.trim();
    const regex = buildPatternRegex(pattern, year);
    const match = trimmed.match(regex);
    if (match && match[1]) {
        const num = parseInt(match[1], 10);
        return Number.isSafeInteger(num) && num > 0 ? num : null;
    }
    return null;
}

/**
 * Scans existing invoices and returns the highest counter value for the current pattern.
 */
export function getMaxExistingCounter(
    invoices: Array<Pick<Invoice, "invoice_number">>,
    pattern: string,
    year?: number
): number {
    let max = 0;
    for (const inv of invoices) {
        if (!inv.invoice_number) continue;
        const count = parseInvoiceNumberCounter(pattern, inv.invoice_number, year);
        if (count !== null && count > max) {
            max = count;
        }
        // Also check default RE-{YYYY}-{###} pattern as fallback so historical invoices count
        if (pattern !== DEFAULT_INVOICE_PATTERN) {
            const fallbackCount = parseInvoiceNumberCounter(DEFAULT_INVOICE_PATTERN, inv.invoice_number, year);
            if (fallbackCount !== null && fallbackCount > max) {
                max = fallbackCount;
            }
        }
    }
    return max;
}

/**
 * Computes the next gapless, sequential invoice number.
 * GoBD-compliant: Guarantees sequential non-overlapping counter values by inspecting
 * existing invoice numbers and the configured company counter.
 */
export function getNextInvoiceNumber(
    data: { company?: Company; invoices?: Invoice[] },
    date: Date = new Date(),
    year?: number
): string {
    const pattern = data.company?.invoice_number_pattern || data.company?.invoice_number_prefix || DEFAULT_INVOICE_PATTERN;
    const targetYear = year ?? date.getFullYear();
    const maxExisting = getMaxExistingCounter(data.invoices || [], pattern, targetYear);
    const configuredCounter = data.company?.next_invoice_number ?? data.company?.nextInvoiceNumber ?? 1;
    const nextCounter = Math.max(configuredCounter, maxExisting + 1);

    return formatInvoiceNumber(pattern, nextCounter, date);
}

/**
 * Advances the counter on the company object if the used invoice number matches the pattern.
 */
export function advanceInvoiceNumberCounter(
    company: Company,
    usedNumber: string,
    pattern: string = company.invoice_number_pattern || DEFAULT_INVOICE_PATTERN,
    year?: number
): boolean {
    const count = parseInvoiceNumberCounter(pattern, usedNumber, year);
    if (count !== null) {
        const next = Math.max((company.next_invoice_number ?? company.nextInvoiceNumber ?? 1), count + 1);
        company.next_invoice_number = next;
        company.nextInvoiceNumber = next;
        return true;
    }
    return false;
}
