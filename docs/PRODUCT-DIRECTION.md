# Product direction: a personal business workspace

This assessment is based on the repository and exercised desktop workflows, not a competitor survey or a claim of market leadership. The strongest near-term audience is a German freelancer or small service-business owner who manages their own customers, work and billing on one computer.

The product should make a complete workday easier: find the next appointment, complete project work, record time and costs, invoice it, and follow up on money owed. Each feature should reuse the same customers, projects and documents. Single-person operation, offline access and portable backups remain core constraints.

## Implemented in 1.2.0

**Project → work → invoice → project report** now forms a connected workflow:

1. Create a customer-linked project with a planned budget.
2. Run one persistent timer or enter time manually; record a billing rate and an internal cost rate.
3. Capture project expenses, or assign existing expenses to the project.
4. Select unbilled work and generate a customer invoice draft with exact rounded amounts.
5. See labor estimates, expenses, remaining unbilled work, invoice totals and amounts marked paid together.

The start page surfaces this workflow. New time and report screens share the workspace's typography, spacing, table patterns and modal editors. The app version is visible. CSV exports, dirty-edit protection, duplicate-billing guards and atomic invoice/time saves support everyday use.

Time-derived drafts default to 19% VAT, or 0% for the existing small-business setting. Review the draft for the actual tax treatment. A timer is elapsed wall-clock time, including time while the app is closed or the machine sleeps; review its duration when stopping it. Contributions use estimated billable value less recorded costs, not recognized profit. Invoice payments currently use manually set statuses, not a bank ledger.

## Next priorities

| Priority | Capability | Why it matters | Completion criteria |
| --- | --- | --- | --- |
| 1 | Payment ledger and receivables | Partial payments, refunds and remaining balances need more than a paid/unpaid flag. | Dated payment records; cent-exact balances; overpayment handling; reversible corrections; report reconciliation. |
| 1 | Invoice finalization and corrections | German business records need a controlled lifecycle. | Separate draft/final document states; immutable finalized content; traceable correction documents; reproducible exports. Obtain qualified accounting review before making compliance claims. |
| 1 | Validated electronic invoices | Existing XML generation is not evidence of schema/business-rule compliance. | Automated official schema and business-rule validation; actionable field errors; tests for tax exemptions, buyer identifiers and rounding. Distinguish standalone XML from a PDF/A-3 hybrid invoice. |
| 1 | Receipt attachments and backup recovery | Expense metadata alone does not retain the source receipt. | Managed local copies, preview, attachment-inclusive backup, verified restore and missing-file detection. |
| 2 | Recurring invoices and reminders | Retainers and repeat customers should require less manual work. | Recurrence templates; next-due queue on launch; duplicate prevention; reviewable drafts. No hidden scheduled emails. |
| 2 | Offer-to-project pipeline | An accepted quote should carry its scope, customer and budget forward. | Linked offer/project/invoice history; one-time conversion; explicit handling of partial delivery. Existing offer-to-invoice conversion is already available. |
| 2 | Cash-flow planning and bank CSV import | Owners need to see upcoming obligations alongside expected receipts. | Local import preview, column mapping, duplicate detection, matching and corrections; cash versus revenue clearly distinguished. |
| 2 | Unified customer workspace and search | Information is currently spread across separate screens. | One view of customer offers, projects, appointments and invoices; keyboard navigation and search scopes. |
| 3 | Rich business documents | Letters and minutes currently use plain text. | Structured headings, tables, page breaks, reusable branding and reliable PDF export before claiming DOCX compatibility. |
| 3 | Stronger calendar editing | Common recurrence formats and exceptions should import without losing meaning. | Time-zone handling, recurring-event exceptions and safe move/resize behavior with DST tests. Current unsupported ICS patterns are rejected explicitly. |
| 3 | Inventory and purchases | Retail and trade businesses need workflows beyond billable time. | Stock movement ledger, units, purchase receipts, low-stock views and reconciliation; do not infer inventory from invoice descriptions. |

A spreadsheet engine, presentation suite, payroll and multi-user collaboration are separate product commitments. They need dedicated file-format, calculation and operational testing. The current app should not claim to replace every Microsoft Office or accounting workflow.

## UI and reliability standards for subsequent work

- Make each overview actionable: show an outstanding task and the next useful action, with links to the underlying records.
- Use consistent German terms, EUR/date formatting, readable contrast and layouts that remain usable at the 980-pixel minimum window width.
- Preserve input on validation/save failures; distinguish empty data from filtered-out results; guard destructive linked-record actions.
- Provide accessible names, visible focus, keyboard operation and predictable modal dismissal. Complete a broader screen-reader audit before making an accessibility claim.
- Keep dashboard estimates, accounting records and manually maintained payment statuses visibly distinct.
- Test complete user journeys and failure recovery with isolated profiles. Verify installed builds on Windows and both Mac architectures, including downloaded-file trust checks before publication.
- Keep release notes and the displayed version aligned so users can identify which features their installed build contains.
