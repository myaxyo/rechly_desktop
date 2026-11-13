# Rechly Desktop 1.6.2 — Datumsformat, Leistungen duplizieren & sauberer PDF-Export

Dieses Update behebt drei direkt aus Nutzer-Feedback gemeldete Punkte rund um Rechnungs-PDFs und die Pflege von Leistungen:

- **📅 Einheitliches Datumsformat auf allen Rechnungsvorlagen:**
  - Rechnungsdatum, Fälligkeitsdatum und Leistungszeitraum verwenden auf allen Druck- und PDF-Vorlagen (DIN 5008, Modern, Minimal) sowie in der Angebotsübersicht jetzt durchgängig das deutsche Format `TT.MM.JJJJ` (statt `JJJJ-MM-TT`).
- **📋 Leistungen & Positionen duplizieren und mehrfach auswählen:**
  - **Leistungen & Artikel:** Einzelne Leistungen lassen sich per Klick duplizieren; über Auswahl-Checkboxen können mehrere Leistungen markiert und gemeinsam dupliziert oder gelöscht werden.
  - **Rechnungs- & Angebotspositionen:** Positionen im Editor lassen sich einzeln duplizieren sowie über Checkboxen mehrfach auswählen und gemeinsam duplizieren oder entfernen.
- **📄 Reiner weißer PDF-Rand bei „Als PDF speichern“ (macOS):**
  - Behebt den leicht abgesetzten Hintergrundrand rund um die A4-Seite beim direkten PDF-Export über „Als PDF speichern“ (durch weißen Fensterhintergrund während `printToPDF` und `preferCSSPageSize: true`) sowie 1-px-Abschneidungen am rechten Tabellenrand.
