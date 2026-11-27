# Rechly Desktop 1.6.6 — Compliance-Checkliste im Rechnungseditor

Dieses Patch-Release veröffentlicht die Änderungen seit 1.6.5 als Installer:

- **Checkliste beim Schreiben einer Rechnung:**
  - Der Rechnungseditor zeigt eine lokale Checkliste: Rechnungsnummer, Datum, Verkäufer, Kunde, Steuerkennzeichen, Positionen, Bruttobetrag, Währung, IBAN, Leistungszeitraum und Käufer-Kennung (Leitweg-ID oder USt-IdNr.).
  - Fehlende Pflichtangaben werden als „Fehlt“ markiert, optionale Lücken als „Hinweis“. Angebote zeigen die Liste nicht.
  - Das ist eine Produktprüfung in der App. Es ist keine KoSIT- oder veraPDF-Zertifizierung und ersetzt keine Prüfung der fertigen Datei.
- **Erscheinungsbild:** Die Oberfläche nutzt gemeinsame Markenfarben (Design-Tokens). Rechnung, Logo, ZUGFeRD, Duplizieren und Leistungszeitraum bleiben erhalten; der Code dafür liegt in den geladenen Skripten statt in einer einzigen HTML-Datei.
