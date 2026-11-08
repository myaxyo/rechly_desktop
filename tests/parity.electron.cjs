// Run after npm run build. RECHLY_HEADLESS=1 supports Linux CI without X11.
const { _electron } = require(process.env.RECHLY_PLAYWRIGHT_PATH || 'playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rechly-parity-'));
(async () => {
    const app = await _electron.launch({ executablePath: require('electron'), args: [root, '--no-sandbox', '--disable-gpu', '--user-data-dir=' + profile, ...(process.env.RECHLY_HEADLESS === '1' ? ['--ozone-platform=headless'] : [])] });
    try {
        const page = await app.firstWindow();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.waitForFunction(() => window.rechly);
        await page.evaluate(() => window.rechly.completeOnboarding({ cloud_ai_opt_in: false, remove_sample_data: false }));
        await page.reload();
        await page.waitForSelector('.business-hero');
        const id = await page.evaluate(async () => {
            await window.rechly.saveCompany({ ...(await window.rechly.getCompany()), name: 'Test GmbH', bank_iban: 'DE89370400440532013000', bank_bic: 'COBADEFFXXX', show_payment_qr: true, is_small_business: false });
            const invoice = await window.rechly.createInvoice({ invoice_number: 'RE-PARITY-1', client_id: 'client-sample-1', issue_date: '2026-11-07', due_date: '2026-11-21', status: 'sent', items: [{ description: 'Beratung <b>Text</b>', quantity: 2, price: 50, discount_percent: 10, tax_rate_percent: 7 }] });
            currentStore = await window.rechly.getStore();
            return invoice.id;
        });
        await app.evaluate(({ dialog, shell }, directory) => {
            dialog.showSaveDialog = async () => ({ canceled: false, filePath: directory + '/payment.pdf' });
            shell.showItemInFolder = () => {};
        }, profile);
        for (const template of ['classic', 'modern', 'minimal']) {
            await page.evaluate(async ({ id, template }) => {
                currentStore.company.invoice_template = template;
                await window.rechly.saveCompany(currentStore.company);
                await previewDocument('invoice', id);
            }, { id, template });
            await page.locator('.invoice-payment-qr img').waitFor();
            assert.equal(await page.locator('.invoice-payment-qr img').evaluate(img => img.complete && img.naturalWidth > 0), true);
            const text = await page.locator('#print-sheet-content').innerText();
            assert.match(text, /90\.00/);
            assert.match(text, /10% Rabatt/);
            assert.match(text, /7% USt/);
            assert.match(text, /Beratung <b>Text<\/b>/);
            assert.doesNotMatch(text, /MwSt\. \(19%\)/);
        }
        const result = await page.evaluate(id => window.rechly.exportPdf(id), id);
        assert.equal(result.success, true);
        assert.equal(fs.readFileSync(path.join(profile, 'payment.pdf')).subarray(0, 4).toString(), '%PDF');
        await page.screenshot({ path: path.join(profile, 'payment-preview.png') });
        await page.evaluate(async id => {
            await window.rechly.updateInvoice(id, { status: 'paid' });
            currentStore = await window.rechly.getStore();
            await previewDocument('invoice', id);
        }, id);
        assert.equal(await page.locator('.invoice-payment-qr').count(), 0);
        await page.evaluate(async id => {
            await window.rechly.updateInvoice(id, { status: 'sent' });
            await window.rechly.saveCompany({ ...(await window.rechly.getCompany()), show_payment_qr: false });
            currentStore = await window.rechly.getStore();
            await previewDocument('invoice', id);
        }, id);
        assert.equal(await page.locator('.invoice-payment-qr').count(), 0);
        await page.evaluate(() => { closePrintModal(); showView('settings'); });
        assert.equal(await page.locator('#set-payment-qr').isChecked(), false);
        assert.deepEqual(errors, []);
        console.log('PASS: native IPC, 3 invoice templates, discount/VAT preview, QR opt-in, paid suppression, PDF export. Artifacts:', profile);
    } finally { await app.close(); }
})().catch(error => { console.error(error); process.exit(1); });
