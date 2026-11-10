const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { getDefaultStore } = require("../out/storeDefaults.js");
const { validateStore } = require("../out/storageValidation.js");
const { createRechlyBackupBundle, executeMigrationImport } = require("../out/migration.js");

const SAMPLE_LOGO_DATA_URL =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("Company Logo Integration & Parity", () => {
    it("validates store with company logo_base64 data URL", () => {
        const store = getDefaultStore();
        store.company.logo_base64 = SAMPLE_LOGO_DATA_URL;

        const validated = validateStore(store);
        assert.equal(validated.company.logo_base64, SAMPLE_LOGO_DATA_URL);
    });

    it("rejects invalid non-string company logo_base64 values", () => {
        const store = getDefaultStore();
        store.company.logo_base64 = 12345;
        assert.throws(() => validateStore(store), /logo_base64 muss Text sein/);

        store.company.logo_base64 = true;
        assert.throws(() => validateStore(store), /logo_base64 muss Text sein/);

        store.company.logo_base64 = { url: "test.png" };
        assert.throws(() => validateStore(store), /logo_base64 muss Text sein/);
    });

    it("includes logo_base64 in RechlyBackupBundle and restores it on migration import", () => {
        const store = getDefaultStore();
        store.company.logo_base64 = SAMPLE_LOGO_DATA_URL;

        const bundle = createRechlyBackupBundle(store);
        assert.ok(bundle.company);
        assert.equal(bundle.company.logo_base64, SAMPLE_LOGO_DATA_URL);

        // Import into a target store
        const targetStore = getDefaultStore();
        delete targetStore.company.logo_base64;

        const { result, updatedStore } = executeMigrationImport(targetStore, {
            company: bundle.company,
        });

        assert.equal(result.companyUpdated, true);
        assert.equal(updatedStore.company.logo_base64, SAMPLE_LOGO_DATA_URL);

        // Verify strict validateStore passes
        const validated = validateStore(updatedStore);
        assert.equal(validated.company.logo_base64, SAMPLE_LOGO_DATA_URL);
    });

    it("preserves existing logo_base64 when incoming migration payload does not specify one", () => {
        const store = getDefaultStore();
        store.company.logo_base64 = SAMPLE_LOGO_DATA_URL;

        const { result, updatedStore } = executeMigrationImport(store, {
            company: {
                name: "Updated Name Only",
            },
        });

        assert.equal(result.companyUpdated, true);
        assert.equal(updatedStore.company.name, "Updated Name Only");
        assert.equal(updatedStore.company.logo_base64, SAMPLE_LOGO_DATA_URL);
    });

    it("verifies template and UI integration in ui/index.html", () => {
        const uiHtml = fs.readFileSync(path.join(__dirname, "../ui/index.html"), "utf8");

        // Classic template embeds logo when present
        assert.ok(
            uiHtml.includes('comp.logo_base64 ? `<div style="margin-bottom: 12px; display: flex; align-items: center;"><img src="${comp.logo_base64}" alt="Firmenlogo" style="max-height: 52px; max-width: 100%; object-fit: contain; display: block;"></div>` : \'\''),
            "Classic DIN 5008 template must embed logo when comp.logo_base64 is present",
        );

        // Modern template embeds logo when present
        assert.ok(
            uiHtml.includes('comp.logo_base64 ? `<img src="${comp.logo_base64}" alt="Firmenlogo" style="max-height: 55px; max-width: 150px; object-fit: contain; display: block;">` : \'\''),
            "Modern template must embed logo when comp.logo_base64 is present",
        );

        // Minimal template embeds logo when present
        assert.ok(
            uiHtml.includes('comp.logo_base64 ? `<div style="margin-bottom: 12px;"><img src="${comp.logo_base64}" alt="Firmenlogo" style="max-height: 48px; max-width: 160px; object-fit: contain; display: block;"></div>` : \'\''),
            "Minimal template must embed logo when comp.logo_base64 is present",
        );

        // Settings view has logo management card
        assert.ok(uiHtml.includes('id="settings-logo-input"'), "Settings must have logo file input");
        assert.ok(uiHtml.includes('id="settings-logo-preview-box"'), "Settings must have logo preview box");
        assert.ok(uiHtml.includes('handleLogoFileSelect'), "Settings must handle logo file selection");
        assert.ok(uiHtml.includes('handleRemoveLogo'), "Settings must handle logo removal");

        // Sidebar header has logo container
        assert.ok(uiHtml.includes('id="sidebar-company-logo"'), "Sidebar must have logo image element");

        // Onboarding has logo upload
        assert.ok(uiHtml.includes('id="onb-logo-input"'), "Onboarding must have logo file input");
        assert.ok(uiHtml.includes('onbHandleLogoSelect'), "Onboarding must handle logo file selection");
    });
});
