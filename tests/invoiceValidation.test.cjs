const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateInvoice } = require('../out/invoiceValidation');
const fixture = () => ({ id:'one', invoice_number:'RE-001', client_id:'client', issue_date:'2026-01-01', due_date:'2026-01-15', status:'draft', items:[{description:'Beratung', quantity:3, price:19.99, tax_rate_percent:19}] });
test('computes authoritative, cent-rounded totals, ignoring caller totals', () => {
 const result = validateInvoice({...fixture(), total_gross:1}, [], ['client']);
 assert.equal(result.subtotal,59.97); assert.equal(result.total_vat,11.39); assert.equal(result.total_gross,71.36);
});
test('rejects duplicate numbers but permits edits to the same invoice', () => {
 assert.throws(()=>validateInvoice(fixture(), [{...fixture(),id:'two'}], ['client']), /vergeben/);
 assert.doesNotThrow(()=>validateInvoice(fixture(), [fixture()], ['client']));
});
test('rejects missing customers and invalid or reversed dates', () => {
 assert.throws(()=>validateInvoice(fixture(), [], []), /Kunden/);
 for(const patch of [{issue_date:'2026-02-30'}, {due_date:'2025-12-31'}, {due_date:''}]) assert.throws(()=>validateInvoice({...fixture(),...patch},[],['client']),/ungültig/);
});
test('rejects invalid positions and applies discounts', () => {
 for(const patch of [{quantity:0},{quantity:NaN},{price:-1},{tax_rate_percent:101},{description:''}]) assert.throws(()=>validateInvoice({...fixture(),items:[{...fixture().items[0],...patch}]},[],['client']));
 const result=validateInvoice({...fixture(),items:[{description:'Rabatt',quantity:1,price:100,tax_rate_percent:19,discount_percent:10}]},[],['client']);
 assert.equal(result.total_gross,107.1);
});
