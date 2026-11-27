const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PDFDocument, PDFName } = require('pdf-lib');
const { generateXRechnungXML, generateZugferdXML, generateDatevExport, eInvoiceSellerIdentifierWarning } = require('../out/eRechnung');
const { createZugferdPdf } = require('../out/zugferdPdf');
const { extractXmlFromPdf, parseEInvoiceXmlForMigration } = require('../out/migration');
const { readLoadedUiSource } = require('./readUiSource.cjs');
const { assertCiiXsd, xmllintAvailable } = require('./ciiXsd.cjs');

const mockCompany = {
    name: "Musterberater GmbH",
    legal_form: "GmbH",
    address_line1: "Hauptstraße 10",
    postal_code: "10115",
    city: "Berlin",
    country: "DE",
    email: "rechnung@musterberater.de",
    phone: "+49 30 1234567",
    vat_id: "DE123456789",
    tax_number: "21/123/45678",
    bank_name: "Berliner Sparkasse",
    bank_iban: "DE89370400440532013000",
    bank_bic: "BELADEBEXXX",
    is_small_business: false
};

const mockClient = {
    id: "c1",
    name: "Kunden AG",
    address_line1: "Kundenweg 5",
    postal_code: "80331",
    city: "München",
    country: "DE",
    email: "buchhaltung@kunden-ag.de",
    vat_id: "DE987654321",
    leitweg_id: "991-12345-73"
};

const mockInvoice = {
    id: "inv-1",
    invoice_number: "RE-2026-001",
    issue_date: "2026-11-06",
    due_date: "2026-11-20",
    delivery_date: "2026-11-06",
    payment_terms: "Zahlbar innerhalb von 14 Tagen",
    subtotal: 1000.00,
    total_vat: 190.00,
    total_gross: 1190.00,
    items: [
        {
            description: "Softwareberatung",
            quantity: 10,
            unit_of_measure: "stunde",
            price: 100.00,
            tax_rate_percent: 19
        }
    ]
};

test('generateXRechnungXML includes BT-34 seller electronic address with schemeID="EM" (PEPPOL-EN16931-R020)', () => {
    const xml = generateXRechnungXML(mockInvoice, mockCompany, mockClient);

    // Verify SellerTradeParty contains URIUniversalCommunication with schemeID="EM" (BT-34)
    assert.ok(
        xml.includes('<ram:SellerTradeParty>'),
        'Must contain SellerTradeParty'
    );
    assert.ok(
        xml.includes('<ram:URIUniversalCommunication><ram:URIID schemeID="EM">rechnung@musterberater.de</ram:URIID></ram:URIUniversalCommunication>'),
        'Must emit BT-34 URIUniversalCommunication with schemeID="EM" under SellerTradeParty'
    );

    // Verify DefinedTradeContact also retains BT-43 contact email
    assert.ok(
        xml.includes('<ram:EmailURIUniversalCommunication><ram:URIID>rechnung@musterberater.de</ram:URIID></ram:EmailURIUniversalCommunication>'),
        'Must retain BT-43 contact email in DefinedTradeContact'
    );

    // Verify schema order: PostalTradeAddress -> URIUniversalCommunication -> SpecifiedTaxRegistration
    const sellerIdx = xml.indexOf('<ram:SellerTradeParty>');
    const sellerEndIdx = xml.indexOf('</ram:SellerTradeParty>');
    const sellerSection = xml.slice(sellerIdx, sellerEndIdx);

    const contactPos = sellerSection.indexOf('<ram:DefinedTradeContact>');
    const addressPos = sellerSection.indexOf('<ram:PostalTradeAddress>');
    const electronicPos = sellerSection.indexOf('<ram:URIUniversalCommunication>');
    const taxPos = sellerSection.indexOf('<ram:SpecifiedTaxRegistration>');

    assert.ok(contactPos < addressPos, 'DefinedTradeContact must precede PostalTradeAddress');
    assert.ok(addressPos < electronicPos, 'PostalTradeAddress must precede URIUniversalCommunication');
    assert.ok(electronicPos < taxPos, 'URIUniversalCommunication must precede SpecifiedTaxRegistration');
});

