# Rechly Desktop 1.6.7 — E-Rechnungs-Validierung & PDF/A-Korrektur

Dieses Patch-Release behebt Exportfehler in XRechnung und ZUGFeRD, die bei der Prüfung mit KoSIT und Valitool auffielen:

- **CII-Elementreihenfolge:** `BillingSpecifiedPeriod` wird jetzt an der korrekten Stelle im XML geschrieben (vorher zu früh).
- **Verkäufer-Kennzeichen:** Eine Steuernummer mit `schemeID="FC"` erfüllt jetzt die Regel BR-CO-26; der `qdt`-Namespace wird korrekt deklariert.
- **PDF/A-3b:** Der PDF-Trailer enthält jetzt eine `/ID` — erforderlich für die Hybrid-Rechnung.
- **Automatisierte Prüfung:** Die CII-Exporte werden gegen die offiziellen D16B-XSD-Schemata getestet, inklusive valence-, Käufer- und Steuerkennzeichen-Fälle.

Die App bleibt vollständig offline; alle Exporte erfolgen lokal ohne Cloud-Dienst.
