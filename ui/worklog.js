window.Worklog = (() => {
  let store = null,
    reports = [],
    number = "",
    view = "worklog",
    project = "",
    status = "all",
    query = "",
    selected = new Set(),
    editing = null,
    busy = false,
    generation = 0;
  const e = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const money = (v) =>
    new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(v || 0);
  const date = (v) => v?.split("-").reverse().join(".") || "—";
  const duration = (m) => `${Math.floor(m / 60)} Std. ${m % 60} Min.`;
  const value = (r) =>
    Math.round(((r.minutes * r.rate) / 60 + Number.EPSILON) * 100) / 100;
  const projectName = (id) =>
    store?.business?.projects.find((p) => p.id === id)?.name || "Projekt";
  const btn = (action, label, id = "", cls = "btn btn-secondary", extra = "") =>
    `<button type="button" class="${cls}" data-work-action="${action}" data-id="${e(id)}" ${extra}>${label}</button>`;
  const option = (name, values, current) =>
    `<select name="${name}">${values.map(([v, l]) => `<option value="${e(v)}" ${v === current ? "selected" : ""}>${e(l)}</option>`).join("")}</select>`;
  const projects = (name, current, allowAll = false) =>
    option(
      name,
      [
        ...(allowAll ? [["", "Alle Projekte"]] : [["", "Projekt auswählen …"]]),
        ...(store?.business?.projects || []).map((p) => [p.id, p.name]),
      ],
      current || "",
    );
  const field = (label, control) =>
    `<label class="work-field"><span>${label}</span>${control}</label>`;
  const input = (name, v, type = "text", extra = "") =>
    `<input name="${name}" type="${type}" value="${e(v)}" ${extra}>`;
  function visible() {
    return (store?.timeEntries || [])
      .filter(
        (r) =>
          (!project || r.project_id === project) &&
          (status === "all" ||
            (status === "unbilled" && r.billable && !r.invoice_id) ||
            (status === "billed" && r.invoice_id) ||
            (status === "internal" && !r.billable)) &&
          [r.description, projectName(r.project_id)]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase()),
      )
      .sort(
        (a, b) => b.date.localeCompare(a.date) || b.created_at - a.created_at,
      );
  }
  function eligible(row) {
    return (
      project && row.project_id === project && row.billable && !row.invoice_id
    );
  }
  function ticker() {
    const t = store?.runningTimer;
    const seconds = t
      ? Math.max(0, Math.floor((Date.now() - t.started_at) / 1000))
      : 0;
    const text = `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    document
      .querySelectorAll("[data-work-clock]")
      .forEach((el) => (el.textContent = text));
    const chip = document.getElementById("work-timer-chip");
    if (chip) {
      chip.hidden = !t;
      chip.textContent = `● Timer ${text}`;
    }
  }
  function table() {
    const rows = visible();
    const selectable = rows.filter(eligible);
    const allSelected =
      selectable.length > 0 && selectable.every((r) => selected.has(r.id));
    return `<div class="work-selection"><span id="work-selection-summary">${selected.size} Einträge ausgewählt · ${money((store.timeEntries || []).filter((r) => selected.has(r.id)).reduce((n, r) => n + value(r), 0))} netto</span>${btn("bill", "Auswahl abrechnen", "", "btn btn-primary", selected.size ? "" : "disabled")}</div><div class="table-scroll"><table class="work-table"><thead><tr><th><input type="checkbox" id="work-select-all" aria-label="Alle sichtbaren abrechenbaren Zeiten auswählen" ${project ? "" : "disabled"} ${allSelected ? "checked" : ""}></th><th>Datum / Projekt</th><th>Tätigkeit</th><th>Dauer</th><th class="numeric">Wert netto</th><th>Status</th><th>Aktion</th></tr></thead><tbody>${rows.map((r) => `<tr><td><input type="checkbox" data-time-select="${e(r.id)}" aria-label="${e(r.description)} auswählen" ${selected.has(r.id) ? "checked" : ""} ${eligible(r) ? "" : "disabled"}></td><td>${date(r.date)}<span class="cell-sub">${e(projectName(r.project_id))}</span></td><td class="work-description">${e(r.description)}<span class="cell-sub">${money(r.rate)} / Std.</span></td><td class="work-nowrap">${duration(r.minutes)}</td><td class="numeric">${r.billable ? money(value(r)) : "—"}</td><td><span class="business-badge ${r.invoice_id ? "done" : ""}">${r.invoice_id ? "Abgerechnet" : r.billable ? "Abrechenbar" : "Intern"}</span></td><td>${r.invoice_id ? btn("invoice", "Rechnung", r.invoice_id, "text-button") : btn("edit", "Bearbeiten", r.id, "text-button")}</td></tr>`).join("") || '<tr><td colspan="7"><div class="empty-state"><h3>Noch keine passenden Zeiten</h3><p>Starten Sie den Timer oder erfassen Sie eine bereits geleistete Tätigkeit.</p></div></td></tr>'}</tbody></table></div>`;
  }
  function timeView() {
    const timer = store.runningTimer;
    const entries = store.timeEntries || [];
    const pending = entries.filter((r) => r.billable && !r.invoice_id);
    return `<section class="work-hero"><div><div class="eyebrow">VON DER ARBEIT ZUR RECHNUNG</div><h2>${timer ? "Ihr Timer läuft." : "Ihre Arbeit verdient eine Rechnung."}</h2><p>${timer ? `${e(timer.description)} · ${e(projectName(timer.project_id))}` : "Zeit erfassen, Tätigkeiten auswählen und einen Rechnungsentwurf erstellen. Alles bleibt lokal."}</p></div><div class="work-timer-controls">${timer ? `<strong class="work-clock" data-work-clock></strong>${btn("stop", "Timer stoppen", "", "btn btn-primary")}${btn("cancel-timer", "Verwerfen", "", "text-button")}` : btn("start", "▶ Timer starten", "", "btn btn-primary")}${btn("manual", "+ Zeit nachtragen")}</div></section><div class="work-metrics"><div><span>Erfasste Zeit</span><strong>${duration(entries.reduce((n, r) => n + r.minutes, 0))}</strong><small>Alle gespeicherten Einträge</small></div><div><span>Noch nicht abgerechnet</span><strong>${money(pending.reduce((n, r) => n + value(r), 0))}</strong><small>${pending.length} abrechenbare Einträge · netto</small></div><div><span>Abgerechnete Einträge</span><strong>${entries.filter((r) => r.invoice_id).length}</strong><small>Mit einem Rechnungsentwurf oder einer Rechnung verknüpft</small></div></div><section class="card"><div class="work-filters">${field("Projekt", projects("project-filter", project, true))}${field(
      "Status",
      option(
        "status-filter",
        [
          ["all", "Alle Einträge"],
          ["unbilled", "Noch abrechenbar"],
          ["billed", "Abgerechnet"],
          ["internal", "Interne Arbeit"],
        ],
        status,
      ),
    )}${field("Suchen", input("query", query, "search", 'placeholder="Tätigkeit oder Projekt …"'))}</div><p class="work-hint">${project ? "Wählen Sie die Tätigkeiten aus, die gemeinsam auf eine Rechnung gehören." : "Wählen Sie ein Projekt, um Zeiten auszuwählen und abzurechnen."}</p><div id="work-table-area">${table()}</div></section>`;
  }
  function reportView() {
    const sum = (k) => reports.reduce((n, r) => n + r[k], 0);
    return `<section class="work-report-intro"><div><h2>Wissen, was Ihre Arbeit einbringt.</h2><p>Planwerte, Kosten und Rechnungen Ihres gesamten Projektbestands – klar voneinander getrennt.</p></div>${btn("cost", "+ Projektkosten erfassen", "", "btn btn-primary")}</section><div class="work-metrics"><div><span>Erfasster Arbeitswert</span><strong>${money(sum("value"))}</strong><small>Abrechenbare Zeit × Stundensatz, netto</small></div><div><span>Interne Arbeit & Projektkosten</span><strong>${money(sum("labor") + sum("costs"))}</strong><small>${money(sum("labor"))} kalkulierte Arbeit · ${money(sum("costs"))} Ausgaben</small></div><div><span>Kalkulierter Beitrag</span><strong class="${sum("contribution") < 0 ? "overdue-text" : ""}">${money(sum("contribution"))}</strong><small>Arbeitswert abzüglich erfasster Kosten</small></div></div><div class="work-report-grid">${reports.map((r) => `<article class="card work-report-card"><div class="section-heading"><div><span class="eyebrow">${e(store.clients.find((c) => c.id === r.project.client_id)?.name || "Noch kein Kunde")}</span><h2>${e(r.project.name)}</h2></div><span class="business-badge">${duration(r.minutes)}</span></div><div class="work-report-numbers"><div><span>Arbeitswert netto</span><b>${money(r.value)}</b></div><div><span>Unabgerechnet netto</span><b>${money(r.unbilled)}</b></div><div><span>Interne Arbeitskosten</span><b>${money(r.labor)}</b></div><div><span>Projektkosten (${r.expenses} Belege)</span><b>${money(r.costs)}</b></div><div><span>Rechnungen ohne Entwürfe, netto</span><b>${money(r.invoiced)}</b></div><div><span>Als bezahlt markiert, netto</span><b>${money(r.paid)}</b></div></div><div class="work-contribution"><span>Kalkulierter Beitrag</span><strong class="${r.contribution < 0 ? "overdue-text" : ""}">${money(r.contribution)}</strong></div>${r.project.budget > 0 ? `<div class="work-budget"><span>Arbeitswert / Planbudget: ${money(r.value)} / ${money(r.project.budget)}</span><progress max="${r.project.budget}" value="${Math.min(r.project.budget, r.value)}"></progress>${r.value > r.project.budget ? '<small class="overdue-text">Arbeitswert liegt über dem Planbudget.</small>' : ""}</div>` : '<p class="work-hint">Kein Planbudget hinterlegt.</p>'}<div class="record-actions">${btn("project-work", "Zeiten & Abrechnung", r.project.id)}${btn("cost", "Kosten erfassen", r.project.id)}${btn("project-detail", "Details", r.project.id, "text-button")}</div></article>`).join("") || '<div class="empty-state"><h3>Ihr erster Projektbericht wartet</h3><p>Legen Sie ein Projekt an und erfassen Sie Ihre Arbeit.</p>' + btn("projects", "Projekte öffnen", "", "btn btn-primary") + "</div>"}</div><p class="work-report-footnote">Kalkulation, kein steuerlicher Gewinn: interne Arbeitskosten = Zeit × hinterlegter Kostensatz. Bei einem Kostensatz von 0 € sind keine internen Kosten berücksichtigt. Ausgaben werden bei Kleinunternehmen brutto, sonst rechnerisch ohne Umsatzsteuer berücksichtigt. Laufende Timer zählen erst nach dem Speichern. Rechnungswerte folgen dem manuell gepflegten Status.</p>`;
  }
  function paint() {
    if (currentView !== view) return;
    const root = document.getElementById("content-container");
    root.innerHTML = `<div class="page-header"><div><div class="eyebrow">RECHLY · ARBEIT & ERTRAG</div><h1 class="page-title">${view === "reports" ? "Projektcontrolling" : "Zeiten & Abrechnung"}</h1><p class="page-subtitle">${view === "reports" ? "Erkennen Sie Aufwand, offene Leistungen und Kosten frühzeitig." : "Ein durchgängiger Ablauf für Ihren persönlichen Arbeitsalltag."}</p></div>${btn("export", "Zeiten als CSV exportieren")}</div>${view === "reports" ? reportView() : timeView()}`;
    root.onclick = actions;
    root.onchange = change;
    root.querySelector("[name=query]")?.addEventListener("input", (ev) => {
      query = ev.target.value;
      document.getElementById("work-table-area").innerHTML = table();
    });
    ticker();
  }
  function change(ev) {
    const target = ev.target;
    if (target.name === "project-filter") {
      project = target.value;
      selected.clear();
      paint();
    } else if (target.name === "status-filter") {
      status = target.value;
      paint();
    } else if (target.dataset.timeSelect) {
      target.checked
        ? selected.add(target.dataset.timeSelect)
        : selected.delete(target.dataset.timeSelect);
      document.getElementById("work-table-area").innerHTML = table();
    } else if (target.id === "work-select-all") {
      for (const r of visible().filter(eligible))
        target.checked ? selected.add(r.id) : selected.delete(r.id);
      document.getElementById("work-table-area").innerHTML = table();
    }
  }
  async function refresh(nextView = view) {
    view = nextView;
    const token = ++generation;
    try {
      const result = await window.rechly.getWork();
      if (token !== generation) return;
      store = result.store;
      reports = result.reports;
      number = result.nextInvoiceNumber;
      currentStore = store;
      selected = new Set(
        [...selected].filter((id) =>
          (store.timeEntries || []).some(
            (r) => r.id === id && !r.invoice_id && r.billable,
          ),
        ),
      );
      updateBadges();
      paint();
      ticker();
    } catch (err) {
      showToast(err.message, "error");
    }
  }
  function open(kind, id = "") {
    if (!store?.business?.projects.length && kind !== "detail") {
      showToast("Bitte legen Sie zuerst ein Projekt an.", "error");
      showView("projects");
      return;
    }
    const old =
      kind === "edit"
        ? store.timeEntries.find((r) => r.id === id)
        : kind === "stop"
          ? store.runningTimer
          : null;
    if (kind === "edit" && !old) return;
    const defaults = {
      project_id: project || store.business.projects[0].id,
      description: "",
      rate: 95,
      cost_rate: 0,
      billable: true,
      date: localToday(),
      minutes: 60,
      ...old,
    };
    editing = { kind, id, dirty: false, opener: document.activeElement };
    let fields = "",
      title = "";
    if (["manual", "edit", "start"].includes(kind)) {
      title =
        kind === "start"
          ? "Timer starten"
          : kind === "edit"
            ? "Zeiteintrag bearbeiten"
            : "Zeit nachtragen";
      fields =
        field("Projekt", projects("project_id", defaults.project_id)) +
        field(
          "Tätigkeit",
          input(
            "description",
            defaults.description,
            "text",
            'required maxlength="1000" placeholder="Was haben Sie erledigt?"',
          ),
        ) +
        `<div class="form-grid">${kind !== "start" ? field("Leistungsdatum", input("date", defaults.date, "date", "required")) + field("Dauer in Minuten", input("minutes", defaults.minutes, "number", 'required min="1" max="1440" step="1"')) : ""}${field("Stundensatz netto (€)", input("rate", defaults.rate, "number", 'required min="0" max="100000" step="0.01"'))}${field("Interner Kostensatz (€ / Std.)", input("cost_rate", defaults.cost_rate, "number", 'required min="0" max="100000" step="0.01"'))}</div><label class="work-check"><input type="checkbox" name="billable" ${defaults.billable ? "checked" : ""}>Diese Tätigkeit ist abrechenbar</label><p class="work-hint">Der Kostensatz dient nur Ihrer Kalkulation und erscheint nicht auf der Kundenrechnung.</p>`;
    }
    if (kind === "stop") {
      title = "Timer abschließen";
      const minutes = Math.max(
        1,
        Math.ceil((Date.now() - store.runningTimer.started_at) / 60000),
      );
      fields =
        `<h3>${e(store.runningTimer.description)}</h3><p class="work-hint">${e(projectName(store.runningTimer.project_id))} · Zuordnung zum Startdatum des Timers. Prüfen Sie die Dauer vor dem Speichern.</p>` +
        field(
          "Dauer in Minuten",
          input(
            "minutes",
            minutes,
            "number",
            'required min="1" max="1440" step="1"',
          ),
        ) +
        (minutes > 1440
          ? '<p class="work-warning">Der Timer lief länger als 24 Stunden. Bitte korrigieren Sie die Dauer; weitere Tage können Sie separat nachtragen.</p>'
          : "");
    }
    if (kind === "cost") {
      title = "Projektkosten erfassen";
      fields =
        field(
          "Projekt",
          projects(
            "project_id",
            id || project || store.business.projects[0].id,
          ),
        ) +
        field(
          "Lieferant / Kostenstelle",
          input("vendor_name", "", "text", 'required maxlength="200"'),
        ) +
        `<div class="form-grid">${field("Datum", input("date", localToday(), "date", "required"))}${field("Betrag brutto (€)", input("amount_gross", "", "number", 'required min="0" max="1000000000" step="0.01"'))}${field(
          "Enthaltene Umsatzsteuer",
          option(
            "vat_rate",
            [
              ["19", "19 %"],
              ["7", "7 %"],
              ["0", "0 %"],
            ],
            "19",
          ),
        )}</div>` +
        field(
          "Beschreibung",
          input("description", "", "text", 'maxlength="1000"'),
        ) +
        '<p class="work-hint">Die Ausgabe wird auch unter „Ausgaben & Belege“ gespeichert und kann dort bearbeitet werden.</p>';
    }
    if (kind === "bill") {
      const rows = store.timeEntries.filter((r) => selected.has(r.id));
      if (!project || !rows.length) {
        editing = null;
        showToast(
          "Bitte ein Projekt und abrechenbare Zeiten auswählen.",
          "error",
        );
        return;
      }
      title = "Aus Zeiten wird eine Rechnung";
      const due = new Date();
      due.setDate(due.getDate() + 14);
      const dueDate = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
      fields =
        `<p class="work-hint">Projekt: <b>${e(projectName(project))}</b>. Es wird ein Entwurf erstellt. Jede Tätigkeit wird mit Dauer und Stundensatz als eigene Leistung ausgewiesen.</p><div class="work-bill-summary">${rows.length} Tätigkeiten · ${duration(rows.reduce((n, r) => n + r.minutes, 0))}<strong>${money(rows.reduce((n, r) => n + value(r), 0))} netto</strong></div><p class="work-hint">${store.company.is_small_business ? "Kleinunternehmer: keine Umsatzsteuer." : "Umsatzsteuer: 19 %. Prüfen Sie den Entwurf vor dem Versand."}</p>` +
        field(
          "Rechnungsnummer",
          input("invoice_number", number, "text", 'required maxlength="100"'),
        ) +
        `<div class="form-grid">${field("Rechnungsdatum", input("issue_date", localToday(), "date", "required"))}${field("Zahlbar bis", input("due_date", dueDate, "date", "required"))}</div>`;
    }
    if (kind === "detail") {
      title = "Projektdetails";
      const rows = store.expenses.filter((r) => r.project_id === id);
      fields = `<h3>${e(projectName(id))}</h3><h4 class="work-detail-heading">Erfasste Ausgaben</h4>${rows.map((r) => `<div class="work-detail-row"><span>${e(r.vendor_name)}<small>${date(r.date)} · ${e(r.description)}</small></span><b>${money(r.amount_gross)} brutto</b></div>`).join("") || '<p class="work-hint">Noch keine Projektkosten erfasst.</p>'}<h4 class="work-detail-heading">Verknüpfte Rechnungen</h4>${
        store.invoices
          .filter((i) => i.project_id === id)
          .map(
            (i) =>
              `<div class="work-detail-row"><span>${e(i.invoice_number)}<small>${e({ draft: "Entwurf", sent: "Offen", paid: "Bezahlt" }[i.status] || i.status)}</small></span><b>${money(i.total_gross)} brutto</b></div>`,
          )
          .join("") ||
        '<p class="work-hint">Noch keine Rechnung aus Zeiten erstellt.</p>'
      }`;
    }
    const dialog = document.getElementById("work-editor");
    dialog.innerHTML = `<form id="work-form"><header><div><span class="eyebrow">ARBEIT & ERTRAG</span><h2 id="work-editor-title">${title}</h2></div>${btn("close", "✕", "", "btn btn-secondary", 'aria-label="Schließen"')}</header><div class="work-editor-body">${fields}<p id="work-form-error" role="alert"></p></div><footer><div>${kind === "edit" ? btn("delete", "Zeiteintrag löschen", id, "btn btn-danger-outline") : ""}</div><div>${btn("close", kind === "detail" ? "Schließen" : "Abbrechen")}${kind === "detail" ? "" : `<button class="btn btn-primary" type="submit">${kind === "bill" ? "Rechnungsentwurf erstellen" : kind === "start" ? "Timer starten" : "Speichern"}</button>`}</div></footer></form>`;
    dialog.onclick = actions;
    const form = dialog.querySelector("form");
    form.oninput = () => (editing.dirty = true);
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      if (busy) return;
      busy = true;
      const submit = form.querySelector("[type=submit]");
      submit.disabled = true;
      const values = Object.fromEntries(new FormData(form));
      let invoice = null;
      try {
        if (["manual", "edit", "start"].includes(kind)) {
          const raw = {
            ...values,
            rate: Number(values.rate),
            cost_rate: Number(values.cost_rate),
            billable: form.elements.billable.checked,
          };
          if (kind === "start") await window.rechly.startTimer(raw);
          else
            await window.rechly.saveTime({
              ...raw,
              minutes: Number(values.minutes),
              ...(id ? { id } : {}),
            });
        }
        if (kind === "stop")
          await window.rechly.stopTimer(Number(values.minutes));
        if (kind === "cost")
          await window.rechly.createExpense({
            ...values,
            amount_gross: Number(values.amount_gross),
            vat_rate: Number(values.vat_rate),
            category: "Projektkosten",
          });
        if (kind === "bill") {
          invoice = await window.rechly.invoiceTime({
            ...values,
            project_id: project,
            entry_ids: [...selected],
          });
          selected.clear();
        }
        editing.dirty = false;
        busy = false;
        close();
        await refresh();
        showToast(
          invoice
            ? "Rechnungsentwurf erstellt. Die gewählten Zeiten sind jetzt gesperrt."
            : "Erfolgreich gespeichert.",
        );
        if (invoice) {
          document.getElementById("global-search").value = "";
          showView("invoices");
          previewInvoice(invoice.id);
        }
      } catch (err) {
        document.getElementById("work-form-error").textContent = err.message;
      } finally {
        busy = false;
        submit.disabled = false;
      }
    };
    dialog.showModal();
    (
      dialog.querySelector("input,select") || dialog.querySelector("button")
    )?.focus();
  }
  function close() {
    if (busy) return;
    if (editing?.dirty && !confirm("Ungespeicherte Änderungen verwerfen?"))
      return;
    const opener = editing?.opener;
    document.getElementById("work-editor").close();
    editing = null;
    opener?.focus();
  }
  async function actions(event) {
    const target = event.target.closest("[data-work-action]");
    if (!target) return;
    const { workAction: action, id } = target.dataset;
    try {
      if (["start", "manual", "edit", "stop", "cost", "bill"].includes(action))
        open(action, id);
      if (action === "project-detail") open("detail", id);
      if (action === "close") close();
      if (action === "projects") showView("projects");
      if (action === "project-work") {
        project = id;
        selected.clear();
        showView("worklog");
      }
      if (action === "invoice") {
        showView("invoices");
        previewInvoice(id);
      }
      if (action === "delete" && confirm("Diesen Zeiteintrag löschen?")) {
        await window.rechly.deleteTime(id);
        editing.dirty = false;
        close();
        await refresh();
      }
      if (
        action === "cancel-timer" &&
        confirm("Laufenden Timer ohne Zeiteintrag verwerfen?")
      ) {
        await window.rechly.cancelTimer();
        await refresh();
      }
      if (action === "export") {
        target.disabled = true;
        const result = await window.rechly.exportTime();
        if (result.success) showToast("Alle Zeiten als CSV exportiert.");
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      target.disabled = false;
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    const dialog = document.createElement("dialog");
    dialog.id = "work-editor";
    dialog.setAttribute("aria-labelledby", "work-editor-title");
    document.body.append(dialog);
    dialog.oncancel = (ev) => {
      ev.preventDefault();
      close();
    };
    const chip = document.createElement("button");
    chip.id = "work-timer-chip";
    chip.className = "work-timer-chip";
    chip.hidden = true;
    chip.onclick = () => showView("worklog");
    document.querySelector(".titlebar-center").append(chip);
    window.rechly
      .getWork()
      .then((result) => {
        store = result.store;
        ticker();
      })
      .catch(() => {});
    setInterval(ticker, 1000);
    window.addEventListener("beforeunload", (ev) => {
      if (editing?.dirty) {
        ev.preventDefault();
        ev.returnValue = "";
      }
    });
  });
  return {
    render: refresh,
    sync: (snapshot) => {
      store = snapshot;
      selected.clear();
      ticker();
    },
  };
})();