test('generateXRechnungXML falls back to VAT ID with schemeID="9930" if company email is absent', () => {
    const companyWithoutEmail = { ...mockCompany, email: undefined };
    const xml = generateXRechnungXML(mockInvoice, companyWithoutEmail, mockClient);

    const sellerIdx = xml.indexOf('<ram:SellerTradeParty>');
    const sellerEndIdx = xml.indexOf('</ram:SellerTradeParty>');
    const sellerSection = xml.slice(sellerIdx, sellerEndIdx);

    assert.ok(
        sellerSection.includes('<ram:URIUniversalCommunication><ram:URIID schemeID="9930">DE123456789</ram:URIID></ram:URIUniversalCommunication>'),
        'Must fallback to schemeID="9930" when email is missing'
    );
});

test('generateXRechnungXML handles BuyerTradeParty electronic address and Leitweg-ID (BT-49 and BT-10)', () => {
    const xml = generateXRechnungXML(mockInvoice, mockCompany, mockClient);

    // BT-10 BuyerReference
    assert.ok(xml.includes('<ram:BuyerReference>991-12345-73</ram:BuyerReference>'));

    // BT-49 Buyer electronic address
    const buyerIdx = xml.indexOf('<ram:BuyerTradeParty>');
    const buyerEndIdx = xml.indexOf('</ram:BuyerTradeParty>');
    const buyerSection = xml.slice(buyerIdx, buyerEndIdx);

    assert.ok(
        buyerSection.includes('<ram:URIUniversalCommunication><ram:URIID schemeID="EM">buchhaltung@kunden-ag.de</ram:URIID></ram:URIUniversalCommunication>'),
        'Must emit BT-49 buyer electronic address'
    );
});

test('generateXRechnungXML falls back to Leitweg-ID with schemeID="0204" for buyer if email is absent', () => {
    const clientWithoutEmail = { ...mockClient, email: undefined };
    const xml = generateXRechnungXML(mockInvoice, mockCompany, clientWithoutEmail);

    const buyerIdx = xml.indexOf('<ram:BuyerTradeParty>');
    const buyerEndIdx = xml.indexOf('</ram:BuyerTradeParty>');
    const buyerSection = xml.slice(buyerIdx, buyerEndIdx);

    assert.ok(
        buyerSection.includes('<ram:URIUniversalCommunication><ram:URIID schemeID="0204">991-12345-73</ram:URIID></ram:URIUniversalCommunication>'),
        'Must fallback to schemeID="0204" with Leitweg-ID for buyer BT-49'
    );
});

test('generateDatevExport outputs valid EXTF 700 header and SKR03 transaction rows', () => {
    const csv = generateDatevExport([mockInvoice], mockCompany);
    assert.ok(csv.startsWith('"EXTF";700;21;"Buchungsstapel"'));
    assert.ok(csv.includes('"Musterberater GmbH"'));
    assert.ok(csv.includes('1190,00;"S";"EUR";10000;8400;'));
    assert.ok(csv.includes('"RE-2026-001"'));
});

test('discounted prices, explicit zero VAT and mixed rates agree with line totals', () => {
    const xml = generateXRechnungXML({ ...mockInvoice, subtotal: 240, total_vat: 20.6, total_gross: 260.6, items: [
        { description: 'Discounted', quantity: 2, price: 50, discount_percent: 10, tax_rate_percent: 19 },
        { description: 'Reduced', quantity: 1, price: 50, tax_rate_percent: 7 },
        { description: 'Zero', quantity: 1, price: 100, tax_rate_percent: 0 },
    ] }, mockCompany, mockClient);
    assert.match(xml, /<ram:ChargeAmount>45\.000000<\/ram:ChargeAmount>/);
    assert.match(xml, /<ram:LineTotalAmount>90\.00<\/ram:LineTotalAmount>/);
    const settlement = xml.slice(xml.indexOf('<ram:ApplicableHeaderTradeSettlement>'));
    assert.equal((settlement.match(/<ram:ApplicableTradeTax>/g) || []).length, 3);
    assert.match(settlement, /<ram:CalculatedAmount>17\.10<\/ram:CalculatedAmount>/);
    assert.match(settlement, /<ram:CalculatedAmount>3\.50<\/ram:CalculatedAmount>/);
    assert.match(settlement, /<ram:CategoryCode>Z<\/ram:CategoryCode>/);
    assert.match(settlement, /<ram:RateApplicablePercent>0<\/ram:RateApplicablePercent>/);
});

