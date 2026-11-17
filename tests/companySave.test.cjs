const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { getDefaultStore } = require("../out/storeDefaults.js");
const { validateStore } = require("../out/storageValidation.js");

describe("company:save with Karlsruhe (BW) tax number", () => {
    it("accepts the BW format 35NNN/NNNNN, with and without slash", () => {
        for (const tax_number of ["35123/45678", "3512345678", "21/123/45678"]) {
            const store = getDefaultStore();
            store.company.tax_number = tax_number;
            store.company.vat_id = "";
            const validated = validateStore(store);
            assert.equal(validated.company.tax_number, tax_number);
        }
    });

    it("accepts a company payload whose optional logo is undefined and strips the key", () => {
        // Regression: onboarding for a fresh (sample) company sent
        // logo_base64: undefined, and validateStore rejected the whole
        // company:save with "nicht unterstützter Datentyp."
        const store = getDefaultStore();
        store.company = {
            ...store.company,
            name: "Christiane Schmidt",
            city: "Karlsruhe",
            postal_code: "76131",
            tax_number: "35123/45678",
            vat_id: "",
            logo_base64: undefined,
        };
        const validated = validateStore(store);
        assert.equal(validated.company.tax_number, "35123/45678");
        assert.equal("logo_base64" in validated.company, false);
    });

    it("still rejects genuinely unsupported types and non-text tax numbers", () => {
        const withFunction = getDefaultStore();
        withFunction.company.tax_number = () => {};
        assert.throws(() => validateStore(withFunction), /nicht unterstützter Datentyp/);

        const withNumber = getDefaultStore();
        withNumber.company.tax_number = 3512345678;
        assert.throws(() => validateStore(withNumber), /tax_number muss Text sein/);
    });

    it("onboarding no longer emits logo_base64 as undefined", () => {
        const uiHtml = fs.readFileSync(path.join(__dirname, "../ui/index.html"), "utf8");
        assert.equal(uiHtml.includes("logo_base64: comp.logo_base64 || undefined"), false);
        assert.ok(uiHtml.includes("...(comp.logo_base64 ? { logo_base64: comp.logo_base64 } : {})"));
    });
});
