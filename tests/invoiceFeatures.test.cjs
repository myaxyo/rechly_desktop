const { test, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateInvoice } = require('../out/invoiceValidation');
const { validateStore } = require('../out/storageValidation');
const { getDefaultStore } = require('../out/storeDefaults');
const { generateXRechnungXML } = require('../out/eRechnung');
const {
  formatInvoiceNumber,
  parseInvoiceNumberCounter,
  getNextInvoiceNumber,
  advanceInvoiceNumberCounter,
} = require('../out/invoiceNumbering');

const baseCompany = {
  name: "Agentur Muster e.K.",
  legal_form: "Einzelunternehmen",
  address_line1: "Designerallee 1",
  postal_code: "10115",
  city: "Berlin",
  country: "DE",
  email: "buchhaltung@agentur-muster.de",
  bank_name: "Sparkasse",
  bank_iban: "DE89370400440532013000",
  bank_bic: "BELADEBEXXX",
  is_small_business: false,
  invoice_number_pattern: "RE-{YYYY}-{####}",
  next_invoice_number: 1,
};

const baseClient = {
  id: "client-1",
  name: "Kunde Test GmbH",
  address_line1: "Testweg 12",
  postal_code: "50667",
  city: "Köln",
  country: "DE",
  email: "rechnung@kunde-test.de",
};

describe("Feature 1: Duplicate Invoices & Invoice Templates", () => {
  it("validates store with invoiceTemplates and round-trips through validateStore", () => {
    const store = getDefaultStore();
    store.invoiceTemplates = [
      {
        id: "tpl-1",
        name: "Monatliche Retainer-Pauschale",
        client_id: "client-sample-1",
        payment_terms: "Zahlbar innerhalb von 14 Tagen",
        created_at: 1700000000000,
        items: [
          {
            id: "it-1",
            description: "Wartung & Hosting",
            quantity: 1,
            unit_of_measure: "Monat",
            price: 250,
            tax_rate_percent: 19,
            delivery_date: "2026-11-01",
            delivery_date_until: "2026-11-30",
            total: 250,
          },
        ],
      },
    ];

    const validated = validateStore(store);
    assert.equal(validated.invoiceTemplates.length, 1);
    assert.equal(validated.invoiceTemplates[0].name, "Monatliche Retainer-Pauschale");
    assert.equal(validated.invoiceTemplates[0].items[0].delivery_date, "2026-11-01");
  });

  it("rejects corrupt or invalid invoice templates in validateStore", () => {
    const store = getDefaultStore();
    store.invoiceTemplates = [{ id: "tpl-1" }]; // missing name and items
    assert.throws(() => validateStore(store), /Rechnungsvorlage ungültig/);

    const store2 = getDefaultStore();
    store2.invoiceTemplates = "not-an-array";
    assert.throws(() => validateStore(store2), /Rechnungsvorlagen sind keine Liste/);
  });

  it("verifies template and duplicate UI hooks in ui/index.html", () => {
    const uiHtml = fs.readFileSync(path.join(__dirname, "../ui/index.html"), "utf8");
    assert.ok(uiHtml.includes('duplicateInvoice'), 'ui/index.html must include duplicateInvoice');
    assert.ok(uiHtml.includes('showTemplateModal'), 'ui/index.html must include showTemplateModal');
    assert.ok(uiHtml.includes('applyInvoiceTemplate'), 'ui/index.html must include applyInvoiceTemplate');
    assert.ok(uiHtml.includes('saveCurrentAsTemplate'), 'ui/index.html must include saveCurrentAsTemplate');
    assert.ok(uiHtml.includes('createInvoiceFromTemplate'), 'ui/index.html must include createInvoiceFromTemplate');
    assert.ok(uiHtml.includes('inv-template-picker'), 'ui/index.html must have template picker in editor');
  });
});

