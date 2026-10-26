import type { StoreData } from "./types";
import { getDefaultStore } from "./storeDefaults";

export const collectionNames = [
  "invoices",
  "clients",
  "products",
  "offers",
  "expenses",
  "projects",
  "tasks",
  "documents",
  "calendar",
  "timeEntries",
] as const;
export type CollectionName = (typeof collectionNames)[number];
export function rowsOf(
  data: StoreData,
  name: CollectionName,
): Array<{ id: string }> {
  if (name === "projects" || name === "tasks" || name === "documents")
    return data.business?.[name] || [];
  return data[name] || [];
}
const object = (v: unknown): v is Record<string, any> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
function fail(detail: string): never {
  throw new Error("Ungültige Rechly-Daten: " + detail);
}
function jsonTree(value: unknown, depth = 0): void {
  if (depth > 40) fail("zu tief verschachtelt.");
  if (typeof value === "number" && !Number.isFinite(value))
    fail("ungültige Zahl.");
  if (
    value === undefined ||
    typeof value === "function" ||
    typeof value === "bigint"
  )
    fail("nicht unterstützter Datentyp.");
  if (value && typeof value === "object")
    for (const [key, child] of Object.entries(value)) {
      if (["__proto__", "constructor", "prototype"].includes(key))
        fail("unzulässiger Schlüssel.");
      jsonTree(child, depth + 1);
    }
}
function fields(
  record: Record<string, any>,
  strings: string[],
  numbers: string[] = [],
): void {
  for (const key of strings)
    if (
      record[key] !== undefined &&
      record[key] !== null &&
      typeof record[key] !== "string"
    )
      fail(`${key} muss Text sein.`);
  for (const key of numbers)
    if (
      record[key] !== undefined &&
      (typeof record[key] !== "number" || !Number.isFinite(record[key]))
    )
      fail(`${key} muss eine Zahl sein.`);
}
/** Shape validation accepts historical partial records but never missing core collections. */
export function validateStore(raw: unknown): StoreData {
  if (!object(raw)) fail("kein Datenobjekt.");
  jsonTree(raw);
  if (raw.version !== 1)
    fail(
      "nicht unterstützte Datenversion. Bitte die passende Rechly-Version verwenden.",
    );
  if (!object(raw.company) || typeof raw.initialized_at !== "string")
    fail("Firmenprofil oder Erstellungsdatum fehlt.");
  for (const key of ["invoices", "clients", "products", "offers", "expenses"])
    if (!Array.isArray(raw[key])) fail(`${key} fehlt oder ist keine Liste.`);
  if (
    raw.business !== undefined &&
    (!object(raw.business) ||
      ["projects", "tasks", "documents"].some(
        (k) => !Array.isArray(raw.business[k]),
      ))
  )
    fail("Arbeitsbereich unvollständig.");
  for (const key of ["calendar", "timeEntries", "calendarReminders"])
    if (raw[key] !== undefined && !Array.isArray(raw[key]))
      fail(`${key} ist keine Liste.`);
  if (raw.calendarReminders?.some((v: unknown) => typeof v !== "string"))
    fail("Kalendererinnerungen müssen Text sein.");
  if (raw.aiSettings !== undefined && !object(raw.aiSettings))
    fail("KI-Einstellungen ungültig.");
  const data = structuredClone(raw) as StoreData;
  data.aiSettings = { ...getDefaultStore().aiSettings, ...data.aiSettings };
  fields(data.company, [
    "name",
    "legal_form",
    "address_line1",
    "postal_code",
    "city",
    "country",
    "email",
    "phone",
    "vat_id",
    "tax_number",
    "bank_name",
    "bank_iban",
    "bank_bic",
    "payment_terms_default",
    "invoice_template",
  ]);
  if (
    data.company.is_small_business !== undefined &&
    typeof data.company.is_small_business !== "boolean"
  )
    fail("Kleinunternehmer-Einstellung ungültig.");
  fields(data.aiSettings, Object.keys(getDefaultStore().aiSettings));
  if (
    !["ollama", "openai", "anthropic"].includes(data.aiSettings.active_provider)
  )
    fail("KI-Anbieter ungültig.");
  for (const name of collectionNames) {
    const ids = new Set<string>();
    for (const row of rowsOf(data, name)) {
      if (
        !object(row) ||
        typeof row.id !== "string" ||
        !/^[-\w.:]{1,200}$/.test(row.id) ||
        ids.has(row.id)
      )
        fail(`${name}: ungültige oder doppelte ID.`);
      ids.add(row.id);
      const r = row as Record<string, any>;
      fields(
        r,
        [
          "client_id",
          "project_id",
          "invoice_id",
          "name",
          "description",
          "title",
          "date",
          "status",
          "notes",
          "vendor_name",
          "category",
          "invoice_number",
          "offer_number",
          "issue_date",
          "due_date",
          "valid_until",
          "delivery_date",
          "payment_terms",
          "body",
          "recipient",
          "kind",
          "assignee",
          "priority",
          "start",
          "end",
          "until",
          "repeat",
          "location",
        ],
        [
          "created_at",
          "updated_at",
          "price",
          "amount_gross",
          "vat_rate",
          "subtotal",
          "total_vat",
          "total_gross",
          "budget",
          "minutes",
          "rate",
          "cost_rate",
          "interval",
          "reminder",
        ],
      );
      if (r.items !== undefined) {
        if (!Array.isArray(r.items))
          fail("Rechnungspositionen sind keine Liste.");
        for (const item of r.items) {
          if (!object(item)) fail("Ungültige Position.");
          fields(
            item,
            ["id", "description", "unit_of_measure"],
            [
              "quantity",
              "price",
              "tax_rate_percent",
              "discount_percent",
              "total",
            ],
          );
        }
      }
      if (name === "calendar") {
        for (const key of [
          "title",
          "start",
          "end",
          "repeat",
          "until",
          "category",
          "location",
          "notes",
        ])
          if (typeof r[key] !== "string") fail("Termin unvollständig.");
        if (
          typeof r.allDay !== "boolean" ||
          !Number.isInteger(r.interval) ||
          !Array.isArray(r.exceptions) ||
          r.exceptions.some((v: unknown) => typeof v !== "string")
        )
          fail("Terminregeln ungültig.");
      }
      if (
        name === "timeEntries" &&
        (!Number.isInteger(r.minutes) ||
          r.minutes < 1 ||
          r.minutes > 1440 ||
          typeof r.billable !== "boolean" ||
          typeof r.rate !== "number" ||
          r.rate < 0 ||
          typeof r.cost_rate !== "number" ||
          r.cost_rate < 0 ||
          typeof r.date !== "string" ||
          typeof r.description !== "string")
      )
        fail("Zeiteintrag ungültig.");
      if (
        name === "projects" &&
        (typeof r.name !== "string" || typeof r.budget !== "number")
      )
        fail("Projekt unvollständig.");
      if (
        name === "tasks" &&
        (typeof r.title !== "string" ||
          !["todo", "doing", "done"].includes(r.status))
      )
        fail("Aufgabe unvollständig.");
      if (
        name === "documents" &&
        (typeof r.title !== "string" || typeof r.body !== "string")
      )
        fail("Dokument unvollständig.");
    }
  }
  if (data.runningTimer !== undefined && data.runningTimer !== null) {
    const t = data.runningTimer;
    if (
      !object(t) ||
      typeof t.project_id !== "string" ||
      typeof t.description !== "string" ||
      typeof t.billable !== "boolean" ||
      ![t.started_at, t.rate, t.cost_rate].every(
        (n) => typeof n === "number" && Number.isFinite(n) && n >= 0,
      )
    )
      fail("Laufender Timer ungültig.");
  }
  if (data.onboarding !== undefined) {
    if (
      !object(data.onboarding) ||
      typeof data.onboarding.completed_at !== "string" ||
      typeof data.onboarding.storage_consent_at !== "string" ||
      typeof data.onboarding.cloud_ai_opt_in !== "boolean"
    )
      fail("Einrichtung unvollständig.");
  }
  const clients = new Set(data.clients.map((r) => r.id)),
    projects = new Set((data.business?.projects || []).map((r) => r.id)),
    invoices = new Set(data.invoices.map((r) => r.id));
  const reference = (id: unknown, ids: Set<string>, label: string) => {
    if (
      id !== undefined &&
      id !== null &&
      id !== "" &&
      (typeof id !== "string" || !ids.has(id))
    )
      fail(label + " verweist auf einen fehlenden Datensatz.");
  };
  for (const row of [
    ...data.invoices,
    ...data.offers,
    ...(data.business?.projects || []),
  ])
    reference(row.client_id, clients, "Kunde");
  for (const row of [
    ...data.invoices,
    ...data.expenses,
    ...(data.business?.tasks || []),
    ...(data.business?.documents || []),
    ...(data.timeEntries || []),
  ])
    reference(row.project_id, projects, "Projekt");
  for (const row of data.timeEntries || []) {
    if (!row.project_id) fail("Zeiteintrag ohne Projekt.");
    reference(row.invoice_id, invoices, "Rechnung");
  }
  if (data.runningTimer)
    reference(data.runningTimer.project_id, projects, "Timer-Projekt");
  return data;
}