test('small business export explains its VAT exemption', () => {
    const xml = generateXRechnungXML({ ...mockInvoice, total_vat: 0, total_gross: 1000 }, { ...mockCompany, is_small_business: true }, mockClient);
    assert.match(xml, /<ram:ExemptionReason>Gemäß § 19 UStG/);
    assert.match(xml, /<ram:CategoryCode>E<\/ram:CategoryCode>/);
});

test('generateZugferdXML emits Factur-X / ZUGFeRD 2.3 EN 16931 profile and omits N/A BuyerReference when leitweg_id is absent', () => {
    const xmlNoLeitweg = generateZugferdXML(mockInvoice, mockCompany, { ...mockClient, leitweg_id: undefined });
    assert.ok(xmlNoLeitweg.includes('<ram:ID>urn:cen.eu:en16931:2017</ram:ID>'));
    assert.ok(!xmlNoLeitweg.includes('xrechnung_3.0'));
    assert.ok(!xmlNoLeitweg.includes('<ram:BuyerReference>N/A</ram:BuyerReference>'));

    const xmlWithLeitweg = generateZugferdXML(mockInvoice, mockCompany, mockClient);
    assert.ok(xmlWithLeitweg.includes('<ram:BuyerReference>991-12345-73</ram:BuyerReference>'));
});

test('createZugferdPdf embeds factur-x.xml with PDF/A-3b OutputIntent & XMP metadata and round-trips through extractXmlFromPdf', async () => {
    const baseDoc = await PDFDocument.create();
    const page = baseDoc.addPage([595, 842]);
    page.drawText('Rechnung RE-2026-001');
    const baseBytes = await baseDoc.save();

    const xml = generateZugferdXML(mockInvoice, mockCompany, mockClient);
    const zugferdPdf = await createZugferdPdf(baseBytes, xml, {
        invoiceNumber: mockInvoice.invoice_number,
        sellerName: mockCompany.name,
        issueDate: mockInvoice.issue_date,
    });

    assert.equal(zugferdPdf.subarray(0, 4).toString(), '%PDF');
    const loaded = await PDFDocument.load(zugferdPdf);
    assert.ok(loaded.catalog.get(PDFName.of('AF')), 'PDF/A-3 catalog must include /AF');
    assert.ok(loaded.catalog.get(PDFName.of('OutputIntents')), 'PDF/A-3b catalog must include /OutputIntents');
    assert.ok(loaded.catalog.get(PDFName.of('Metadata')), 'PDF/A-3b catalog must include /Metadata');
    assert.ok(loaded.catalog.get(PDFName.of('Names')), 'Catalog must include /Names for EmbeddedFiles');

    const pdfLatin1 = zugferdPdf.toString('latin1');
    assert.ok(pdfLatin1.includes('<pdfaid:part>3</pdfaid:part>'));
    assert.ok(pdfLatin1.includes('<pdfaid:conformance>B</pdfaid:conformance>'));
    assert.ok(pdfLatin1.includes('<fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>'));
    assert.ok(pdfLatin1.includes('<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>'));

    const extracted = extractXmlFromPdf(zugferdPdf);
    assert.ok(extracted, 'extractXmlFromPdf must recover embedded factur-x.xml');
    const parsed = parseEInvoiceXmlForMigration(extracted, 'ZUGFeRD_RE-2026-001.pdf');
    assert.equal(parsed.invoiceNumber, 'RE-2026-001');
    assert.equal(parsed.totalGross, 1190);
    assert.equal(parsed.items.length, 1);
    assert.equal(parsed.items[0].description, 'Softwareberatung');
});