describe("Feature 2: Editable Service Period (Leistungszeitraum)", () => {
  const sampleInvoice = {
    id: "inv-lz-1",
    invoice_number: "RE-2026-0001",
    client_id: "client-1",
    issue_date: "2026-11-15",
    due_date: "2026-11-29",
    delivery_date: "2026-11-01",
    delivery_date_until: "2026-11-30",
    status: "draft",
    items: [
      {
        description: "Projektphase 1",
        quantity: 5,
        unit_of_measure: "Stunde",
        price: 100,
        tax_rate_percent: 19,
        delivery_date: "2026-11-01",
        delivery_date_until: "2026-11-10",
      },
      {
        description: "Projektphase 2",
        quantity: 5,
        unit_of_measure: "Stunde",
        price: 100,
        tax_rate_percent: 19,
        delivery_date: "2026-11-11",
        delivery_date_until: "2026-11-20",
      },
    ],
  };

  it("validates invoice with header and per-line delivery dates", () => {
    const validated = validateInvoice(sampleInvoice, [], ["client-1"]);
    assert.equal(validated.delivery_date, "2026-11-01");
    assert.equal(validated.delivery_date_until, "2026-11-30");
    assert.equal(validated.items[0].delivery_date, "2026-11-01");
    assert.equal(validated.items[0].delivery_date_until, "2026-11-10");
    assert.equal(validated.items[1].delivery_date, "2026-11-11");
    assert.equal(validated.items[1].delivery_date_until, "2026-11-20");
  });

  it("rejects reversed service periods where until < from", () => {
    assert.throws(
      () => validateInvoice({ ...sampleInvoice, delivery_date_until: "2026-10-01" }, [], ["client-1"]),
      /Das Enddatum des Leistungszeitraums darf nicht vor dem Beginn liegen/
    );

    assert.throws(
      () => validateInvoice({
        ...sampleInvoice,
        items: [{ ...sampleInvoice.items[0], delivery_date: "2026-11-15", delivery_date_until: "2026-11-01" }]
      }, [], ["client-1"]),
      /Das Enddatum des Leistungszeitraums der Position darf nicht vor dem Beginn liegen/
    );
  });

  it("generates XRechnung XML with BillingSpecifiedPeriod and item delivery event", () => {
    const xml = generateXRechnungXML(sampleInvoice, baseCompany, baseClient);

    // Header delivery event has start delivery date
    assert.ok(xml.includes('<ram:OccurrenceDateTime><udt:DateTimeString format="102">20261101</udt:DateTimeString></ram:OccurrenceDateTime>'));

    // Header trade settlement has BillingSpecifiedPeriod
    assert.ok(xml.includes('<ram:BillingSpecifiedPeriod>'));
    assert.ok(xml.includes('<ram:StartDateTime><udt:DateTimeString format="102">20261101</udt:DateTimeString></ram:StartDateTime>'));
    assert.ok(xml.includes('<ram:EndDateTime><udt:DateTimeString format="102">20261130</udt:DateTimeString></ram:EndDateTime>'));

    // Item-level line delivery
    assert.ok(xml.includes('<udt:DateTimeString format="102">20261110</udt:DateTimeString>'));
  });

  it("verifies service period UI inputs and template formatting in ui/index.html", () => {
    const uiHtml = fs.readFileSync(path.join(__dirname, "../ui/index.html"), "utf8");
    assert.ok(uiHtml.includes('id="inv-delivery-date"'), 'ui/index.html must have inv-delivery-date input');
    assert.ok(uiHtml.includes('id="inv-delivery-until"'), 'ui/index.html must have inv-delivery-until input');
    assert.ok(uiHtml.includes('class="item-delivery-date"'), 'ui/index.html must have item-delivery-date in line rows');
    assert.ok(uiHtml.includes('class="item-delivery-until"'), 'ui/index.html must have item-delivery-until in line rows');
    assert.ok(uiHtml.includes('formatServicePeriod'), 'ui/index.html must have formatServicePeriod helper');
  });
});

