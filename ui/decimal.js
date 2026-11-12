/** Parse decimal user input without dropping a comma or truncating invalid text.
 * A lone dot or comma is a decimal separator. Grouping is accepted only when
 * both separators are present, e.g. 1.234,56 or 1,234.56.
 */
function parseDecimalInput(value) {
    let text = (value ?? "").trim().replace(/\s*€$/, "").trim();
    if (!text) return NaN;
    if (/^[+-]?\d{1,3}(?:\.\d{3})+,\d*$/.test(text)) text = text.replace(/\./g, "").replace(",", ".");
    else if (/^[+-]?\d{1,3}(?:,\d{3})+\.\d*$/.test(text)) text = text.replace(/,/g, "");
    else if (/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text)) text = text.replace(",", ".");
    else return NaN;
    const number = Number(text);
    return Number.isFinite(number) ? number : NaN;
}

if (typeof module !== "undefined") module.exports = { parseDecimalInput };
