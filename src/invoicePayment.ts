import QRCode from "qrcode";
import { buildGirocodePayload } from "./girocode";
import type { Company, Invoice } from "./types";

/** No network calls: the code is generated locally and contains only transfer details. */
export async function invoicePaymentQr(invoice: Invoice, company: Company): Promise<string | null> {
    if (!company.show_payment_qr || invoice.status === "paid") return null;
    const payload = buildGirocodePayload({ name: company.name || "", iban: company.bank_iban || "", bic: company.bank_bic, amount: invoice.total_gross ?? 0, reference: `Rechnung ${invoice.invoice_number || invoice.id}` });
    return payload ? QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 4, width: 220 }) : null;
}
