/**
 * Rechly Desktop Offline E-Rechnung & DATEV Engine
 * 100% On-Device XML and CSV Generation without any external dependencies.
 */

import type { Client, Company, Invoice } from "./types";

function escapeXml(unsafe: string | number | null | undefined): string {
    if (!unsafe) return "";
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

const UNIT_CODES: Record<string, string> = {
    stück: "H87", stueck: "H87", stk: "H87", piece: "H87", h87: "H87",
    stunde: "HUR", stunden: "HUR", std: "HUR", h: "HUR", hur: "HUR",
    tag: "DAY", tage: "DAY", day: "DAY",
    monat: "MON", monate: "MON", month: "MON",
    pauschal: "LS", pauschale: "LS", flat: "LS", ls: "LS",
    kg: "KGM", liter: "LTR", l: "LTR", "m²": "MTK", m2: "MTK", m: "MTR",
};

function unitCode(unit: string | undefined): string {
    const key = (unit || "").trim().replace(/\.$/, "").toLowerCase();
    return UNIT_CODES[key] || "C62";
}

function countryCode(country: string | undefined): string {
    const c = (country || "DE").trim();
    if (/^[A-Za-z]{2}$/.test(c)) return c.toUpperCase();
    if (c.toLowerCase() === "deutschland") return "DE";
    if (c.toLowerCase() === "österreich" || c.toLowerCase() === "austria") return "AT";
    if (c.toLowerCase() === "schweiz" || c.toLowerCase() === "switzerland") return "CH";
    return "DE";
}

/**
 * Generates EN 16931 / XRechnung 3.0 valid CII XML
 */
export function generateXRechnungXML(
    invoice: Invoice,
    company: Company,
    client: Partial<Client>
): string {
    const issueDate = (invoice.issue_date || new Date().toISOString())
        .slice(0, 10)
        .replace(/-/g, "");
    const dueDate = invoice.due_date
        ? invoice.due_date.slice(0, 10).replace(/-/g, "")
        : "";
    const deliveryDate = (invoice.delivery_date || invoice.issue_date || new Date().toISOString())
        .slice(0, 10)
        .replace(/-/g, "");

    const iban = (company.bank_iban || "").replace(/\s+/g, "");
    const bic = (company.bank_bic || "").replace(/\s+/g, "");

    const paymentMeansXml = iban
        ? `<ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${escapeXml(iban)}</ram:IBANID>
          <ram:AccountName>${escapeXml(company.name)}</ram:AccountName>
        </ram:PayeePartyCreditorFinancialAccount>
        ${bic ? `<ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>${escapeXml(bic)}</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>` : ""}
      </ram:SpecifiedTradeSettlementPaymentMeans>`
        : `<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>1</ram:TypeCode></ram:SpecifiedTradeSettlementPaymentMeans>`;

    const termsText = invoice.payment_terms || company.payment_terms_default || "";
    const paymentTermsXml =
        dueDate || termsText
            ? `<ram:SpecifiedTradePaymentTerms>${termsText ? `<ram:Description>${escapeXml(termsText)}</ram:Description>` : ""}${dueDate ? `<ram:DueDateDateTime><udt:DateTimeString format="102">${dueDate}</udt:DateTimeString></ram:DueDateDateTime>` : ""}</ram:SpecifiedTradePaymentTerms>`
            : "";

    // Line items
    const lineItemsXml = (invoice.items || []).map((item, index) => {
        const lineNet = item.quantity * item.price * (1 - (item.discount_percent || 0) / 100);
        const vatRate = company.is_small_business ? 0 : (item.tax_rate_percent || 19);
        const vatCategory = company.is_small_business ? "E" : (vatRate === 0 ? "Z" : "S");

        return `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${index + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${escapeXml(item.description)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${item.price.toFixed(2)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${unitCode(item.unit_of_measure)}">${item.quantity.toFixed(2)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${vatCategory}</ram:CategoryCode>
          <ram:RateApplicablePercent>${vatRate}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${lineNet.toFixed(2)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
    }).join("");

    const buyerReference = client.leitweg_id
        ? `<ram:BuyerReference>${escapeXml(client.leitweg_id)}</ram:BuyerReference>`
        : `<ram:BuyerReference>N/A</ram:BuyerReference>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">

  <rsm:ExchangedDocumentContext>
    <ram:BusinessProcessSpecifiedDocumentContextParameter>
      <ram:ID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</ram:ID>
    </ram:BusinessProcessSpecifiedDocumentContextParameter>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(invoice.invoice_number)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${issueDate}</udt:DateTimeString>
    </ram:IssueDateTime>
    ${invoice.notes ? `<ram:IncludedNote><ram:Content>${escapeXml(invoice.notes)}</ram:Content></ram:IncludedNote>` : ""}
  </rsm:ExchangedDocument>

  <rsm:SupplyChainTradeTransaction>
    ${lineItemsXml}

    <ram:ApplicableHeaderTradeAgreement>
      ${buyerReference}

      <ram:SellerTradeParty>
        <ram:Name>${escapeXml(company.name)}</ram:Name>
        <ram:DefinedTradeContact>
          <ram:PersonName>${escapeXml(company.name)}</ram:PersonName>
          ${company.phone ? `<ram:TelephoneUniversalCommunication><ram:CompleteNumber>${escapeXml(company.phone)}</ram:CompleteNumber></ram:TelephoneUniversalCommunication>` : ""}
          ${company.email ? `<ram:EmailURIUniversalCommunication><ram:URIID>${escapeXml(company.email)}</ram:URIID></ram:EmailURIUniversalCommunication>` : ""}
        </ram:DefinedTradeContact>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${escapeXml(company.postal_code || "")}</ram:PostcodeCode>
          <ram:LineOne>${escapeXml(company.address_line1 || "")}</ram:LineOne>
          <ram:CityName>${escapeXml(company.city || "")}</ram:CityName>
          <ram:CountryID>${countryCode(company.country)}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${company.vat_id ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${escapeXml(company.vat_id)}</ram:ID></ram:SpecifiedTaxRegistration>` : ""}
        ${company.tax_number ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${escapeXml(company.tax_number)}</ram:ID></ram:SpecifiedTaxRegistration>` : ""}
      </ram:SellerTradeParty>

      <ram:BuyerTradeParty>
        <ram:Name>${escapeXml(client.name)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${escapeXml(client.postal_code || "")}</ram:PostcodeCode>
          <ram:LineOne>${escapeXml(client.address_line1 || "")}</ram:LineOne>
          <ram:CityName>${escapeXml(client.city || "")}</ram:CityName>
          <ram:CountryID>${countryCode(client.country)}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${client.email ? `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${escapeXml(client.email)}</ram:URIID></ram:URIUniversalCommunication>` : ""}
        ${client.vat_id ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${escapeXml(client.vat_id)}</ram:ID></ram:SpecifiedTaxRegistration>` : ""}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>

    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${deliveryDate}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>

    <ram:ApplicableHeaderTradeSettlement>
      <ram:PaymentReference>${escapeXml(invoice.invoice_number)}</ram:PaymentReference>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      ${paymentMeansXml}
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${(invoice.total_vat || 0).toFixed(2)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${(invoice.subtotal || 0).toFixed(2)}</ram:BasisAmount>
        <ram:CategoryCode>${company.is_small_business ? "E" : "S"}</ram:CategoryCode>
        <ram:RateApplicablePercent>${company.is_small_business ? 0 : 19}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      ${paymentTermsXml}

      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${(invoice.subtotal || 0).toFixed(2)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${(invoice.subtotal || 0).toFixed(2)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${(invoice.total_vat || 0).toFixed(2)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${(invoice.total_gross || 0).toFixed(2)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${(invoice.total_gross || 0).toFixed(2)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

/**
 * Generates DATEV-compliant ASCII / CSV export for German tax advisors
 */
export function generateDatevExport(invoices: Invoice[], company: Company): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    
    // Header record (DATEV Format EXTF 700)
    const header = [
        `"EXTF"`, 700, 21, `"Buchungsstapel"`, 1,
        `"${today}"`, `""`, `""`, `"RECHLY DESKTOP"`, `""`,
        `"${(company.name || "").slice(0, 25)}"`, `""`, 10000, 99999,
        `"${today.slice(0, 4)}0101"`, 4, `"WJ Beginn"`, `""`, 0, 0, `"EUR"`
    ].join(";");

    // Column definitions
    const columns = [
        "Umsatz (ohne Soll/Haben-Kz)",
        "Soll/Haben-Kennzeichen",
        "WKZ",
        "Konto",
        "Gegenkonto",
        "BU-Schlüssel",
        "Belegdatum",
        "Belegfeld 1",
        "Buchungstext",
        "Festschreibung"
    ].map(c => `"${c}"`).join(";");

    const rows = invoices.map(inv => {
        const amount = (inv.total_gross || 0).toFixed(2).replace(".", ",");
        const date = (inv.issue_date || "").slice(0, 10).replace(/-/g, "").slice(4); // MMDD
        const invNum = (inv.invoice_number || "").slice(0, 36);
        const text = `Rechnung ${invNum}`.slice(0, 60);

        // Standard SKR03: Erlöskonto 8400 (19% USt) or 8195 (Kleinunternehmer), Gegenkonto 10000 (Forderungen)
        const revenueAccount = company.is_small_business ? "8195" : "8400";
        const debtorAccount = "10000";

        return [
            amount,
            `"S"`,
            `"EUR"`,
            debtorAccount,
            revenueAccount,
            `""`,
            date,
            `"${invNum}"`,
            `"${text}"`,
            "1"
        ].join(";");
    });

    return [header, columns, ...rows].join("\r\n");
}
