const {_electron} = require(process.env.RECHLY_PLAYWRIGHT_PATH || 'playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rechly-decimal-'));
(async () => {
    const app = await _electron.launch({executablePath: process.env.RECHLY_EXECUTABLE || require('electron'), args: [...(process.env.RECHLY_EXECUTABLE ? [] : [root]), '--no-sandbox', '--disable-gpu', '--user-data-dir=' + profile, ...(process.env.RECHLY_HEADLESS === '1' ? ['--ozone-platform=headless'] : [])]});
    try {
        const page = await app.firstWindow();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.waitForFunction(() => window.rechly);
        await page.evaluate(() => window.rechly.completeOnboarding({cloud_ai_opt_in:false, remove_sample_data:false}));
        await page.reload(); await page.waitForSelector('.business-hero');
        await page.evaluate(() => { showView('products'); showNewProductModal(); });
        await page.locator('#modal-product-name').fill('Decimal regression');
        await page.locator('#modal-product-price').fill('');
        await page.locator('#modal-product-price').pressSequentially('1,25');
        await page.evaluate(() => submitModalProduct());
        const product = await page.evaluate(async () => (await window.rechly.getProducts()).find(p => p.name === 'Decimal regression'));
        assert.equal(product.price, 1.25);
        await page.evaluate(id => editProduct(id), product.id);
        await page.locator('#modal-product-price').fill('0.05');
        await page.evaluate(() => submitModalProduct());
        assert.equal(await page.evaluate(async id => (await window.rechly.getProducts()).find(p => p.id === id).price,product.id), 0.05);
        await page.evaluate(id => editProduct(id), product.id);
        await page.locator('#modal-product-price').fill('1,25xyz');
        await page.evaluate(() => submitModalProduct());
        assert.match(await page.locator('#toast').innerText(), /gültigen/);
        assert.equal(await page.evaluate(async id => (await window.rechly.getProducts()).find(p => p.id === id).price,product.id), 0.05);
        await page.evaluate(() => closeModal('modal-product'));
        for (const kind of ['invoice','offer']) {
            await page.evaluate(kind => kind === 'invoice' ? createNewInvoice() : createNewOffer(),kind);
            await page.locator('#inv-client').selectOption('client-sample-1');
            await page.locator('#inv-num').fill('DECIMAL-' + kind);
            await page.locator('.item-desc').fill('Decimal line');
            await page.locator('.item-qty').fill('2,5');
            await page.locator('.item-price').fill('');
            await page.locator('.item-price').pressSequentially('1,25');
            await page.locator('.item-vat').fill('0');
            await page.locator('#save-document').click();
            await page.locator('#save-document').waitFor({state:'detached'});
            const doc = await page.evaluate(async kind => (kind === 'invoice' ? await window.rechly.getInvoices() : await window.rechly.getOffers()).find(d => (d.invoice_number || d.offer_number) === 'DECIMAL-' + kind),kind);
            assert.equal(doc.items[0].price, 1.25); assert.equal(doc.items[0].quantity,2.5);
            assert.equal(doc.total_gross,3.13);
            await page.evaluate(({kind,id}) => kind === 'invoice' ? editInvoice(id) : editOffer(id),{kind,id:doc.id});
            assert.equal(await page.locator('.item-price').inputValue(),'1.25');
        }
        await page.reload(); await page.waitForSelector('.business-hero');
        assert.equal(await page.evaluate(async () => (await window.rechly.getInvoices()).find(d => d.invoice_number === 'DECIMAL-invoice').items[0].price),1.25);
        assert.deepEqual(errors,[]);
        console.log('PASS: native desktop product/invoice/offer comma entry, dot cents, validation, totals and persistence.',profile);
    } finally { await app.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
