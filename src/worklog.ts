import { randomUUID } from "node:crypto";
import type { StoreData, Invoice, Expense } from "./types";
import { validateInvoice } from "./invoiceValidation";

export interface TimeEntry {
  id: string;
  project_id: string;
  date: string;
  description: string;
  minutes: number;
  rate: number;
  cost_rate: number;
  billable: boolean;
  invoice_id: string;
  created_at: number;
}
export interface RunningTimer {
  project_id: string;
  description: string;
  rate: number;
  cost_rate: number;
  billable: boolean;
  started_at: number;
}
export const roundMoney = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100;
export function localDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
const validDate = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
function record(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Ungültiger Datensatz.");
  return raw as Record<string, unknown>;
}
function workFields(raw: unknown, data: StoreData) {
  const r = record(raw);
  if (
    typeof r.project_id !== "string" ||
    !data.business?.projects.some((p) => p.id === r.project_id)
  )
    throw new Error("Bitte wählen Sie ein vorhandenes Projekt aus.");
  if (
    typeof r.description !== "string" ||
    !r.description.trim() ||
    r.description.length > 1000
  )
    throw new Error(
      "Bitte beschreiben Sie Ihre Tätigkeit (maximal 1.000 Zeichen).",
    );
  for (const key of ["rate", "cost_rate"])
    if (
      typeof r[key] !== "number" ||
      !Number.isFinite(r[key]) ||
      Number(r[key]) < 0 ||
      Number(r[key]) > 100000
    )
      throw new Error("Stundensätze müssen zwischen 0 und 100.000 € liegen.");
  if (typeof r.billable !== "boolean")
    throw new Error("Bitte die Abrechenbarkeit festlegen.");
  return {
    project_id: r.project_id,
    description: r.description.trim(),
    rate: roundMoney(r.rate as number),
    cost_rate: roundMoney(r.cost_rate as number),
    billable: r.billable,
  };
}
export function saveTimeEntry(data: StoreData, raw: unknown): TimeEntry {
  const r = record(raw),
    fields = workFields(r, data),
    entries = data.timeEntries || [];
  const previous = r.id ? entries.find((e) => e.id === r.id) : undefined;
  if (r.id && !previous) throw new Error("Zeiteintrag nicht gefunden.");
  if (previous?.invoice_id)
    throw new Error(
      "Abgerechnete Zeiten sind gesperrt. Löschen Sie gegebenenfalls zuerst den zugehörigen Rechnungsentwurf.",
    );
  if (!validDate(r.date))
    throw new Error("Bitte ein gültiges Leistungsdatum angeben.");
  if (
    !Number.isInteger(r.minutes) ||
    Number(r.minutes) < 1 ||
    Number(r.minutes) > 1440
  )
    throw new Error("Die Dauer muss zwischen 1 und 1.440 Minuten liegen.");
  const entry: TimeEntry = {
    ...fields,
    id: previous?.id || randomUUID(),
    date: r.date,
    minutes: Number(r.minutes),
    invoice_id: "",
    created_at: previous?.created_at || Date.now(),
  };
  data.timeEntries = [entry, ...entries.filter((e) => e.id !== entry.id)];
  return entry;
}
export function deleteTimeEntry(data: StoreData, id: unknown): void {
  const item = data.timeEntries?.find((e) => e.id === id);
  if (!item) throw new Error("Zeiteintrag nicht gefunden.");
  if (item.invoice_id)
    throw new Error("Abgerechnete Zeiten können nicht gelöscht werden.");
  data.timeEntries = data.timeEntries!.filter((e) => e.id !== id);
}
export function startTimer(
  data: StoreData,
  raw: unknown,
  now = Date.now(),
): RunningTimer {
  if (data.runningTimer)
    throw new Error("Es läuft bereits ein Timer. Bitte zuerst stoppen.");
  const timer = { ...workFields(raw, data), started_at: now };
  data.runningTimer = timer;
  return timer;
}
export function stopTimer(
  data: StoreData,
  minutes: unknown,
  now = Date.now(),
): TimeEntry {
  const timer = data.runningTimer;
  if (!timer) throw new Error("Es läuft kein Timer.");
  const duration =
    minutes === undefined
      ? Math.max(1, Math.ceil((now - timer.started_at) / 60000))
      : minutes;
  const entry = saveTimeEntry(data, {
    ...timer,
    date: localDate(new Date(timer.started_at)),
    minutes: duration,
  });
  data.runningTimer = null;
  return entry;
}
export function nextInvoiceNumber(
  data: StoreData,
  year = new Date().getFullYear(),
): string {
  const prefix = `RE-${year}-`;
  const max = data.invoices.reduce((highest, i) => {
    const number = i.invoice_number || "";
    const suffix = number.slice(prefix.length);
    return number.startsWith(prefix) &&
      /^\d+$/.test(suffix) &&
      Number.isSafeInteger(Number(suffix))
      ? Math.max(highest, Number(suffix))
      : highest;
  }, 0);
  if (max >= Number.MAX_SAFE_INTEGER - 1)
    throw new Error("Rechnungsnummernkreis ist ausgeschöpft.");
  return prefix + String(max + 1).padStart(3, "0");
}
export function createTimeInvoice(data: StoreData, raw: unknown): Invoice {
  const r = record(raw);
  const project = data.business?.projects.find((p) => p.id === r.project_id);
  if (!project || !data.clients.some((c) => c.id === project.client_id))
    throw new Error(
      "Das Projekt benötigt einen vorhandenen Kunden. Bitte zuerst im Projekt zuordnen.",
    );
  if (
    !Array.isArray(r.entry_ids) ||
    !r.entry_ids.length ||
    r.entry_ids.length > 500 ||
    new Set(r.entry_ids).size !== r.entry_ids.length
  )
    throw new Error("Bitte 1 bis 500 unterschiedliche Zeiten auswählen.");
  const selected = r.entry_ids.map((id) =>
    data.timeEntries?.find((e) => e.id === id),
  );
  if (
    selected.some(
      (e) => !e || e.project_id !== project.id || e.invoice_id || !e.billable,
    )
  )
    throw new Error(
      "Die Auswahl enthält bereits abgerechnete oder nicht abrechenbare Zeiten. Bitte neu laden.",
    );
  if (
    !validDate(r.issue_date) ||
    !validDate(r.due_date) ||
    r.due_date < r.issue_date
  )
    throw new Error("Bitte gültiges Rechnungsdatum und Zahlungsziel wählen.");
  const invoice = validateInvoice(
    {
      id: randomUUID(),
      project_id: project.id,
      client_id: project.client_id,
      invoice_number:
        typeof r.invoice_number === "string"
          ? r.invoice_number.trim()
          : nextInvoiceNumber(data),
      issue_date: r.issue_date,
      due_date: r.due_date,
      status: "draft",
      created_at: Date.now(),
      payment_terms: data.company.payment_terms_default || "",
      notes: `Projekt: ${project.name}`,
      items: selected.map((e) => ({
        description: `${e!.description} · ${e!.date.split("-").reverse().join(".")} · ${e!.minutes} Min. à ${e!.rate.toFixed(2)} €/Std.`,
        quantity: 1,
        unit_of_measure: "Pauschal",
        price: roundMoney((e!.minutes * e!.rate) / 60),
        tax_rate_percent: data.company.is_small_business ? 0 : 19,
      })),
    },
    data.invoices,
    data.clients.map((c) => c.id),
  );
  data.invoices.unshift(invoice);
  const ids = new Set(r.entry_ids);
  data.timeEntries = (data.timeEntries || []).map((e) =>
    ids.has(e.id) ? { ...e, invoice_id: invoice.id } : e,
  );
  return invoice;
}
export function deleteInvoiceAndUnlink(data: StoreData, id: unknown): void {
  const invoice = data.invoices.find((i) => i.id === id);
  if (!invoice) throw new Error("Rechnung nicht gefunden.");
  const linked = (data.timeEntries || []).some((e) => e.invoice_id === id);
  if (linked && invoice.status !== "draft")
    throw new Error(
      "Abgerechnete Zeiten können nur durch Löschen eines Rechnungsentwurfs freigegeben werden.",
    );
  data.invoices = data.invoices.filter((i) => i.id !== id);
  data.timeEntries = (data.timeEntries || []).map((e) =>
    e.invoice_id === id ? { ...e, invoice_id: "" } : e,
  );
}
export function validateProjectExpense(
  expense: Expense,
  data: StoreData,
): void {
  if (!expense.project_id) return;
  if (!data.business?.projects.some((p) => p.id === expense.project_id))
    throw new Error("Projekt nicht gefunden.");
  if (
    !expense.vendor_name?.trim() ||
    !validDate(expense.date) ||
    !Number.isFinite(expense.amount_gross) ||
    expense.amount_gross! < 0 ||
    !Number.isFinite(expense.vat_rate) ||
    expense.vat_rate! < 0 ||
    expense.vat_rate! > 100
  )
    throw new Error(
      "Bitte Lieferant, Datum, Betrag und Umsatzsteuersatz prüfen.",
    );
}
export function assertProjectUnused(data: StoreData, id: unknown): void {
  if (
    data.timeEntries?.some((e) => e.project_id === id) ||
    data.runningTimer?.project_id === id ||
    data.expenses.some((e) => e.project_id === id) ||
    data.invoices.some((e) => e.project_id === id)
  )
    throw new Error(
      "Das Projekt enthält Zeiten, Kosten oder Rechnungen und kann nicht gelöscht werden.",
    );
}
export function projectReports(data: StoreData) {
  return (data.business?.projects || []).map((project) => {
    const time = (data.timeEntries || []).filter(
      (e) => e.project_id === project.id,
    );
    const expenses = data.expenses.filter((e) => e.project_id === project.id);
    const invoices = data.invoices.filter((i) => i.project_id === project.id);
    const minutes = time.reduce((n, e) => n + e.minutes, 0);
    const value = roundMoney(
      time
        .filter((e) => e.billable)
        .reduce((n, e) => n + roundMoney((e.minutes * e.rate) / 60), 0),
    );
    const unbilled = roundMoney(
      time
        .filter((e) => e.billable && !e.invoice_id)
        .reduce((n, e) => n + roundMoney((e.minutes * e.rate) / 60), 0),
    );
    const labor = roundMoney(
      time.reduce((n, e) => n + roundMoney((e.minutes * e.cost_rate) / 60), 0),
    );
    const costs = roundMoney(
      expenses.reduce(
        (n, e) =>
          n +
          (data.company.is_small_business
            ? e.amount_gross || 0
            : roundMoney(
                (e.amount_gross || 0) / (1 + (e.vat_rate || 0) / 100),
              )),
        0,
      ),
    );
    const invoiced = roundMoney(
      invoices
        .filter((i) => i.status !== "draft")
        .reduce((n, i) => n + (i.subtotal || 0), 0),
    );
    const paid = roundMoney(
      invoices
        .filter((i) => i.status === "paid")
        .reduce((n, i) => n + (i.subtotal || 0), 0),
    );
    return {
      project,
      minutes,
      value,
      unbilled,
      labor,
      costs,
      invoiced,
      paid,
      contribution: roundMoney(value - labor - costs),
      budgetRemaining: roundMoney(project.budget - labor - costs),
      expenses: expenses.length,
    };
  });
}
export function timeCsv(data: StoreData): string {
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const rows = [
    [
      "Datum",
      "Projekt",
      "Tätigkeit",
      "Minuten",
      "Stundensatz EUR",
      "Abrechenbar",
      "Rechnungsnummer",
    ],
    ...(data.timeEntries || []).map((e) => [
      e.date,
      data.business?.projects.find((p) => p.id === e.project_id)?.name || "",
      e.description,
      e.minutes,
      e.rate.toFixed(2).replace(".", ","),
      e.billable ? "Ja" : "Nein",
      data.invoices.find((i) => i.id === e.invoice_id)?.invoice_number || "",
    ]),
  ];
  return "\ufeff" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
}
