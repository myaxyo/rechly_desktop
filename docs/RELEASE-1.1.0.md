Rechly Desktop 1.1.0 adds a personal, offline business workspace and calendar for German businesses.

### New and improved

- Personal calendar with month, week, day and agenda views, categories, search, all-day events, recurring series, individual-occurrence deletion and reminders while the app is running.
- Optional task deadlines and open invoice due dates in the calendar.
- ICS import/export with confirmation and UID deduplication. Unsupported timezone/recurrence formats are rejected explicitly rather than silently changed.
- Business cockpit, customer-linked projects, task boards and document templates with PDF/text export.
- Refined navigation and German interface, keyboard access and protected unsaved edits.
- Invoice search, status filters, sorting, overdue indicators, duplicate-number validation and consistent cent rounding.
- Atomic vault writes and protection against deleting linked customers or projects.

### Installation and scope

Choose the Windows x64 installer or the macOS image matching your CPU (Intel x64 or Apple Silicon arm64). Back up your existing local vault before upgrading.

This is a single-user application. Calendar dates use the device timezone. Reminders require the app to be running and OS notification permission; invitations, sharing and cloud calendar synchronization are not included. ICS currently supports local times, individual UTC events, and simple daily/weekly/monthly/yearly recurrence; TZID, COUNT/BYDAY and edited recurrence instances are not supported. Documents use plain text; DOCX/XLSX editing and real-time collaboration are not included.

Installers are unsigned / not Apple-notarized; Windows SmartScreen and macOS Gatekeeper may warn as with the previous release. No legal or accounting-compliance certification is claimed. Optional AI providers require separate configuration.

### Verification

Type checking, compilation, 19 automated regression tests, and Electron workflow checks cover the calendar, business workspace, invoice workflows, CRUD operations, PDF/XML/DATEV exports, backup restore, and persistence. Notification scheduling is tested with native display stubbed; actual notification delivery depends on your OS settings.
