# Rechly dual-product rule

Rechly is **one brand, two runtimes**. Do not grow both as full copies of each other.

## The rule

| | **Web** (`rechly_web`) | **Desktop** (`rechly_desktop`) |
|--|--|--|
| **Job** | Anywhere access, accounts, automation, public surfaces | Offline vault, privacy, native OS, local AI |
| **Owns** | Auth/Appwrite, recurring invoices, dunning, bank matching, Termine booking, SEO tools hub, share links | SQLite vault, encrypted `.rechly-backup`, OS notifications/print/updater, Ollama model install, ZUGFeRD PDF/A-3 hybrid |
| **UI stack** | Next.js + React + shadcn/ui | Vanilla HTML/CSS/JS (no React/shadcn rewrite) |
| **Shared** | Brand tokens, pure domain math (mirrored helpers), German compliance semantics | Same |

## Porting rule

- Port **domain logic** (GiroCode, tax/XML helpers, decimal parsing) as shared pure modules (web `src/lib/core`; desktop copies in `src/` / `ui/`).
- Port **features** one way when the product rule says the other edition owns them — do not forever race “who’s ahead.”
- Prefer **encrypted vault bridge** (backup import/export) over live multi-master sync.

## Not a third product

The web repo’s `desktop/` folder is an **Electron + SQLite development wrapper** for Next.js. It is **not** this application. Shipped offline installs are **only** this repository’s releases.

## UI stacks

- **Do not** adopt shadcn/React here unless product intentionally merges to one frontend.
- **Do** keep visual parity through shared CSS design tokens (`ui/tokens.css`).
- Keep the renderer modular (`app.css` / `app.js` + feature modules) — avoid growing `index.html` as a monolith again.
