# Subscriptions And Reminders

## Objective
Add an administrator-only Content Management page for subscription services, expiry
tracking, private invoice/contract attachments, currency conversion, and email reminders.
No vendor billing or automatic payment is performed.

## Acceptance
- CRUD: name, HTTP(S) vendor URL, category (domain/server/membership/software/other),
  details, start/expiry dates, initial/renewal decimal prices with independently selected
  CNY/HKD/USD/EUR/GBP/JPY currencies,
  renewal mode (automatic/manual/perpetual), notes, and attachments.
- Status is derived using the site calendar: expired after expiry date, expiring
  within the configured lead days (default 7), otherwise normal. Perpetual has no expiry.
- Optional reminders: from N calendar days before expiry through the expiry date,
  send every day at each configured 24-hour HH:mm time in the current site timezone.
  The Tokenizer supports 1 to 12 times, normalized, deduplicated and sorted.
  After expiry, send one final expiration notice at the earliest configured time,
  once per expiry cycle; later dates or times do not send further expiration notices.
  All reminders go to the administrator who created the subscription.
  Late creation/restarts catch up only on the current day, not historical reminder dates.
  Disabling reminders cancels unsent jobs. Legacy single-time records and queued/sent
  jobs migrate without resetting selections or repeating an already delivered time slot.
  Edits/disabled reminders/deletion invalidate pending delivery. Existing durable mail
  queue handles locks, retries, frozen payloads, and provider idempotency.
- Attachments: max 10 per subscription, 5 MiB each; PDF, images, TXT/MD and Word
  documents. Stored privately in PostgreSQL, indexed in the protected "Subscription
  attachments" media folder, forced download behind admin auth. Existing attachments
  are indexed on upgrade. Renaming and deletion are synchronized in both views.
  Private files are excluded from public-image pickers and are not migrated to R2.
  Backups store private bytes once and regenerate media entries on restore.
  Media previews use react-doc-viewer-plus for PDFs and public Office documents.
  Private PDFs are read through the authenticated download route into a browser-only
  blob; TXT/MD display escaped text locally. Private Office files remain download-only
  and are never passed to Microsoft's online viewer. Preview reads have a 30-second
  timeout and a 25 MiB PDF / 1 MiB text limit. Closing cancels reads and releases blobs.
- ExchangeRate-API key belongs in Site Settings alongside Resend/DeepL/IPGeolocation;
  existing encrypted_settings storage and email-code-protected reveal are reused.
  Browser only receives rates, provider update timestamps and configured status.
  Server caches USD-base rates until provider next update; conversions are estimates.
  Initial and renewal estimates use their respective currencies; reminder emails use
  the renewal currency. Legacy records and backups initialize both currencies from
  the old currency field. Legacy API inputs are still accepted; new inputs specify
  initialCurrency and renewalCurrency. The retained legacy column mirrors initialCurrency.
- The list places details immediately after category. The editor places details below
  the category/renewal row. Reminder emails include full multiline details as escaped
  text in both HTML and plain-text formats; older frozen jobs without details still work.
- Search, category/status filters, pagination, loading/error/empty states, bilingual UI,
  mobile fullscreen editor, attachment upload progress, and send status are available.
  The table follows other management pages: centered rows, bounded horizontal scroll,
  pinned actions and a page-size footer (12/24/48). No recipient field is displayed;
  the reminder resolves the creating administrator's current email at delivery time.

## Implementation
1. Backend domain/schema/CRUD + private attachment endpoints; focused unit tests.
2. Encrypted key + provider validation/cache + Site Settings row and test action.
3. Queue scheduling, branded reminder mail, current-source authorization checks.
4. Admin navigation/table/editor and runtime-validated API client.
5. Isolated PostgreSQL/Redis integration and frontend regression checks.

## Structure And Style
Feature backend: blog-server/src/admin/subscriptions/; frontend:
blog-client/admin/src/app/subscriptions/ and shared/subscriptions-api.ts.
Follow existing Elysia TypeBox schemas and Astryx layout/table/dialog components.
Example: `const schema = t.Object({ name: t.String({ minLength: 1 }) });`
Schema additions are additive and idempotent. The subscription core needs no additional
dependency; document preview uses react-doc-viewer-plus and its Ant Design peers.
No new CI, branch, secret logging, public attachment URL or automatic external renewal.

## Verification Commands
`cd blog-server && bun run typecheck && bun test src && bun run test:security`
`cd blog-client && bun run check && bun run test --run && bun run build && bun run test:production`
Use isolated disposable local databases for persistence/security tests, no production writes.
New backups include subscriptions and private attachment bytes as checksum-validated
ZIP entries, not oversized JSON strings. Old archives remain
importable. Restoring disables reminders until the administrator explicitly enables them,
because transient delivery history is not part of the existing backup format.

## Provider
Official endpoint: https://www.exchangerate-api.com/docs/standard-requests
Provider update frequency depends on the account plan; display actual timestamps,
not a claim of tick-by-tick live pricing.
