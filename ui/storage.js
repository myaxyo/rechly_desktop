window.StorageUI = (() => {
  const esc = (v) =>
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
  let busy = false,
    finish = null;
  const message = (text, error = false) => {
    if (typeof showToast === "function")
      showToast(text, error ? "error" : "success");
    else document.getElementById("recovery-message").textContent = text;
  };
  function close(result = false) {
    if (busy) return;
    const dialog = document.getElementById("storage-dialog");
    dialog.close();
    dialog.replaceChildren();
    const resolve = finish;
    finish = null;
    resolve?.(result);
  }
  function open(title, body, submit) {
    const dialog = document.getElementById("storage-dialog");
    if (dialog.open)
      throw Error("Bitte schließen Sie zuerst den aktuellen Sicherungsdialog.");
    dialog.innerHTML = `<form id="storage-form"><header><span class="eyebrow">DATEN & SICHERUNG</span><h2 id="storage-title">${esc(title)}</h2></header><div id="storage-body">${body}</div><p id="storage-error" role="alert"></p><footer><button type="button" class="btn btn-secondary" id="storage-cancel">Abbrechen</button><button type="submit" class="btn btn-primary" id="storage-submit">${esc(submit)}</button></footer></form>`;
    dialog.querySelector("#storage-cancel").onclick = () => close();
    dialog.showModal();
    dialog.querySelector("input,button").focus();
    return new Promise((resolve) => {
      finish = resolve;
    });
  }
  async function act(action) {
    if (busy) return;
    busy = true;
    document.getElementById("storage-submit").disabled = true;
    document.getElementById("storage-error").textContent = "";
    try {
      await action();
    } catch (error) {
      document.getElementById("storage-error").textContent = error.message;
    } finally {
      busy = false;
      const button = document.getElementById("storage-submit");
      if (button) button.disabled = false;
    }
  }
  async function exportBackup() {
    const done = open(
      "Verschlüsselte Sicherung erstellen",
      `<p>Diese portable Sicherung enthält Ihre Geschäftsdaten, aber keine Cloud-API-Schlüssel. Bewahren Sie eine Kopie auf einem separaten Laufwerk auf.</p><label>Passwort (mindestens 12 Zeichen)<input name="password" type="password" required minlength="12" maxlength="1024" autocomplete="new-password"></label><label>Passwort wiederholen<input name="confirmation" type="password" required minlength="12" maxlength="1024" autocomplete="new-password"></label><p class="storage-note">Ohne dieses Passwort kann die Sicherung nicht wiederhergestellt werden. Speichern Sie es in Ihrem Passwortmanager.</p>`,
      "Datei speichern …",
    );
    document.getElementById("storage-form").onsubmit = (event) => {
      event.preventDefault();
      act(async () => {
        const form = event.target;
        if (form.password.value !== form.confirmation.value)
          throw Error("Die Passwörter stimmen nicht überein.");
        const result = await window.rechly.exportBackup(form.password.value);
        if (result.success) {
          busy = false;
          close(true);
          message("Verschlüsselte Sicherung gespeichert.");
        }
      });
    };
    return done;
  }
  async function importBackup() {
    let file;
    try {
      file = await window.rechly.selectBackup();
    } catch (error) {
      message(error.message, true);
      return false;
    }
    if (!file) return false;
    let phase = "preview";
    const done = open(
      "Sicherung wiederherstellen",
      `<p><b>${esc(file.name)}</b></p>${file.encrypted ? '<label>Sicherungspasswort<input name="password" type="password" required minlength="12" maxlength="1024" autocomplete="current-password"></label>' : "<p>Diese ältere oder lokale Sicherung ist nicht passwortverschlüsselt. Ihre Inhalte werden vor dem Import geprüft.</p>"}<p class="storage-note">Zuerst prüfen Sie Firma und Datensatzanzahl. Erst im nächsten Schritt werden Ihre aktuellen Daten ersetzt.</p>`,
      "Sicherung prüfen",
    );
    document.getElementById("storage-form").onsubmit = (event) => {
      event.preventDefault();
      act(async () => {
        if (phase === "preview") {
          const preview = await window.rechly.previewBackup(
            file.token,
            event.target.password?.value || "",
          );
          const names = {
            invoices: "Rechnungen",
            clients: "Kunden",
            products: "Leistungen & Artikel",
            offers: "Angebote",
            expenses: "Ausgaben",
            projects: "Projekte",
            tasks: "Aufgaben",
            documents: "Dokumente",
            calendar: "Termine",
            timeEntries: "Zeiteinträge",
          };
          document.getElementById("storage-body").innerHTML =
            `<h3>${esc(preview.company)}</h3><dl class="storage-counts">${Object.entries(
              preview.counts,
            )
              .map(
                ([key, value]) =>
                  `<div><dt>${esc(names[key] || key)}</dt><dd>${esc(value)}</dd></div>`,
              )
              .join(
                "",
              )}</dl><p class="storage-note">Die Wiederherstellung ersetzt Ihren gesamten aktuellen Datenbestand. Vorher wird eine lokale Rücksicherung angelegt. Bei einer beschädigten Datenbank bleiben die ursprünglichen Dateien erhalten.</p>${preview.containsApiKeys ? "<p>Diese Altsicherung enthält API-Schlüssel. Sie werden beim Import im Schlüsselspeicher des Betriebssystems geschützt.</p>" : "<p>Cloud-API-Schlüssel sind anschließend bei Bedarf neu einzugeben.</p>"}`;
          phase = "restore";
          document.getElementById("storage-submit").textContent =
            "Daten ersetzen und wiederherstellen";
        } else {
          await window.rechly.restoreBackup(file.token);
          busy = false;
          close(true);
        }
      });
    };
    return done;
  }
  async function renderStatus() {
    try {
      const info = await window.rechly.getStorageInfo();
      const box = document.getElementById("storage-status");
      if (!box) return;
      box.innerHTML = `<strong>SQLite · lokale Datenbank</strong><p class="storage-path">${esc(info.databasePath)}</p><p>Transaktionen schützen zusammengehörige Änderungen. Lokale Rücksicherungen werden an Nutzungstagen angelegt (bis zu 7 Tagessicherungen und 3 Sicherungen vor Wiederherstellungen).</p><p><b>Geräteschutz:</b> Die Geschäftsdatenbank und lokalen Rücksicherungen sind nicht verschlüsselt. Nutzen Sie FileVault (Mac) bzw. BitLocker (Windows) und ein geschütztes Benutzerkonto. Cloud-API-Schlüssel werden über den sicheren Betriebssystemspeicher geschützt.</p><p><b>Portable Sicherungen:</b> Exporte sind mit Ihrem Passwort verschlüsselt. Sie enthalten keine Cloud-API-Schlüssel.</p>${info.legacyFiles?.length ? `<p class="storage-warning">Alte, unverschlüsselte JSON-Dateien wurden zur Sicherheit behalten: ${info.legacyFiles.map(esc).join(", ")}. Entfernen Sie diese erst, nachdem Sie die übernommenen Daten und eine externe Sicherung geprüft haben.</p>` : ""}${info.warning ? `<p class="storage-warning">${esc(info.warning)}</p>` : ""}`;
    } catch (error) {
      message(error.message, true);
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    const dialog = document.createElement("dialog");
    dialog.id = "storage-dialog";
    dialog.setAttribute("aria-labelledby", "storage-title");
    dialog.oncancel = (event) => {
      event.preventDefault();
      close();
    };
    document.body.append(dialog);
    window.rechly.onBackupRequested(() => {
      if (!dialog.open)
        exportBackup().catch((error) => message(error.message, true));
    });
  });
  return { exportBackup, importBackup, renderStatus };
})();
