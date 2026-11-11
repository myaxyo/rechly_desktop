# Rechly Desktop 1.6.1 — Kritischer Speicher-Fix

Dieses Patch-Release behebt einen kritischen Fehler aus 1.6.0 und verbessert alle Speichern-Fehlermeldungen:

- **🔧 Kritischer Fix: Speichern funktioniert wieder:**
  - 1.6.0 enthielt einen JavaScript-Syntaxfehler im Rechnungseditor, der das gesamte UI-Script blockierte — Speichern schlug scheinbar trotz ausgefüllter Pflichtfelder fehl.
  - 1.6.1 stellt die korrekte Rechnungs-, Angebots- und Firmendaten-Speicherung wieder her (einschließlich optionaler Leistungszeiträume).
- **💬 Konkrete statt generische Fehlermeldungen:**
  - Fehlender Kunde, doppelte Dokumentnummer, Kunden-/Produkt- und Einstellungsfehler zeigen jetzt die tatsächliche Ursache an.
  - Unbehandelte Fehler zeigen die Detailmeldung statt nur „Der Vorgang konnte nicht abgeschlossen werden.“
  - Einrichtungsassistent, Statuswechsel und alle Speichern-Dialoge melden Fehler direkt im jeweiligen Formular.
- **🖼️ Logo-Verbesserung (Offline):**
  - SVG-Firmenlogos werden als Vektor übernommen (scharf im Druck), PNG/JPG/WebP wie bisher automatisch verkleinert (max. 5 MB).
  - Logo erscheint in Einstellungen, Einrichtungsassistent, Seitenleiste und allen Druckvorlagen (DIN 5008, Modern, Minimal).
