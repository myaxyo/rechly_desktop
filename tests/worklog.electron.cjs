const { _electron } = require(
  process.env.RECHLY_PLAYWRIGHT_PATH || "playwright-core",
);
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const root = path.resolve(__dirname, ".."),
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "rechly-worklog-"));
const launch = () =>
  _electron.launch({
    executablePath:
      process.env.RECHLY_EXECUTABLE ||
      require(path.join(root, "node_modules/electron")),
    args: [
      ...(process.env.RECHLY_EXECUTABLE ? [] : [root]),
      "--no-sandbox",
      "--disable-gpu",
      "--user-data-dir=" + profile,
    ],
    env: { ...process.env, XDG_CONFIG_HOME: profile },
  });
(async () => {
  let app = await launch();
  try {
    let page = await app.firstWindow();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.waitForFunction(() => window.rechly);
    await page.evaluate(async () => {
      await window.rechly.completeOnboarding({
        cloud_ai_opt_in: false,
        remove_sample_data: false,
      });
      const company = await window.rechly.getCompany();
      await window.rechly.saveCompany({ ...company, is_small_business: false });
      await window.rechly.saveBusiness("projects", {
        name: "Website Relaunch",
        description: "Konzept und Umsetzung",
        client_id: "client-sample-1",
        status: "active",
        due_date: "",
        budget: 2500,
      });
    });
    await page.reload();
    await page.waitForSelector(".feature-launch");
    await page.waitForFunction(() =>
      document.getElementById("app-version")?.textContent.includes("1."),
    );
    await page.locator("#nav-worklog").click();
    await page
      .getByRole("button", { name: "+ Zeit nachtragen", exact: true })
      .click();
    await page.locator("#work-form [name=description]").fill("Startworkshop");
    await page.locator("#work-form [name=minutes]").fill("90");
    await page.locator("#work-form [name=rate]").fill("100");
    await page.locator("#work-form [name=cost_rate]").fill("40");
    await page.locator("#work-form [type=submit]").click();
    await page.waitForSelector("#work-editor", { state: "hidden" });
    await page.waitForSelector("[data-time-select]");
    let data = await page.evaluate(() => window.rechly.getWork());
    const project = data.reports[0].project.id,
      time = data.store.timeEntries[0].id;
    await page.locator("#nav-reports").click();
    await page
      .getByRole("button", { name: "+ Projektkosten erfassen", exact: true })
      .click();
    await page.locator("#work-form [name=vendor_name]").fill("Designmaterial");
    await page.locator("#work-form [name=amount_gross]").fill("119");
    await page.locator("#work-form [name=description]").fill("Bildlizenzen");
    await page.locator("#work-form [type=submit]").click();
    await page.waitForSelector("#work-editor", { state: "hidden" });
    await page.waitForFunction(
      async () => (await window.rechly.getWork()).reports[0].costs === 100,
    );
    data = await page.evaluate(() => window.rechly.getWork());
    assert.equal(data.reports[0].contribution, -10);
    await page.locator("#nav-expenses").click();
    await page
      .locator("tr")
      .filter({ hasText: "Designmaterial" })
      .getByRole("button", { name: /Bearbeiten/ })
      .click();
    assert.equal(
      await page.locator("#modal-exp-project").inputValue(),
      project,
    );
    await page.locator("#modal-exp-vat").selectOption("0");
    await page.locator("#modal-exp-amount").fill("100");
    await page
      .locator("#modal-exp-description")
      .fill("Lizenz ohne Umsatzsteuer");
    await page.locator("#modal-exp-save").click();
    await page.waitForSelector("#modal-expense", { state: "hidden" });
    data = await page.evaluate(() => window.rechly.getWork());
    const expense = data.store.expenses.find(
      (e) => e.vendor_name === "Designmaterial",
    );
    assert.equal(expense.vat_rate, 0);
    assert.equal(expense.project_id, project);
    assert.equal(expense.description, "Lizenz ohne Umsatzsteuer");
    assert.equal(data.reports[0].costs, 100);
    await page.locator("#nav-reports").click();
    await page.waitForSelector(".work-report-card");

    await page.screenshot({ path: path.join(profile, "project-reports.png") });
    await page.getByRole("button", { name: "Details", exact: true }).click();
    assert.match(
      await page.locator("#work-editor").innerText(),
      /Designmaterial/,
    );
    await page.locator("#work-editor footer [data-work-action=close]").click();
    await page.locator("#nav-worklog").click();
    await page.locator("[name=project-filter]").selectOption(project);
    await page.locator("[data-time-select]").check();
    await page
      .getByRole("button", { name: "Auswahl abrechnen", exact: true })
      .click();
    await page.locator("#work-form [type=submit]").click();
    await page.waitForSelector("#work-editor", { state: "hidden" });
    await page.waitForSelector("#print-modal", { state: "visible" });
    data = await page.evaluate(() => window.rechly.getWork());
    let invoice = data.store.invoices.find((i) => i.project_id === project);
    assert.equal(invoice.total_gross, 178.5);
    assert.equal(data.store.timeEntries[0].invoice_id, invoice.id);
    await page.keyboard.press("Escape");
    const rejected = await page.evaluate(
      async ({ project, time }) => {
        try {
          await window.rechly.invoiceTime({
            project_id: project,
            entry_ids: [time],
            issue_date: "2026-10-26",
            due_date: "2026-11-09",
          });
          return false;
        } catch {
          return true;
        }
      },
      { project, time },
    );
    assert.equal(rejected, true);
    await page.evaluate((id) => window.rechly.deleteInvoice(id), invoice.id);
    data = await page.evaluate(() => window.rechly.getWork());
    assert.equal(data.store.timeEntries[0].invoice_id, "");
    await page.locator("#nav-worklog").click();
    await page.locator("[data-time-select]").check();
    await page
      .getByRole("button", { name: "Auswahl abrechnen", exact: true })
      .click();
    await page.locator("#work-form [type=submit]").click();
    await page.waitForSelector("#print-modal", { state: "visible" });
    await page.keyboard.press("Escape");
    data = await page.evaluate(() => window.rechly.getWork());
    invoice = data.store.invoices.find((i) => i.project_id === project);
    await page.evaluate(
      (id) => window.rechly.updateInvoice(id, { status: "paid" }),
      invoice.id,
    );
    assert.equal(
      await page.evaluate(async (id) => {
        try {
          await window.rechly.deleteInvoice(id);
          return false;
        } catch {
          return true;
        }
      }, invoice.id),
      true,
    );
    await page.locator("#nav-worklog").click();
    await page
      .getByRole("button", { name: "▶ Timer starten", exact: true })
      .click();
    await page.locator("#work-form [name=description]").fill("Umsetzung");
    await page.locator("#work-form [type=submit]").click();
    await page.waitForSelector("#work-editor", { state: "hidden" });
    await page.waitForSelector("#work-timer-chip", { state: "visible" });
    const { spawn } = require("node:child_process");
    const secondary = spawn(
      process.env.RECHLY_EXECUTABLE ||
        require(path.join(root, "node_modules/electron")),
      [
        ...(process.env.RECHLY_EXECUTABLE ? [] : [root]),
        "--no-sandbox",
        "--disable-gpu",
        "--user-data-dir=" + profile,
      ],
      { env: { ...process.env, XDG_CONFIG_HOME: profile }, stdio: "ignore" },
    );
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        secondary.kill();
        reject(Error("Second app instance did not exit"));
      }, 15000);
      secondary.once("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      secondary.once("exit", (code) => {
        clearTimeout(timeout);
        code === 0
          ? resolve()
          : reject(Error("Second instance exited with " + code));
      });
    });
    assert.equal(
      await app.evaluate(
        ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
      ),
      1,
    );
    assert.ok(
      (await page.evaluate(() => window.rechly.getWork())).store.runningTimer,
    );
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.waitForSelector("#work-timer-chip", { state: "visible" });
    await page.locator("#work-timer-chip").click();
    await page
      .getByRole("button", { name: "Timer stoppen", exact: true })
      .click();
    await page.locator("#work-form [name=minutes]").fill("30");
    await page.locator("#work-form [type=submit]").click();
    await page.waitForSelector("#work-editor", { state: "hidden" });
    await page.waitForSelector("#work-timer-chip", { state: "hidden" });
    data = await page.evaluate(() => window.rechly.getWork());
    assert.equal(data.store.timeEntries.length, 2);
    assert.equal(data.store.runningTimer, null);
    assert.equal(data.reports[0].paid, 150);
    await page.getByRole("button", { name: "Bearbeiten", exact: true }).click();
    await page.locator("#work-form [name=description]").fill("Unsaved");
    page.once("dialog", (d) => d.dismiss());
    await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
    assert.equal(await page.locator("#work-editor").isVisible(), true);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
    await page.waitForSelector("#work-editor", { state: "hidden" });
    const csv = path.join(profile, "times.csv");
    await app.evaluate(({ dialog }, p) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: p });
    }, csv);
    await page
      .getByRole("button", { name: "Zeiten als CSV exportieren", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document.getElementById("toast").textContent ===
        "Alle Zeiten als CSV exportiert.",
    );
    assert.match(fs.readFileSync(csv, "utf8"), /Startworkshop/);
    await page.screenshot({ path: path.join(profile, "time-billing.png") });
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(980, 700),
    );
    await page.screenshot({
      path: path.join(profile, "time-billing-compact.png"),
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: time entry, expense, reports, invoice generation, duplicate billing protection, draft unlink, paid deletion protection, timer restart, single-instance protection, dirty editor, CSV, compact layout.",
    );
    console.log("Artifacts:", profile);
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
