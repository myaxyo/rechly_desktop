import type { Invoice, InvoiceItem } from './types';

const cents = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const validDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

/** Validate persisted invoices and compute authoritative totals from their positions. */
export function validateInvoice(invoice: Invoice, existing: Invoice[], clientIds: string[]): Invoice {
    const number = invoice.invoice_number?.trim();
    if (!number) throw new Error('Eine Rechnungsnummer ist erforderlich.');
    if (existing.some(i => i.id !== invoice.id && i.invoice_number?.trim() === number)) throw new Error('Diese Rechnungsnummer ist bereits vergeben.');
    if (!invoice.client_id || !clientIds.includes(invoice.client_id)) throw new Error('Bitte wählen Sie einen vorhandenen Kunden aus.');
    if (!validDate(invoice.issue_date) || !validDate(invoice.due_date) || invoice.due_date < invoice.issue_date) throw new Error('Rechnungsdatum und Fälligkeit sind ungültig.');
    if (!['draft', 'sent', 'paid'].includes(invoice.status || '')) throw new Error('Ungültiger Rechnungsstatus.');
    if (!Array.isArray(invoice.items) || !invoice.items.length) throw new Error('Mindestens eine Position ist erforderlich.');
    let subtotal = 0;
    let vat = 0;
    const items = invoice.items.map((item: InvoiceItem) => {
        const tax = item.tax_rate_percent ?? 0;
        const discount = item.discount_percent ?? 0;
        if (!item.description?.trim() || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.price) || item.price < 0 || !Number.isFinite(tax) || tax < 0 || tax > 100 || !Number.isFinite(discount) || discount < 0 || discount > 100) throw new Error('Bitte prüfen Sie Beschreibung, Menge, Preis und Steuersatz jeder Position.');
        const total = cents(item.quantity * item.price * (1 - discount / 100));
        if (!Number.isSafeInteger(Math.round(total * 100))) throw new Error('Der Positionsbetrag ist zu groß.');
        subtotal += total;
        vat += cents(total * tax / 100);
        return { ...item, description: item.description.trim(), total };
    });
    if (!Number.isSafeInteger(Math.round((subtotal + vat) * 100))) throw new Error('Der Rechnungsbetrag ist zu groß.');
    return { ...invoice, invoice_number: number, items, subtotal: cents(subtotal), total_vat: cents(vat), total_gross: cents(subtotal + vat) };
}
