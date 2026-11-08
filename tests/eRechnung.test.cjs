const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateXRechnungXML, generateDatevExport } = require('../out/eRechnung');

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
