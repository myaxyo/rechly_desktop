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

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Keep each pull request focused on one change.
3. Describe what you changed and how you tested it.

## License

By contributing, you agree that your contributions are licensed under the
[GNU Affero General Public License v3.0](LICENSE), the same license as the project.
