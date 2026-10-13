# Email Notifications

## Preferences And Language

The existing profile switches control comment/reply and new-article notifications. Saving a frontend profile also saves the current interface language (`zh-CN` or `en`) as the recipient's notification language. Saving the administrator's own profile uses its profile locale. Updating another user's bilingual profile does not overwrite that user's notification language.

Both notification types reuse the existing `renderLeiBlogEmailHtml` brand frame and `sendResendEmail` transport. Subjects, descriptions, action labels, preference links, and the frame footer are bilingual. English article titles/summaries and author names use the existing English localization, falling back to the original content if missing.

## Trigger Rules

- Approved article and guestbook replies notify the parent comment's subscribed author. Self-replies do not notify their own author.
- Subscribed administrators receive new approved comment notifications, as in the old project. An administrator who is also the parent receives one reply notification, not a second administrator notification.
- New articles notify subscribed users other than the author on their first public publication. Drafts and future publication dates do not notify early. Editing or republishing the same article does not generate another broadcast.
- Scheduled articles are published by the background worker when due. Queued delivery checks the current subscription, recipient email, and public/approved/deleted state again before sending.

## Delivery And Operations

Notification jobs are written in the same PostgreSQL transaction as their source content. The worker claims one job at a time using a database lease and sends without delaying the originating HTTP request. Multiple workers cannot claim the same active job. Sender configuration comes from the existing Resend domain and encrypted API key.

The exact message is persisted before its first send. Retries use the same payload and `Idempotency-Key`. Resend retains idempotency keys for 24 hours; this worker stops retrying 23 hours after the first attempt, or after eight failed attempts. Transient failures use exponential backoff. Missing sender configuration defers a job for 15 minutes without consuming an attempt. Logs include job IDs, kind, and attempt counts, not email addresses, content, or API keys. See [Resend's idempotency documentation](https://resend.com/docs/dashboard/emails/idempotency-keys).

Schema upgrades mark existing public content as already queued to avoid retroactive broadcasts. Notification jobs are operational data, not part of exported site backups. Their foreign keys are cleared by a full restore, and restored public content is marked to avoid replaying historical notifications.

## Verification

- `bun test src` includes bilingual template and HTML-escaping tests.
- `bun run test:security` includes disposable PostgreSQL/Redis integration suites. Notification delivery is captured locally; no real email is sent by these tests.
- `bun run check`, `bun run test --run`, and `bun run build -- --logLevel error` in `blog-client` verify the preference payload and frontend changes.
