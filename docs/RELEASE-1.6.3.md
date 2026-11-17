# Rechly Desktop 1.6.3 — Firmendaten speichern (Steuernummer)

Dieses Patch-Release behebt einen Fehler, der das Speichern der Firmendaten bei einer Neuinstallation verhindern konnte:

- **🔧 Kritischer Fix: Firmendaten lassen sich wieder speichern:**
  - Der Einrichtungsassistent übermittelte ein nicht vorhandenes Firmenlogo als `undefined`-Wert. Die strikte Datenprüfung lehnte daraufhin das gesamte Speichern über `company:save` mit „Ungültige Rechly-Daten: nicht unterstützter Datentyp.“ ab – unabhängig von der eingegebenen Steuernummer.
  - Optionale Felder ohne Wert werden jetzt als „nicht vorhanden“ behandelt und verworfen, statt den gesamten Speichervorgang abzubrechen. Echte Fehleingaben (z. B. eine Steuernummer als Zahl statt Text) werden weiterhin abgelehnt.
- **🏢 Steuernummern aller Bundesländer:**
  - Die Steuernummer wird als Freitext gespeichert; regionale Formate wie das baden-württembergische `35NNN/NNNNN` (z. B. `35123/45678`, Karlsruhe) sind ohne Umformatierung gültig, mit oder ohne Schrägstrich.
  - Die Eingabebeispiele in Assistent und Einstellungen zeigen jetzt auch das BW-Format.
