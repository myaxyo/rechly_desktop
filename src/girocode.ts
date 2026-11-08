/** EPC069-12 transfer payload, adapted from Rechly Web (AGPL-3.0-only).
 * Validation prevents malformed or multiline payment data from reaching a QR code.
 */
export interface GirocodeInput { name: string; iban: string; bic?: string; amount: number; reference: string }
export function buildGirocodePayload(input: GirocodeInput): string | null {
    const name = input.name?.trim();
    const reference = input.reference?.trim() || "";
    const iban = input.iban?.replace(/\s/g, "").toUpperCase();
    const bic = input.bic?.replace(/\s/g, "").toUpperCase() || "";
    if (!name || name.length > 70 || reference.length > 140 || /[\u0000-\u001f\u007f]/.test(name + reference)) return null;
    if (!iban || !/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return null;
    const rearranged = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, char => String(char.charCodeAt(0) - 55));
    let remainder = 0;
    for (const digit of rearranged) remainder = (remainder * 10 + Number(digit)) % 97;
    if (remainder !== 1 || (bic && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic))) return null;
    if (!Number.isFinite(input.amount) || input.amount < 0.01 || input.amount > 999999999.99) return null;
    const payload = ["BCD", "002", "1", "SCT", bic, name, iban, `EUR${input.amount.toFixed(2)}`, "", "", reference].join("\n");
    return new TextEncoder().encode(payload).length <= 331 ? payload : null;
}
