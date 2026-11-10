const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  formatInvoiceNumber,
  parseInvoiceNumberCounter,
  getNextInvoiceNumber,
  advanceInvoiceNumberCounter,
  DEFAULT_INVOICE_PATTERN,
} = require('../out/invoiceNumbering');

test('formatInvoiceNumber replaces date tokens and pad counters correctly', () => {
  const d = new Date(2026, 10, 15); // Nov 15, 2026
  assert.equal(formatInvoiceNumber('RE-{YYYY}-{###}', 7, d), 'RE-2026-007');
  assert.equal(formatInvoiceNumber('RE-{YYYY}-{####}', 7, d), 'RE-2026-0007');
  assert.equal(formatInvoiceNumber('{YYYY}{MM}-{###}', 42, d), '202611-042');
  assert.equal(formatInvoiceNumber('RE-{YY}-{NR}', 123, d), 'RE-26-123');
  assert.equal(formatInvoiceNumber('INV-{YYYY}-', 5, d), 'INV-2026-005');
});

test('parseInvoiceNumberCounter extracts counter from matching numbers', () => {
  assert.equal(parseInvoiceNumberCounter('RE-{YYYY}-{###}', 'RE-2026-042', 2026), 42);
  assert.equal(parseInvoiceNumberCounter('RE-{YYYY}-{####}', 'RE-2026-0105', 2026), 105);
  assert.equal(parseInvoiceNumberCounter('RE-{YYYY}-{###}', 'RE-2025-042', 2026), null);
  assert.equal(parseInvoiceNumberCounter('RE-{YYYY}-{###}', 'INVALID', 2026), null);
});

test('getNextInvoiceNumber generates GoBD-compliant gapless sequential numbers', () => {
  const d = new Date(2026, 0, 1);
  const data = {
    company: { invoice_number_pattern: 'RE-{YYYY}-{###}' },
    invoices: [
      { invoice_number: 'RE-2026-001' },
      { invoice_number: 'RE-2026-004' },
      { invoice_number: 'RE-2026-002' },
    ],
  };
  // Maximum existing is 4, so next must be 5
  assert.equal(getNextInvoiceNumber(data, d, 2026), 'RE-2026-005');

  // If company configured a higher starting counter, it respects it
  data.company.next_invoice_number = 100;
  assert.equal(getNextInvoiceNumber(data, d, 2026), 'RE-2026-100');

  // If invoices exist with a number higher than configured, it avoids duplicates
  data.invoices.push({ invoice_number: 'RE-2026-150' });
  assert.equal(getNextInvoiceNumber(data, d, 2026), 'RE-2026-151');
});

test('advanceInvoiceNumberCounter updates company counter atomically', () => {
  const company = { invoice_number_pattern: 'RE-{YYYY}-{###}', next_invoice_number: 1 };
  advanceInvoiceNumberCounter(company, 'RE-2026-015', company.invoice_number_pattern, 2026);
  assert.equal(company.next_invoice_number, 16);
  assert.equal(company.nextInvoiceNumber, 16);
});