function between(xml, start, end) {
    const from = xml.indexOf(start);
    const to = xml.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, `missing ${start}`);
    return xml.slice(from, to);
}

function assertHeaderSettlementOrder(xml, { withPeriod }) {
    const settlement = between(xml, '<ram:ApplicableHeaderTradeSettlement>', '</ram:ApplicableHeaderTradeSettlement>');
    const names = [
        'PaymentReference',
        'InvoiceCurrencyCode',
        'SpecifiedTradeSettlementPaymentMeans',
        'ApplicableTradeTax',
    ];
    if (withPeriod) names.push('BillingSpecifiedPeriod');
    names.push('SpecifiedTradePaymentTerms', 'SpecifiedTradeSettlementHeaderMonetarySummation');
    let cursor = -1;
    for (const name of names) {
        const at = settlement.indexOf(`<ram:${name}`);
        assert.ok(at > cursor, `${name} is out of CII D16B order in ApplicableHeaderTradeSettlement`);
        cursor = at;
    }
    if (!withPeriod) {
        assert.equal(settlement.includes('<ram:BillingSpecifiedPeriod>'), false);
    }
}

test('header and line billing periods follow the CII D16B element order', () => {
    const invoice = {
        ...mockInvoice,
        delivery_date: '2026-11-01',
        delivery_date_until: '2026-11-30',
        items: [{
            ...mockInvoice.items[0],
            delivery_date: '2026-11-01',
            delivery_date_until: '2026-11-15',
        }],
    };
    for (const xml of [generateXRechnungXML(invoice, mockCompany, mockClient), generateZugferdXML(invoice, mockCompany, mockClient)]) {
        assert.match(xml, /xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"/);
        assertHeaderSettlementOrder(xml, { withPeriod: true });
        const line = between(xml, '<ram:SpecifiedLineTradeSettlement>', '</ram:SpecifiedLineTradeSettlement>');
        const taxAt = line.indexOf('<ram:ApplicableTradeTax>');
        const periodAt = line.indexOf('<ram:BillingSpecifiedPeriod>');
        const sumAt = line.indexOf('<ram:SpecifiedTradeSettlementLineMonetarySummation>');
        assert.ok(taxAt >= 0 && taxAt < periodAt && periodAt < sumAt, 'line BillingSpecifiedPeriod must follow ApplicableTradeTax');
        const delivery = between(xml, '<ram:SpecifiedLineTradeDelivery>', '</ram:SpecifiedLineTradeDelivery>');
        assert.equal(delivery.includes('ActualDeliverySupplyChainEvent'), false);
        assert.match(line, /<ram:BillingSpecifiedPeriod><ram:StartDateTime><udt:DateTimeString format="102">20261101<\/udt:DateTimeString><\/ram:StartDateTime><ram:EndDateTime><udt:DateTimeString format="102">20261115<\/udt:DateTimeString><\/ram:EndDateTime><\/ram:BillingSpecifiedPeriod>/);
        assertCiiXsd(xml);
    }
    const startOnly = generateXRechnungXML({
        ...mockInvoice,
        items: [{ ...mockInvoice.items[0], delivery_date: '2026-11-06' }],
    }, mockCompany, mockClient);
    const startLine = between(startOnly, '<ram:SpecifiedLineTradeSettlement>', '</ram:SpecifiedLineTradeSettlement>');
    assert.match(startLine, /<ram:BillingSpecifiedPeriod><ram:StartDateTime><udt:DateTimeString format="102">20261106<\/udt:DateTimeString><\/ram:StartDateTime><\/ram:BillingSpecifiedPeriod>/);
    assert.equal(startLine.includes('<ram:EndDateTime>'), false);
    assert.equal(between(startOnly, '<ram:SpecifiedLineTradeDelivery>', '</ram:SpecifiedLineTradeDelivery>').includes('ActualDeliverySupplyChainEvent'), false);
    assertCiiXsd(startOnly);
});

test('invoices without a billing period or line delivery date stay in schema order', () => {
    const xml = generateXRechnungXML(mockInvoice, mockCompany, mockClient);
    assertHeaderSettlementOrder(xml, { withPeriod: false });
    const line = between(xml, '<ram:SpecifiedLineTradeSettlement>', '</ram:SpecifiedLineTradeSettlement>');
    assert.equal(line.includes('<ram:BillingSpecifiedPeriod>'), false);
    assert.ok(line.indexOf('<ram:ApplicableTradeTax>') < line.indexOf('<ram:SpecifiedTradeSettlementLineMonetarySummation>'));
    assertCiiXsd(xml);
    assertCiiXsd(generateZugferdXML(mockInvoice, mockCompany, mockClient));
});

test('BR-CO-26: a VAT identifier is BT-31 and does not need an extra seller ID', () => {
    assert.equal(eInvoiceSellerIdentifierWarning(mockCompany), null);
    const xml = generateXRechnungXML(mockInvoice, mockCompany, mockClient);
    const seller = between(xml, '<ram:SellerTradeParty>', '</ram:SellerTradeParty>');
    const beforeName = seller.slice(0, seller.indexOf('<ram:Name>'));
    assert.equal(beforeName.includes('<ram:ID'), false);
    assert.match(seller, /<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">DE123456789<\/ram:ID><\/ram:SpecifiedTaxRegistration>/);
    assert.match(seller, /<ram:ID schemeID="FC">21\/123\/45678<\/ram:ID>/);
});

test('BR-CO-26: a Steuernummer without a VAT ID is written as BT-29 and BT-32', () => {
    const company = { ...mockCompany, vat_id: '  ', tax_number: ' 21/123/45678 ', is_small_business: true };
    assert.equal(eInvoiceSellerIdentifierWarning(company), null);
    const invoice = { ...mockInvoice, total_vat: 0, total_gross: 1000 };
    const xml = generateZugferdXML(invoice, company, mockClient);
    const seller = between(xml, '<ram:SellerTradeParty>', '</ram:SellerTradeParty>');
    assert.ok(seller.indexOf('<ram:ID>21/123/45678</ram:ID>') < seller.indexOf('<ram:Name>'));
    assert.match(seller, /<ram:ID schemeID="FC">21\/123\/45678<\/ram:ID>/);
    assert.equal(seller.includes('schemeID="VA"'), false);
    assert.match(xml, /<ram:CategoryCode>E<\/ram:CategoryCode>/);
    assert.match(xml, /<ram:ExemptionReason>Gemäß § 19 UStG/);
    assertCiiXsd(xml);
    assertCiiXsd(generateXRechnungXML(invoice, company, { ...mockClient, vat_id: undefined }));
});

test('BR-CO-26: a seller without BT-29, BT-30 or BT-31 gets a warning instead of a silent export', () => {
    const company = { ...mockCompany, vat_id: '', tax_number: '   ' };
    const warning = eInvoiceSellerIdentifierWarning(company);
    assert.ok(warning);
    assert.match(warning, /BR-CO-26/);
    assert.match(warning, /BT-29/);
    assert.match(warning, /BT-30/);
    assert.match(warning, /BT-31/);
    const xml = generateXRechnungXML(mockInvoice, company, mockClient);
    const seller = between(xml, '<ram:SellerTradeParty>', '</ram:SellerTradeParty>');
    assert.equal(seller.includes('<ram:ID'), false);
    assert.equal(seller.includes('schemeID="VA"'), false);
    assert.equal(seller.includes('schemeID="FC"'), false);
    assert.equal(seller.includes('<ram:SpecifiedLegalOrganization>'), false);
    const mainTs = fs.readFileSync(path.join(__dirname, '../src/main.ts'), 'utf8');
    assert.ok(mainTs.includes('eInvoiceSellerIdentifierWarning(company)'), 'export handlers must refuse incomplete seller identifiers');
    const ui = readLoadedUiSource();
    assert.match(ui, /Verkäuferkennung BT-29, BT-30 oder BT-31 \(BR-CO-26\)/);
    assert.match(ui, /includes\('BR-CO-26'\)/);
});

test('a zero-rated invoice uses category Z without an exemption reason and validates', () => {
    const invoice = {
        ...mockInvoice,
        subtotal: 100,
        total_vat: 0,
        total_gross: 100,
        items: [{ description: 'Steuerfreie Lieferung', quantity: 1, unit_of_measure: 'stück', price: 100, tax_rate_percent: 0 }],
    };
    const xml = generateXRechnungXML(invoice, mockCompany, mockClient);
    const settlement = between(xml, '<ram:ApplicableHeaderTradeSettlement>', '</ram:ApplicableHeaderTradeSettlement>');
    assert.match(settlement, /<ram:CategoryCode>Z<\/ram:CategoryCode>/);
    assert.match(settlement, /<ram:CalculatedAmount>0\.00<\/ram:CalculatedAmount>/);
    assert.equal(settlement.includes('<ram:ExemptionReason>'), false);
    assertCiiXsd(xml);
    assertCiiXsd(generateZugferdXML(invoice, { ...mockCompany, is_small_business: false }, mockClient));
});

test('createZugferdPdf writes a non-empty trailer /ID and embeds factur-x.xml', async () => {
    const baseDoc = await PDFDocument.create();
    baseDoc.addPage([595, 842]);
    const saved = Buffer.from(await baseDoc.save());
    const withoutId = Buffer.from(saved.toString('latin1').replace(/\/ID\s*\[[^\]]*\]/g, ''), 'latin1');
    assert.equal(/\/ID\s*\[/.test(withoutId.toString('latin1')), false);

    const xml = generateZugferdXML(mockInvoice, mockCompany, mockClient);
    const zugferdPdf = await createZugferdPdf(withoutId, xml, {
        invoiceNumber: mockInvoice.invoice_number,
        sellerName: mockCompany.name,
        issueDate: mockInvoice.issue_date,
    });
    const pdfText = zugferdPdf.toString('latin1');
    assert.match(pdfText, /\/ID\s*\[\s*<[0-9A-Fa-f]{32}>\s*<[0-9A-Fa-f]{32}>\s*\]/);
    const loaded = await PDFDocument.load(zugferdPdf);
    const id = loaded.context.trailerInfo.ID;
    assert.equal(id.size(), 2);
    assert.ok(id.lookup(0).asString().length >= 32);
    assert.ok(id.lookup(1).asString().length >= 32);
    assert.ok(pdfText.includes('factur-x.xml'));
    const extracted = extractXmlFromPdf(zugferdPdf);
    assert.ok(extracted.includes('xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"'));
    assert.match(extracted, /<ram:PaymentReference>RE-2026-001<\/ram:PaymentReference>/);
    const parsed = parseEInvoiceXmlForMigration(extracted, 'ZUGFeRD_RE-2026-001.pdf');
    assert.equal(parsed.invoiceNumber, 'RE-2026-001');
    assert.equal(parsed.totalGross, 1190);
});

test('xmllint is used for CII D16B XSD validation when it is installed', () => {
    if (!xmllintAvailable()) return;
    const xml = generateXRechnungXML(mockInvoice, mockCompany, mockClient);
    assertCiiXsd(xml);
});

test('ZUGFeRD export hooks exist in the loaded UI, src/preload.ts, and src/main.ts', () => {
    const uiHtml = readLoadedUiSource();
    const preloadTs = fs.readFileSync(path.join(__dirname, '../src/preload.ts'), 'utf8');
    const mainTs = fs.readFileSync(path.join(__dirname, '../src/main.ts'), 'utf8');
    assert.ok(uiHtml.includes('exportZugferd('), 'loaded UI must expose exportZugferd');
    assert.ok(uiHtml.includes('ZUGFeRD (PDF)'), 'loaded UI must show ZUGFeRD (PDF) buttons');
    assert.ok(preloadTs.includes('exportZugferd:'), 'preload.ts must expose exportZugferd');
    assert.ok(mainTs.includes('ipcMain.handle("export:zugferd"'), 'main.ts must register export:zugferd handler');
});
