# Contributing to Rechly Desktop

Thanks for helping improve Rechly Desktop.

## Reporting bugs and requesting features

Open an [issue](https://github.com/myaxyo/rechly_desktop/issues) and include:

- your operating system and Rechly Desktop version
- steps to reproduce the problem
- what you expected and what happened instead

Do not attach real invoices, customer data or API keys. Replace them with sample data.

## Security issues

Do not report security vulnerabilities in a public issue. Use GitHub's
[private vulnerability reporting](https://github.com/myaxyo/rechly_desktop/security/advisories/new) instead.

## Development setup

```bash
git clone https://github.com/myaxyo/rechly_desktop.git
cd rechly_desktop
npm install
npm start
```

- The main process is TypeScript in `src/`, compiled to `out/`.
- The UI is in `ui/index.html`.
- Run `npm run typecheck` before opening a pull request.
- Run `npm run build && node --test tests/*.test.cjs` for invoice validation, currency rounding, and vault persistence regression tests. These tests use temporary vaults and do not modify application data.

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Keep each pull request focused on one change.
3. Describe what you changed and how you tested it.

## License

By contributing, you agree that your contributions are licensed under the
[GNU Affero General Public License v3.0](LICENSE), the same license as the project.

## Workspace integration check

After `npm run build`, run `node tests/business.electron.cjs` with Playwright Core available and a working desktop display. If Playwright Core is installed outside this checkout, set `RECHLY_PLAYWRIGHT_PATH` to its package directory. On the cloud development image:

```bash
DISPLAY=:99 XDG_CACHE_HOME=/workspace/.cache \
RECHLY_PLAYWRIGHT_PATH=/opt/codex/cua_node/lib/node_modules/playwright-core \
node tests/business.electron.cjs
```

Start the configured virtual display first. This test uses a separate temporary profile and tests project/customer links, task status, document templates, search, PDF/text export, delete protection, unsaved edits and persistence after restart. Artifacts are retained in the temporary directory printed by the test. Its `--no-sandbox` launch option is intended for this isolated cloud test container.

Calendar and core regression checks use the same Playwright configuration:

```bash
node tests/calendar.electron.cjs
node tests/core.electron.cjs
TZ=Europe/Berlin node --test tests/*.test.cjs
```

The calendar test exercises all views, validation, recurrence exceptions, category filtering, ICS files, reminder scheduling (native notification display stubbed), and restart persistence. The core test checks navigation, invoice entry, customer/product/expense mutations, offer conversion, exports and backup restore. OS notification delivery, legal export conformance, cloud AI and optional Ollama models require separate checks.

Use `--user-data-dir=/absolute/path` to run a separate local profile. Automated desktop tests always use a temporary profile. Set `RECHLY_EXECUTABLE` for business/calendar checks against a packaged app.
