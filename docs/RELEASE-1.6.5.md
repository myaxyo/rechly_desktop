# Rechly Desktop 1.6.5 — PDF-Fußzeile: Steuerangaben nur bei vorhandenen Werten

Dieses Patch-Release behebt eine fehlerhafte Anzeige im PDF-Fuß der DIN-5008-Vorlage:

- **🔧 Fix: Keine leeren „Steuernr.: -“ / „USt-IdNr.: -“-Zeilen mehr:**
  - Der DIN-5008-Fuß („Steuer- & Unternehmensangaben“) zeigte bisher beide Steuerkennzeichen immer an – mit „-“ als Platzhalter, wenn ein Wert fehlte. Firmen mit nur einer USt-IdNr. sahen dadurch eine leere „Steuernr.: -“-Zeile auf jeder Rechnung (von einem Kunden gemeldet).
  - USt-IdNr. und Steuernummer werden jetzt – wie in den Vorlagen Modern und Minimal – nur noch ausgegeben, wenn sie in den Firmendaten hinterlegt sind.