describe("Feature 3: Configurable Sequential Numbering & GoBD Compliance", () => {
  it("formats patterns with tokens and custom padding", () => {
    const nov1 = new Date(2026, 10, 1);
    assert.equal(formatInvoiceNumber("RE-{YYYY}-{####}", 1, nov1), "RE-2026-0001");
    assert.equal(formatInvoiceNumber("RE-{YYYY}-{####}", 42, nov1), "RE-2026-0042");
    assert.equal(formatInvoiceNumber("{YYYY}{MM}-{#####}", 7, nov1), "202611-00007");
    assert.equal(formatInvoiceNumber("R-{YY}-{NR}", 99, nov1), "R-26-99");
  });

  it("computes gapless sequential numbers and scans existing invoices", () => {
    const store = {
      company: {
        invoice_number_pattern: "RE-{YYYY}-{####}",
        next_invoice_number: 1,
      },
      invoices: [
        { invoice_number: "RE-2026-0001" },
        { invoice_number: "RE-2026-0005" },
        { invoice_number: "RE-2026-0002" },
      ],
    };
    const next = getNextInvoiceNumber(store, new Date(2026, 0, 1));
    // Gapless: must be max (5) + 1 = 6
    assert.equal(next, "RE-2026-0006");
  });

  it("advances company counter atomically", () => {
    const company = {
      invoice_number_pattern: "RE-{YYYY}-{####}",
      next_invoice_number: 5,
    };
    const advanced = advanceInvoiceNumberCounter(company, "RE-2026-0010", company.invoice_number_pattern, 2026);
    assert.equal(advanced, true);
    assert.equal(company.next_invoice_number, 11);
    assert.equal(company.nextInvoiceNumber, 11);
  });

  it("verifies settings UI for invoice pattern and counter in ui/index.html", () => {
    const uiHtml = fs.readFileSync(path.join(__dirname, "../ui/index.html"), "utf8");
    assert.ok(uiHtml.includes('id="set-invoice-pattern"'), 'ui/index.html must have set-invoice-pattern input in Settings');
    assert.ok(uiHtml.includes('id="set-next-invoice-num"'), 'ui/index.html must have set-next-invoice-num input in Settings');
    assert.ok(uiHtml.includes('settings-pattern-preview'), 'ui/index.html must have live preview in Settings');
    assert.ok(uiHtml.includes('updateSettingsPatternPreview'), 'ui/index.html must handle live preview updates');
  });
});

describe("Feedback Regression Fixes: Date Consistency, Duplicate/Multi-Select & PDF Margin", () => {
  it("formats issue_date, due_date, and delivery_date consistently via dateLabel in all invoice templates", () => {
    const uiHtml = fs.readFileSync(path.join(__dirname, "../ui/index.html"), "utf8");
    for (const fnName of ["getClassicInvoiceHtml", "getModernInvoiceHtml", "getMinimalInvoiceHtml"]) {
      const start = uiHtml.indexOf(`function ${fnName}(`);
      assert.ok(start !== -1, `${fnName} must exist`);
      const nextFn = uiHtml.indexOf("\n    function ", start + 1);
      const body = uiHtml.slice(start, nextFn === -1 ? undefined : nextFn);
      assert.ok(body.includes("dateLabel(inv.issue_date)"), `${fnName} must format issue_date with dateLabel`);
      assert.ok(body.includes("dateLabel(inv.due_date)"), `${fnName} must format due_date with dateLabel`);
      assert.ok(!body.includes("${inv.issue_date"), `${fnName} must not interpolate raw inv.issue_date`);
      assert.ok(!body.includes("${inv.due_date"), `${fnName} must not interpolate raw inv.due_date`);
    }
  });

  it("includes single duplicate and multi-select duplicate/delete for products and invoice items", () => {
    const uiHtml = fs.readFileSync(path.join(__dirname, "../ui/index.html"), "utf8");
    for (const hook of [
      "duplicateProduct",
      "duplicateSelectedProducts",
      "deleteSelectedProducts",
      "products-bulk-bar",
      "prod-select-all",
      "duplicateInvoiceItemRow",
      "duplicateSelectedInvoiceItems",
      "deleteSelectedInvoiceItems",
      "inv-items-bulk-bar",
      "inv-items-select-all",
    ]) {
      assert.ok(uiHtml.includes(hook), `ui/index.html must include ${hook}`);
    }
  });

  it("sets white window background and preferCSSPageSize around printToPDF in src/main.ts", () => {
    const mainTs = fs.readFileSync(path.join(__dirname, "../src/main.ts"), "utf8");
    const exportStart = mainTs.indexOf('ipcMain.handle("export:pdf"');
    assert.ok(exportStart !== -1, "export:pdf handler must exist");
    const exportBlock = mainTs.slice(exportStart, exportStart + 1200);
    assert.ok(exportBlock.includes('setBackgroundColor("#ffffff")'), "export:pdf must set white background for PDF margins");
    assert.ok(exportBlock.includes('preferCSSPageSize: true'), "export:pdf must honor CSS @page size");
  });
});
