const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildGirocodePayload } = require('../out/girocode');
const { invoicePaymentQr } = require('../out/invoicePayment');
const valid = { name: 'Müller GmbH', iban: 'DE89 3704 0044 0532 0130 00', amount: 119.5, reference: 'Rechnung RE-2026-1' };

test('payment payload matches web EPC layout with an optional BIC', () => {
    const lines = buildGirocodePayload(valid).split('\n');
    assert.equal(lines.length, 11);
    assert.deepEqual(lines.slice(0, 5), ['BCD', '002', '1', 'SCT', '']);
    assert.equal(lines[6], 'DE89370400440532013000');
    assert.equal(lines[7], 'EUR119.50');
    assert.equal(lines[10], valid.reference);
    assert.ok(buildGirocodePayload({ ...valid, bic: 'COBADEFFXXX' }));
});
test('invalid payment data is omitted instead of silently truncated or encoded', () => {
    for (const patch of [{ iban: 'DE00370400440532013000' }, { iban: 'DEbad123' }, { bic: 'bad' }, { amount: Infinity }, { amount: -10 }, { amount: 0.001 }, { amount: 1000000000 }, { name: 'A\nB' }, { reference: 'bad\nreference' }, { name: 'A'.repeat(71) }, { reference: 'A'.repeat(141) }, { name: '€'.repeat(70), reference: '€'.repeat(140) }]) {
        assert.equal(buildGirocodePayload({ ...valid, ...patch }), null, JSON.stringify(patch));
    }
});
test('invoice QR is offline, opt-in and suppressed for paid, zero and credit invoices', async () => {
    const company = { name: valid.name, bank_iban: valid.iban, show_payment_qr: true };
    const invoice = { id: 'invoice', invoice_number: 'RE-1', total_gross: 119.5, status: 'sent' };
    const url = await invoicePaymentQr(invoice, company);
    assert.ok(url.startsWith('data:image/png;base64,'));
    assert.equal(Buffer.from(url.split(',')[1], 'base64').subarray(1, 4).toString(), 'PNG');
    assert.equal(await invoicePaymentQr(invoice, { ...company, show_payment_qr: false }), null);
    assert.equal(await invoicePaymentQr(invoice, { name: valid.name, bank_iban: valid.iban }), null);
    assert.equal(await invoicePaymentQr({ ...invoice, status: 'paid' }, company), null);
    assert.equal(await invoicePaymentQr({ ...invoice, total_gross: 0 }, company), null);
    assert.equal(await invoicePaymentQr({ ...invoice, total_gross: -119 }, company), null);
});
