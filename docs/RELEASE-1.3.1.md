# Rechly Desktop 1.3.1 — XRechnung 3.0 / Peppol EN16931 BT-34 Fix

This maintenance release fixes XRechnung 3.0 / Peppol compliance when validating electronic invoices:

- **XRechnung / Peppol EN16931 BT-34 & PEPPOL-EN16931-R020 Compliance:**
  - Added the mandatory seller electronic address (**BT-34**) via `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">` directly under `<ram:SellerTradeParty>` adhering to the UN/CEFACT CII schema sequence.
  - Resolves Schematron validation error `[PEPPOL-EN16931-R020] - Seller electronic address MUST be provided`.
  - Retains contact email in `<ram:DefinedTradeContact>` (**BT-43**) and provides fallback to `schemeID="9930"` (USt-IdNr.) when email is absent.
  - Enhanced buyer electronic address (**BT-49**) fallback to Leitweg-ID (`schemeID="0204"`) for German B2G authorities.

- **Settings UI Enhancement:**
  - Added editable fields for **E-Mail-Adresse (BT-34)**, **Telefon**, and **Land (ISO-Code)** to the Desktop Settings modal (*Unternehmensdaten & Bankverbindung*).
  - Ensured company email edits are persisted to local SQLite storage.
