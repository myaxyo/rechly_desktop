const { test } = require("node:test");
const assert = require("node:assert/strict");
const w = require("../out/worklog");
function fixture() {
  return {
    company: { is_small_business: false },
    clients: [{ id: "c" }],
    invoices: [],
    expenses: [],
    business: {
      projects: [{ id: "p", name: "Beratung", client_id: "c", budget: 500 }],
      tasks: [],
      documents: [],
    },
  };
}
const entry = {
  project_id: "p",
  description: "Konzept",
  date: "2026-10-26",
  minutes: 90,
  rate: 100,
  cost_rate: 40,
  billable: true,
};
const bill = (ids) => ({
  project_id: "p",
  entry_ids: ids,
  issue_date: "2026-10-26",
  due_date: "2026-11-09",
  invoice_number: "RE-2026-001",
});
test("validates time entries and protects existing records", () => {
  const data = fixture();
  for (const patch of [
    { project_id: "missing" },
    { date: "2026-02-30" },
    { minutes: 0 },
    { minutes: 1.5 },
    { minutes: 1441 },
    { rate: NaN },
    { cost_rate: -1 },
    { description: " " },
    { billable: "yes" },
    { id: "missing" },
  ])
    assert.throws(() => w.saveTimeEntry(data, { ...entry, ...patch }));
  assert.equal(data.timeEntries, undefined);
  const saved = w.saveTimeEntry(data, { ...entry, invoice_id: "forged" });
  assert.equal(saved.invoice_id, "");
  w.saveTimeEntry(data, { ...saved, minutes: 60 });
  assert.equal(data.timeEntries.length, 1);
  assert.equal(data.timeEntries[0].minutes, 60);
  assert.throws(() => w.assertProjectUnused(data, "p"));
  w.deleteTimeEntry(data, saved.id);
  assert.equal(data.timeEntries.length, 0);
});
test("timer survives serialization, rejects overlap, and retains state on invalid stop", () => {
  let data = fixture();
  const now = new Date("2026-10-26T10:00:00").getTime();
  w.startTimer(data, entry, now);
  assert.throws(() => w.startTimer(data, entry, now), /bereits/);
  data = JSON.parse(JSON.stringify(data));
  assert.throws(() => w.assertProjectUnused(data, "p"));
  assert.throws(() => w.stopTimer(data, 0, now + 61000));
  assert.ok(data.runningTimer);
  const saved = w.stopTimer(data, undefined, now + 61000);
  assert.equal(saved.minutes, 2);
  assert.equal(saved.date, "2026-10-26");
  assert.equal(data.runningTimer, null);
  w.startTimer(data, entry, now);
  assert.throws(() => w.stopTimer(data, undefined, now + 25 * 3600000));
  assert.ok(data.runningTimer);
  w.stopTimer(data, 120, now + 25 * 3600000);
  assert.equal(data.timeEntries[0].minutes, 120);
});
test("bills exact rounded amounts once, locks billed time, and unlinks deleted drafts", () => {
  const data = fixture(),
    saved = w.saveTimeEntry(data, entry);
  const invoice = w.createTimeInvoice(data, bill([saved.id]));
  assert.equal(invoice.subtotal, 150);
  assert.equal(invoice.total_vat, 28.5);
  assert.equal(invoice.total_gross, 178.5);
  assert.equal(invoice.project_id, "p");
  assert.equal(data.timeEntries[0].invoice_id, invoice.id);
  assert.match(invoice.items[0].description, /90 Min/);
  assert.throws(() => w.createTimeInvoice(data, bill([saved.id])));
  assert.throws(() => w.saveTimeEntry(data, saved));
  assert.throws(() => w.deleteTimeEntry(data, saved.id));
  invoice.status = "sent";
  assert.throws(() => w.deleteInvoiceAndUnlink(data, invoice.id));
  assert.equal(data.invoices.length, 1);
  invoice.status = "draft";
  w.deleteInvoiceAndUnlink(data, invoice.id);
  assert.equal(data.timeEntries[0].invoice_id, "");
  assert.equal(data.invoices.length, 0);
  data.company.is_small_business = true;
  data.timeEntries[0].minutes = 1;
  data.timeEntries[0].rate = 100;
  const small = w.createTimeInvoice(data, bill([saved.id]));
  assert.equal(small.total_gross, 1.67);
  assert.equal(small.total_vat, 0);
});
test("rejects duplicate selections, invalid customers, dates and nonbillable time without mutation", () => {
  const data = fixture(),
    a = w.saveTimeEntry(data, entry),
    internal = w.saveTimeEntry(data, { ...entry, billable: false });
  for (const patch of [
    { entry_ids: [a.id, a.id] },
    { entry_ids: ["missing"] },
    { entry_ids: [internal.id] },
    { due_date: "2026-10-25" },
    { issue_date: "2026-02-30" },
  ])
    assert.throws(() =>
      w.createTimeInvoice(data, { ...bill([a.id]), ...patch }),
    );
  data.business.projects[0].client_id = "missing";
  assert.throws(() => w.createTimeInvoice(data, bill([a.id])));
  assert.equal(data.invoices.length, 0);
  assert.ok(data.timeEntries.every((e) => !e.invoice_id));
});
test("project reports distinguish labor, expenses, invoice drafts and paid amounts", () => {
  const data = fixture(),
    saved = w.saveTimeEntry(data, entry);
  const expense = {
    project_id: "p",
    vendor_name: "Material",
    date: "2026-10-26",
    amount_gross: 119,
    vat_rate: 19,
  };
  w.validateProjectExpense(expense, data);
  data.expenses.push(expense);
  for (const patch of [
    { project_id: "missing" },
    { amount_gross: -1 },
    { vat_rate: NaN },
    { date: "bad" },
  ])
    assert.throws(() =>
      w.validateProjectExpense({ ...expense, ...patch }, data),
    );
  let report = w.projectReports(data)[0];
  assert.equal(report.value, 150);
  assert.equal(report.labor, 60);
  assert.equal(report.costs, 100);
  assert.equal(report.contribution, -10);
  assert.equal(report.unbilled, 150);
  const invoice = w.createTimeInvoice(data, bill([saved.id]));
  report = w.projectReports(data)[0];
  assert.equal(report.invoiced, 0);
  assert.equal(report.unbilled, 0);
  invoice.status = "sent";
  assert.equal(w.projectReports(data)[0].invoiced, 150);
  assert.equal(w.projectReports(data)[0].paid, 0);
  invoice.status = "paid";
  assert.equal(w.projectReports(data)[0].paid, 150);
  data.company.is_small_business = true;
  assert.equal(w.projectReports(data)[0].costs, 119);
});
test("invoice numbering scans maximum and CSV preserves text without spreadsheet formulas", () => {
  const data = fixture();
  data.invoices = [
    { invoice_number: "RE-2026-009" },
    { invoice_number: "RE-2026-002" },
    { invoice_number: "RE-2026-custom" },
  ];
  assert.equal(w.nextInvoiceNumber(data, 2026), "RE-2026-010");
  data.business.projects[0].name = '=HYPERLINK("bad")';
  w.saveTimeEntry(data, { ...entry, description: '+SUM(1;2)\n"text"' });
  const csv = w.timeCsv(data);
  assert.ok(csv.startsWith("\ufeff"));
  assert.match(csv, /'=HYPERLINK\(""bad""\)/);
  assert.match(csv, /'\+SUM\(1;2\)/);
  assert.match(csv, /""text""/);
});
