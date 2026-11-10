# Rechly Desktop 1.6.0 — Vorlagen, Leistungszeitraum & GoBD-Nummernkreise

Dieses Release bringt drei zentrale Neuerungen für effizientere Rechnungsstellung und lückenlose GoBD- und E-Rechnungs-Konformität:

- **📋 Rechnungen duplizieren & Vorlagen-System:**
  - **Rechnung duplizieren:** Bestehende Rechnungen können jetzt mit einem einzigen Klick im Rechnungs-Detailbereich dupliziert werden. Alle Positionen, Kundendaten, Zahlungsbedingungen und Notizen werden übernommen und automatisch mit einer neuen Rechnungsnummer versehen.
  - **Als Vorlage speichern:** Jede Rechnung lässt sich direkt als wiederverwendbare Vorlage sichern.
  - **Vorlagen-Verwaltung:** Neue Rechnungen können blitzschnell aus gespeicherten Vorlagen erstellt werden. Vorlagen können jederzeit eingesehen, angewendet oder gelöscht werden.

- **📅 Echter Leistungszeitraum (Leistungszeitraum von – bis & pro Position):**
  - **Rechnungsebene:** Flexibler Leistungszeitraum (von – bis oder einzelner Tag/Lieferdatum) direkt im Rechnungskopf erfassbar.
  - **Positionsebene:** Optionale abweichende Leistungsdaten direkt pro Position definierbar.
  - **E-Rechnungs-Konformität (ZUGFeRD & XRechnung):** Leistungszeiträume werden nach EN16931-Standard als `BillingSpecifiedPeriod` und `ActualDeliverySupplyChainEvent` semantisch im XML abgebildet.
  - **Druck- & PDF-Vorlagen:** Sauber formatiert im Dokumentenkopf und in den Tabellen aller Design-Vorlagen (DIN 5008 Klassisch, Modern, Minimal).

- **🔢 GoBD-konforme, fortlaufende Rechnungsnummern:**
  - **Lückenlose Nummernvergabe:** Ersetzt zufällige Suffixe durch einen deterministischen, atomaren Nummernkreis-Zähler gemäß GoBD-Vorgaben.
  - **Individuelle Nummern-Muster:** In den Einstellungen frei konfigurierbar mit Platzhaltern wie `{YYYY}`, `{YY}`, `{MM}`, `{DD}`, `{###}`, `{####}`, `{NR}` oder `{COUNTER}` (z. B. `RE-{YYYY}-{####}`).
  - **Echtzeit-Vorschau:** Sofortige Live-Vorschau des nächsten Rechnungsnummernformats direkt in den Einstellungen.
  - **Automatische Initialisierung:** Erkennt bestehende Rechnungen intelligent und zählt nahtlos von der höchsten existierenden Nummer weiter.
