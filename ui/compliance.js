/** Invoice readiness checklist — mirrors @rechly/core buildComplianceReport (AGPL-3.0). */
(function (global) {
  function present(value) {
    return Boolean(value && String(value).trim());
  }

  function buildComplianceReport(input) {
    const checks = [];
    checks.push({ id: "number", label: "Rechnungsnummer", severity: present(input.invoiceNumber) ? "pass" : "fail" });
    checks.push({ id: "date", label: "Rechnungsdatum", severity: present(input.issueDate) ? "pass" : "fail" });
    checks.push({ id: "seller", label: "Verkäufer (Name)", severity: present(input.sellerName) ? "pass" : "fail" });
    checks.push({ id: "seller-address", label: "Verkäuferadresse", severity: present(input.sellerAddress) ? "pass" : "warn" });
    checks.push({ id: "buyer", label: "Kunde (Name)", severity: present(input.buyerName) ? "pass" : "fail" });
    checks.push({ id: "buyer-address", label: "Kundenadresse", severity: present(input.buyerAddress) ? "pass" : "warn" });
    const taxOk = present(input.sellerVatId) || present(input.sellerTaxId);
    checks.push({
      id: "tax",
      label: taxOk
        ? "Steuerkennzeichen (USt-IdNr. oder Steuernummer)"
        : "Verkäuferkennung BT-29, BT-30 oder BT-31 (BR-CO-26)",
      severity: taxOk ? "pass" : "warn",
    });
    checks.push({ id: "lines", label: "Positionen", severity: (input.lineCount || 0) > 0 ? "pass" : "fail" });
    const gross = input.totalGross;
    checks.push({
      id: "total",
      label: "Bruttobetrag",
      severity: Number.isFinite(gross) && gross > 0 ? "pass" : "warn",
    });
    checks.push({
      id: "currency",
      label: "Währung EUR",
      severity: !input.currency || input.currency === "EUR" ? "pass" : "warn",
    });
    checks.push({ id: "iban", label: "IBAN (Zahlungs-QR / Überweisung)", severity: present(input.iban) ? "pass" : "warn" });
    checks.push({ id: "service-period", label: "Leistungszeitraum", severity: input.hasServicePeriod ? "pass" : "warn" });
    checks.push({
      id: "buyer-id",
      label: "Käufer-Kennung (Leitweg-ID / USt-IdNr.)",
      severity: input.hasBuyerLeitwegOrVat ? "pass" : "warn",
    });
    const fails = checks.filter((c) => c.severity === "fail").length;
    const warns = checks.filter((c) => c.severity === "warn").length;
    const passes = checks.filter((c) => c.severity === "pass").length;
    const score = Math.round((passes / checks.length) * 100);
    let summary;
    if (fails > 0) summary = fails + " Pflichtpunkt(e) offen — Export prüfen.";
    else if (warns > 0) summary = "Bereit mit " + warns + " Hinweis(en).";
    else summary = "Checkliste erfüllt (kein Ersatz für KoSIT/veraPDF).";
    return { score, checks, summary };
  }

  function renderCompliancePanel(input) {
    const report = buildComplianceReport(input);
    return (
      '<div class="compliance-panel">' +
      '<div class="compliance-head"><strong>Compliance-Checkliste</strong><span class="compliance-score">' +
      report.score +
      "%</span></div>" +
      '<p class="compliance-summary">' +
      report.summary +
      "</p><ul>" +
      report.checks
        .map(function (c) {
          return (
            '<li class="compliance-' +
            c.severity +
            '"><span>' +
            c.label +
            '</span><span class="severity">' +
            (c.severity === "pass" ? "OK" : c.severity === "warn" ? "Hinweis" : "Fehlt") +
            "</span></li>"
          );
        })
        .join("") +
      "</ul>" +
      (!present(input.sellerVatId) && !present(input.sellerTaxId)
        ? '<p class="compliance-note">EN 16931 BR-CO-26: Ohne USt-IdNr. (BT-31) oder Steuernummer fehlen die Verkäuferkennungen BT-29, BT-30 und BT-31. Der XRechnung- und ZUGFeRD-Export wird dann nicht gespeichert. Eine Steuernummer ohne USt-IdNr. wird als Seller identifier (BT-29) und als Steuernummer (BT-32) geschrieben.</p>'
        : "") +
      '<p class="compliance-note">Keine KoSIT-/veraPDF-Zertifizierung — nur eine Produkt-Checkliste.</p></div>'
    );
  }

  global.RechlyCompliance = { buildComplianceReport, renderCompliancePanel };
})(typeof window !== "undefined" ? window : globalThis);
